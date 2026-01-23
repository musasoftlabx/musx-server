import { dateTime, DB } from "..";
import { Context } from "elysia";
import { Glob } from "bun";
import { SQLQueryBindings } from "bun:sqlite";
import { execSync } from "child_process";
import { existsSync } from "fs";
import rgbHex from "rgb-hex";
import { unlink } from "fs/promises";
const ColorThief = require("colorthief");

const colorsFromImage = async (path: string) => {
  const rgbArray = await ColorThief.getColor(path);
  const rgbPalette = await ColorThief.getPalette(path);
  return JSON.stringify([
    `#${rgbHex(rgbArray.join())}`,
    ...rgbPalette.map((rgbArray: []) => `#${rgbHex(rgbArray.join())}`),
  ]);
};

export default async function* (params: Pick<Context, "set">) {
  const { set } = params;

  let count = 0;
  const musicDirectory = "./Music";

  const glob = new Glob("**/*.{mp3}");

  // ? Scan files from glob output
  for await (const path of glob.scan({ cwd: musicDirectory })) {
    // ? Remove special characters from filename
    const file = path.replaceAll("$", "\\$").replaceAll("`", "\\`");

    // ? Add special characters from filename
    //const path = file.replaceAll("\\$", "$").replaceAll("\\`", "`");

    // ? Check if file has already been scanned before
    const pathExists = DB.query(
      `SELECT COUNT(path) FROM tracks WHERE path = "${path}"`,
    ).values();

    // ? If file has been scanned previously, ignore. Else, probe it
    if (!Boolean(pathExists[0][0])) {
      try {
        count++;

        yield `${count}. ${path}`; // ? Send an output to client to show file being probed.

        const stdout: any = execSync(
          `ffprobe -v error -hide_banner -show_format -show_streams -output_format json "${musicDirectory}/${file}"`,
        );

        const buffer: Buffer = Buffer.from(stdout);
        const base64Data = buffer.toString("base64");
        const jsonString = atob(base64Data);
        const metadata = JSON.parse(jsonString);

        // ? Destructure format from metadata
        const {
          tags,
          bit_rate: bitrate,
          size,
          duration,
          format_name,
        } = metadata.format;

        // ? Create artwork filename from path
        const artwork = `${path
          .replace(`.${format_name}`, "")
          .replace(/[^a-zA-Z0-9]/g, "_")}.jpg`; //\W+

        // ? Create waveform filename from path
        const waveform = `${path
          .replace(`.${format_name}`, "")
          .replace(/[^a-zA-Z0-9]/g, "_")}.png`;

        // ? Insert record to DB
        try {
          DB.query(
            `INSERT INTO tracks VALUES (NULL,?,DateTime('now'),?,?,?,?,?,?,?,0,0,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
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
            metadata?.streams[0].channels ?? null,
            metadata?.streams[0].channel_layout ?? null,
            metadata?.streams[0].sample_rate ?? null,
            metadata?.streams[0]?.tags?.encoder ?? null,
            artwork,
            waveform,
            null,
          ] as any);
        } catch (err) {
          if (err instanceof Error)
            DB.query(
              `INSERT INTO scanErrors VALUES (NULL,?,?,?,DateTime('now'))`,
            ).run([file, "DB_INSERTION", null] as any);
        }
      } catch (err) {
        if (err instanceof Error) {
          yield `Error. ${path}: ${err.message}`;

          DB.query(
            `INSERT INTO scanErrors VALUES (NULL,?,?,?,DateTime('now'))`,
          ).run([file, "METADATA_EXTRACTION", null] as any);
        }
      }
    }
  }

  const paths = DB.query<
    {
      id: number;
      path: string;
      artwork: string;
      waveform: string;
      title: string;
      artists: string;
    },
    SQLQueryBindings[]
  >(`SELECT id, path, artwork, waveform, title, artists FROM tracks`).all();

  // ? Loop through library to extract or update artworks
  for await (const { id, path, artwork } of paths) {
    const trackPath = `${musicDirectory}/${path
      .replaceAll("$", "\\$")
      .replaceAll("`", "\\`")}`;
    const artworkPath = `./Artwork/${artwork}`;

    // ? Execute ffmpeg to extract artwork
    if (!existsSync(artworkPath))
      try {
        execSync(
          `ffmpeg -v error -hide_banner -y -i "${trackPath}" -an -vcodec copy "${artworkPath}"`,
        );

        DB.query<SQLQueryBindings, {}>(
          `UPDATE tracks SET palette = ? WHERE id = ${id}`,
        ).run([await colorsFromImage(artworkPath)]);
      } catch (err) {
        if (err instanceof Error) {
          DB.query<SQLQueryBindings, {}>(
            `INSERT INTO scanErrors VALUES (NULL,?,?,?,DateTime('now'))`,
          ).run([path, "IMAGE_EXTRACTION", null]);
        }
      }
  }

  // ? Loop through library to extract or update waveforms
  for await (const { path, waveform } of paths) {
    const trackPath = `${musicDirectory}/${path
      .replaceAll("$", "\\$")
      .replaceAll("`", "\\`")}`;
    const waveformPath = `./Waveform/${waveform}`;

    // ? Execute ffmpeg to construct waveform
    if (!existsSync(waveformPath))
      try {
        execSync(
          `ffmpeg -v error -hide_banner -y -i "${trackPath}" -filter_complex showwavespic -frames:v 1 "${waveformPath}"`,
        );
      } catch (err) {
        if (err instanceof Error) {
          DB.query<SQLQueryBindings, {}>(
            `INSERT INTO scanErrors VALUES (NULL,?,?,?,DateTime('now'))`,
          ).run([path, "WAVEFORM_EXTRACTION", null]);
        }
      }
  }

  // ? Delete from DB if file not found
  for await (const { id, path, artwork, waveform, title, artists } of paths) {
    if (!existsSync(`${musicDirectory}/${path}`)) {
      DB.exec(`DELETE FROM tracks WHERE id = ${id}`);
      DB.exec(`INSERT INTO deletedTracks VALUES (NULL, ?, ?, ?, ?)`, [
        path,
        title,
        artists,
        dateTime,
      ]);
      await unlink(`./Artwork/${artwork}`);
      await unlink(`./Waveform/${waveform}`);
    }
  }
}
