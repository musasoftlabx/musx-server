import { DB } from "..";
import { Context } from "elysia";
import { SQLQueryBindings } from "bun:sqlite";
import { execSync } from "child_process";
import { existsSync } from "node:fs";
import { paths } from "../utils/getStoredPaths";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import rgbHex from "rgb-hex";

const ColorThief = require("colorthief");

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

//export default async function* (params: Pick<Context, "set">) {
export default async function* ({ set }: Pick<Context, "set">) {
  let count = 0;
  const musicDirectory = "./Music";
  const lockDirectory = resolve("./.artworks-scan.lock");

  try {
    await mkdir(lockDirectory);
  } catch (error) {
    if (!hasCode(error, "EEXIST")) throw error;
    set.status = 409;
    yield "A scan is already running. If a previous process crashed, remove .music-scan.lock only after confirming no scan is active.";
    return;
  }

  // ? Loop through library to extract or update artworks
  for await (const { id, path, artwork } of paths) {
    const trackPath = `${musicDirectory}/${path
      .replaceAll("$", "\\$")
      .replaceAll("`", "\\`")}`;
    const artworkPath = `./Artwork/${artwork}`;

    // ? Execute ffmpeg to extract artwork
    if (!existsSync(artworkPath))
      try {
        count++;
        yield `${count}. ${path}`; // ? Send an output to client to show file being probed.

        execSync(
          `ffmpeg -v error -hide_banner -y -i "${trackPath}" -an -vcodec copy "${artworkPath}"`,
        );

        DB.query<SQLQueryBindings, {}>(
          `UPDATE tracks SET palette = ? WHERE id = ${id}`,
        ).run([await colorsFromImage(artworkPath)]);
      } catch (err) {
        if (err instanceof Error)
          DB.run(`INSERT INTO scanErrors VALUES (NULL,?,?,?,DateTime('now'))`, [
            path,
            "IMAGE_EXTRACTION",
            null,
          ]);
      }
  }
}
