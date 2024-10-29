import { Elysia } from "elysia";
import { Database } from "bun:sqlite";
import { html, Html } from "@elysiajs/html";
export const DB = new Database("musx.db", { create: true });

import { dashboard } from "./routes/dashboard";
import rateTrack from "./routes/rateTrack";
import updatePlayCount from "./routes/updatePlayCount";
import deleteTrack from "./routes/deleteTrack";
import addPlaylistTrack from "./routes/addPlaylistTrack";
import playlists from "./routes/playlists";
import createPlaylist from "./routes/createPlaylist";
import scan from "./routes/scan";
import reset from "./routes/reset";
import init from "./routes/init";
import waveform from "./routes/waveform";
import artwork from "./routes/artwork";

init();

//DB.exec("PRAGMA journal_mode = WAL;");

const scanner = () =>
  `<html lang='en'>
    <head>
      <title>Hello World</title>
    </head>
    <body>
      <h1>Hello World</h1>
    </body>
  </html>`;

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

const app = new Elysia()
  .use(html({ contentType: "text/html" }))
  .get("/html", () => scanner())
  .get("/scanner", () => Bun.file("scanner.tsx"))
  .get("/scan", () => scan())
  .get("/waveform", () => waveform())
  .get("/artwork", () => artwork())
  .get("/reset", () => reset())
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
  .get("/*", (params) => list(params))
  .listen(3030);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
