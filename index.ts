import { Glob } from "bun";
import { exec } from "child_process";
import { Elysia } from "elysia";
import { Database } from "bun:sqlite";
const DB = new Database("musx.db", { create: true });

import { html, Html } from "@elysiajs/html";
import { Stream } from "@elysiajs/stream";
import { existsSync, mkdirSync } from "fs";

DB.exec("PRAGMA journal_mode = WAL;");

// ? Create table if it doesn't exist
DB.query(
  `CREATE TABLE IF NOT EXISTS "directory" (
      path VARCHAR(100) PRIMARY KEY,
      sync_date DATETIME,
      title VARCHAR (255),
      album VARCHAR(255),
      album_artist VARCHAR(255),
      artist VARCHAR(255),
      genre VARCHAR(20),
      year INT,
      track TINYINT(3),
      rating TINYINT(1),
      bitrate INT(10),
      size MEDIUMINT,
      duration DOUBLE,
      format VARCHAR(5),
      channels TINYINT(1),
      channel_layout VARCHAR(15),
      sample_rate INT(10),
      encoder VARCHAR(20),
      artwork VARCHAR(255),
      lyrics TEXT
    )`
).run();
// ? Create artowk directory if it doesn't exist
!existsSync("./Artwork") && mkdirSync("./Artwork", { recursive: true });

const scanner = () =>
  `<html lang='en'>
    <head>
      <title>Hello World</title>
    </head>
    <body>
      <h1>Hello World</h1>
    </body>
  </html>`;

const scan = () =>
  new Stream(async (stream) => {
    let count = 0;

    const glob = new Glob("**/*.mp3");

    for await (const entry of glob.scan(".")) {
      count++;

      stream.send(`${count}. ${entry}`);

      const file = entry.replaceAll("$", "\\$").replaceAll("`", "\\`");

      exec(
        `ffprobe -show_entries 'stream:format' -output_format json "./${file}"`,
        (error, stdout, stderr) => {
          if (error) {
            console.error(`error: ${error.message}`);
            return;
          }
          // ? If no errors,
          const { streams, format } = JSON.parse(stdout);
          // ? Remove root directory from entry
          const path = file
            .replace("Music/", "")
            .replaceAll("\\$", "$")
            .replaceAll("\\`", "`");
          // ? Destructure
          const {
            tags,
            bit_rate: bitrate,
            size,
            duration,
            format_name,
          } = format;
          // ? Get the path and rename it to make artwork
          const artwork = `${path
            .replace(`.${format_name}`, "")
            .replace(/[^a-zA-Z0-9]/g, "_")}.jpg`; //\W+ //const filename = path.split("/").slice(-1)[0];
          // ? Execute ffmpeg to extract artwork
          exec(
            `ffmpeg -y -i "./${file}" -an -vcodec copy "./Artwork/${artwork}"`,
            async () => {
              // ? Insert record to DB
              try {
                DB.query(
                  `INSERT INTO directory VALUES (?,DateTime('now'),?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?,NULL)`
                ).run([
                  path,
                  tags?.title,
                  tags?.album,
                  tags?.album_artist,
                  tags?.artist,
                  tags?.genre,
                  tags?.date,
                  tags?.track,
                  bitrate,
                  size,
                  duration,
                  format_name,
                  streams[0].channels,
                  streams[0].channel_layout,
                  streams[0].sample_rate,
                  streams[0]?.tags?.encoder,
                  artwork,
                ] as any);
              } catch (err: any) {
                console.log(err.message);
              }
            }
          );
        }
      );
    }

    stream.close();
  });

const list = ({ params }: { params: { "*": string } }) => {
  const decoded = decodeURI(params["*"]);

  const entry = decoded === "/" ? "" : decoded;

  const paths = DB.prepare(
    `SELECT path FROM directory WHERE path LIKE '%${entry}%'`
  ).all();

  return [
    ...new Set( // ? new Set removes duplicates
      paths.map(({ path }: any) => path.replace(entry, "").split("/")[0])
    ),
  ];
};

const truncate = () => {
  exec(`rm -rf ./Artwork/`, () => {});
  return DB.query(`DELETE FROM directory`).run();
};

const app = new Elysia()
  .use(html({ contentType: "text/html" }))
  .get("/html", () => scanner())
  .get("/scanner", () => Bun.file("scanner.tsx"))
  .get("/scan", () => scan())
  .get("/truncate", () => truncate())
  .get("/*", (params) => list(params))
  .listen(6666);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
