import { Elysia } from "elysia";
import { Database } from "bun:sqlite";
import { html, Html } from "@elysiajs/html";
export const DB = new Database("musx.db", { create: true });

import { dashboard } from "./routes/dashboard";
import album from "./routes/album";
import artist from "./routes/artist";
import artists from "./routes/artists";
import rateTrack from "./routes/rateTrack";
import updatePlayCount from "./routes/updatePlayCount";
import deleteTrack from "./routes/deleteTrack";
import addPlaylistTrack from "./routes/addPlaylistTrack";
import playlists from "./routes/playlists";
import createPlaylist from "./routes/createPlaylist";
import scan from "./routes/scan";
import reset from "./routes/reset";
import init from "./routes/init";
import updateLyrics from "./routes/updateLyrics";
import updatePalette from "./routes/updatePalette";
import frameExtraction from "./routes/frameExtraction";
import playlist from "./routes/playlist";
import plays from "./routes/plays";
import libraryCount from "./routes/libraryCount";

import { Lyrics, Palette, PlayCount, RateTrack } from "./types";

init();

export const tracksTableColumns =
  "path, title, albumArtist, artists, genre, year, track, rating, plays, bitrate, size, duration, format, channels, channelLayout, sampleRate, encoder, artwork, waveform, palette, startsAt, endsAt, addedOn";

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
        DB.query(`SELECT * FROM tracks WHERE path = "${entry}${path}"`).get()
      );
  }

  const sortedFolders = folders.sort((a, b) => a.name - b.name);
  const sortedFiles = files.sort((a: any, b: any) => a.path - b.path);

  return [...sortedFolders, ...sortedFiles];
};

// const updatePalette = async () => {
//   const palettes: any = DB.query(`SELECT palette FROM tracks`).run();
//   for await (const palette of palettes) {
//     const _palette = palette.map((color:string)=>({
//       primary: color[5],
//       secondary: color[1],
//       tertiary: color[0],
//       waveform: color[3],
//       icons: color[0],
//     }))

//     ['Primary', 'Secondary', 'Tertiary', 'Waveform', 'Icons'];
//   }
// };

const app = new Elysia()
  .use(html({ contentType: "text/html" }))
  .get("/html", () => scanner())
  .get("/scanner", () => Bun.file("scanner.tsx"))
  .get("/scan", () => scan())
  .get("/reset", () => reset())
  .get("/dashboard", () => dashboard())
  .get("/artists", artists)
  .get("/artist/:artist", (params) => artist(params))
  .get("/artist/:artist/album/:album", (params) => album(params))
  .get("/playlists", () => playlists)
  .get("/playlist/:id", (params) => playlist(params))
  .get("/plays", (params) => plays(params))
  .get("/libraryCount", libraryCount)
  .post("/createPlaylist", (params) => createPlaylist(params))
  .post("/addPlaylistTrack", (params) => addPlaylistTrack(params))
  .patch("/rateTrack", (params: RateTrack) => rateTrack(params))
  .patch("/updatePlayCount", (params: PlayCount) => updatePlayCount(params))
  .delete("/deleteTrack", (params) => deleteTrack(params))
  .patch("/extract", (params) => frameExtraction())
  .patch("/updatePalette", (params: Palette) => updatePalette(params))
  .put("/updateLyrics", (params: Lyrics) => updateLyrics(params))
  .get("/*", (params) => list(params))
  .listen(3030);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
