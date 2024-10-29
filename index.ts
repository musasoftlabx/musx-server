import { Elysia } from "elysia";
import { Database } from "bun:sqlite";
export const DB = new Database("musx.db", { create: true });

import { html, Html } from "@elysiajs/html";
import { existsSync, mkdirSync } from "fs";

import { dashboard } from "./routes/dashboard";
import rateTrack from "./routes/rateTrack";
import updatePlayCount from "./routes/updatePlayCount";
import deleteTrack from "./routes/deleteTrack";
import addPlaylistTrack from "./routes/addPlaylistTrack";
import playlists from "./routes/playlists";
import createPlaylist from "./routes/createPlaylist";
import scan from "./routes/scan";
import reset from "./routes/reset";

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
    year VARCHAR(15),
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
    palette VARCHAR(255),
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
