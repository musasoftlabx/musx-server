import { DB } from "..";
import { exec } from "child_process";
import { existsSync } from "fs";
import { Stream } from "@elysiajs/stream";
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

export default async function scan() {
  let count = 0;

  const paths: any = DB.query(
    `SELECT id, path, artwork, waveform FROM tracks`
  ).all();

  return new Stream(async (stream) => {
    for await (const { id, path, artwork } of paths) {
      count++;

      stream.send(`${count}. ${path}`);

      const trackPath = `./Music/${path
        .replaceAll("$", "\\$")
        .replaceAll("`", "\\`")}`;
      const artworkPath = `./Artwork/${artwork}`;

      // ? Execute ffmpeg to extract artwork
      if (!existsSync(artworkPath)) {
        exec(
          `ffmpeg -y -i "${trackPath}" -an -vcodec copy "${artworkPath}"`,
          async (error, stdout, stderr) => {
            if (error) {
              console.error(`error: ${error.message}`);
            } else {
              DB.query(`UPDATE tracks SET palette = ? WHERE id = ${id}`).run([
                await colorsFromImage(artworkPath),
              ] as any);
            }
          }
        );
      }
    }

    stream.close();
  });
}
