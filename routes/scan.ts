import { dateTime, DB } from "..";
import { Context } from "elysia";
import { Glob } from "bun";
import { SQLQueryBindings } from "bun:sqlite";
import { execSync } from "child_process";
import { existsSync } from "fs";
import {
  access,
  mkdir,
  readdir,
  rename,
  rmdir,
  stat,
  unlink,
} from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import rgbHex from "rgb-hex";
const ColorThief = require("colorthief");

import { paths } from "../utils/getStoredPaths";

const colorsFromImage = async (path: string) => {
  const rgbArray = await ColorThief.getColor(path);
  const rgbPalette = await ColorThief.getPalette(path);
  return JSON.stringify([
    `#${rgbHex(rgbArray.join())}`,
    ...rgbPalette.map((rgbArray: []) => `#${rgbHex(rgbArray.join())}`),
  ]);
};

function hasCode(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

//export default async function* (params: Pick<Context, "set">) {
export default async function* ({ set }: Pick<Context, "set">) {
  let count = 0;
  const musicDirectory = "./Music";
  const lockDirectory = resolve("./.music-scan.lock");
  const glob = new Glob("**/*.{mp3,flac,aac,m4a}");

  try {
    await mkdir(lockDirectory);
  } catch (error) {
    if (!hasCode(error, "EEXIST")) throw error;
    set.status = 409;
    yield "A scan is already running. If a previous process crashed, remove .music-scan.lock only after confirming no scan is active.";
    return;
  }

  try {
    const scanError = DB.query<unknown, SQLQueryBindings[]>(
      `INSERT INTO scanErrors (track, operation, error, scannedOn)
           VALUES (?, ?, ?, DateTime('now'))`,
    );
    const reportError = (path: string, operation: string, error: unknown) => {
      const message = errorMessage(error);
      scanError.run(path, operation, message);
      return `Error. ${path}: ${message}`;
    };

    try {
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
              DB.query<SQLQueryBindings, {}>(
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
              ]);
            } catch (err) {
              if (err instanceof Error)
                DB.query<SQLQueryBindings, {}>(
                  `INSERT INTO scanErrors VALUES (NULL,?,?,?,DateTime('now'))`,
                ).run([file, "DB_INSERTION", null]);
            }
          } catch (err) {
            if (err instanceof Error) {
              yield `Error. ${path}: ${err.message}`;

              DB.run(
                `INSERT INTO scanErrors VALUES (NULL,?,?,?,DateTime('now'))`,
                [file, "METADATA_EXTRACTION", null],
              );
            }
          }
        }
      }
    } catch (error) {
      yield reportError(musicDirectory, "SCAN", error);
    }
  } finally {
    await rmdir(lockDirectory);

    // ? Delete from DB if file not found
    for await (const { id, path, artwork, waveform, title, artists } of paths) {
      if (!existsSync(`${musicDirectory}/${path}`)) {
        DB.run(`DELETE FROM tracks WHERE id = ${id}`);
        DB.run(`INSERT INTO deletedTracks VALUES (NULL, ?, ?, ?, ?)`, [
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
}
