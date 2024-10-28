import { Glob } from "bun";
import { exec } from "child_process";
import { Elysia } from "elysia";
import { Database } from "bun:sqlite";
export const DB = new Database("musx.db", { create: true });

import { html, Html } from "@elysiajs/html";
import { Stream } from "@elysiajs/stream";
import { existsSync, mkdirSync } from "fs";

import { dashboard } from "./routes/dashboard";
import rateTrack from "./routes/rateTrack";
import updatePlayCount from "./routes/updatePlayCount";
import deleteTrack from "./routes/deleteTrack";
import addPlaylistTrack from "./routes/addPlaylistTrack";
import playlists from "./routes/playlists";
import createPlaylist from "./routes/createPlaylist";

//DB.exec("PRAGMA journal_mode = WAL;");

// ? Create table if it doesn't exist
DB.query(
  `CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path VARCHAR(100),
    syncDate DATETIME,
    title VARCHAR (255),
    album VARCHAR(255),
    albumArtist VARCHAR(255),
    artists VARCHAR(255),
    genre VARCHAR(20),
    year INT,
    track TINYINT(3),
    rating TINYINT(1),
    plays TINYINT(4),
    bitrate INT(10),
    size MEDIUMINT,
    duration DOUBLE,
    format VARCHAR(5),
    channels TINYINT(1),
    channelLayout VARCHAR(15),
    sampleRate INT(10),
    encoder VARCHAR(20),
    artwork VARCHAR(255),
    waveform VARCHAR(255),
    lyrics TEXT
  )`
).run();

DB.query(`CREATE UNIQUE INDEX IF NOT EXISTS idxPath ON tracks (path)`).run();

DB.query(
  `CREATE TABLE IF NOT EXISTS "plays" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trackId INTEGER,
    playedOn DATETIME,
    FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`
).run();

DB.query(`DROP TABLE IF EXISTS playlists`).run();

DB.query(
  `CREATE TABLE IF NOT EXISTS "playlists" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(30),
    artwork VARCHAR(50),
    createdOn DATETIME,
    modifiedOn DATETIME
  )`
).run();

DB.query(
  `CREATE TABLE IF NOT EXISTS "playlistTracks" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlistId INTEGER,
    trackId INTEGER,
    startAt DOUBLE,
    endsAt DOUBLE,
    addedOn DATETIME,
    FOREIGN KEY ("playlistId") REFERENCES "playlists" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`
).run();

//DB.query(`CREATE UNIQUE INDEX IF NOT EXISTS idxPath ON tracks (path)`).run();

// ? Create artwork & waveform directories if it doesn't exist
!existsSync("./Artwork") && mkdirSync("./Artwork", { recursive: true });
!existsSync("./Waveform") && mkdirSync("./Waveform", { recursive: true });

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
            .replace(/[^a-zA-Z0-9]/g, "_")}.jpg`; //\W+
          // ? Generate waveform
          const waveform = `${path
            .replace(`.${format_name}`, "")
            .replace(/[^a-zA-Z0-9]/g, "_")}.png`;
          // ? Execute ffmpeg to extract artwork
          exec(
            `ffmpeg -y -i "./${file}" -an -vcodec copy "./Artwork/${artwork}"`,
            async () => {
              exec(
                `ffmpeg -y -i "./${file}" -filter_complex showwavespic -frames:v 1 "./Waveform/${waveform}"`,
                async () => {
                  // ? Insert record to DB
                  try {
                    DB.query(
                      `INSERT INTO tracks VALUES (NULL,?,DateTime('now'),?,?,?,?,?,?,?,0,0,?,?,?,?,?,?,?,?,?,?,NULL)`
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
                      waveform,
                    ] as any);
                  } catch (err: any) {
                    console.log(err.message);
                  }
                }
              );
            }
          );
        }
      );
    }

    stream.close();
  });

const list = async ({ params }: { params: { "*": string } }) => {
  const decoded = decodeURI(params["*"]);

  const entry = decoded === "/" ? "" : decoded;

  const selection = DB.prepare(
    `SELECT path FROM tracks WHERE path LIKE "%${entry}%"`
  ).all();

  const paths = [
    ...new Set( // ? new Set removes duplicates
      selection.map(({ path }: any) => path.replace(entry, "").split("/")[0])
    ),
  ];

  const folders = [];
  const files = [];

  for await (const path of paths) {
    if (!path.includes(".mp3"))
      folders.push({
        name: path,
        path: `${entry.split("/").slice(0, -1).join("/")}/`,
      });
    else
      files.push(
        DB.query(
          `SELECT *, album_artist AS albumArtist FROM tracks WHERE path = "${entry}${path}"`
        ).get()
      );
  }

  const sortedFolders = folders.sort((a, b) => a.name - b.name);
  const sortedFiles = files.sort((a: any, b: any) => a.path - b.path);

  return [...sortedFolders, ...sortedFiles];
};

const truncate = () => {
  exec(`rm -rf ./Artwork/`, () => {});
  exec(`rm -rf ./Waveform/`, () => {});
  return DB.query(`DELETE FROM tracks`).run();
};

const colorize = () => {};

const app = new Elysia()
  .use(html({ contentType: "text/html" }))
  .get("/html", () => scanner())
  .get("/scanner", () => Bun.file("scanner.tsx"))
  .get("/scan", () => scan())
  .get("/truncate", () => truncate())
  .get("/dashboard", () => dashboard())
  .get("/playlists", (params) => playlists(params))
  .post("/createPlaylist", (params) => createPlaylist(params))
  .post("/addPlaylistTrack", (params) => addPlaylistTrack(params))
  .put("/rateTrack", (params: { body: { id: number; rating: number } }) =>
    rateTrack(params)
  )
  .put("/updatePlayCount", (params: { body: { id: number } }) =>
    updatePlayCount(params)
  )
  .delete("/deleteTrack", (params) => deleteTrack(params))
  .get("/colorize", (params: { body: { id: number; path: string } }) =>
    colorize()
  )
  .get("/*", (params) => list(params))
  .listen(3030);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
