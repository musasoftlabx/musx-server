import { DB } from "..";
import { Glob } from "bun";
import { exec, execSync } from "child_process";
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
  const glob = new Glob("**/*.mp3");

  return new Stream(async (stream) => {
    for await (const entry of glob.scan(".")) {
      try {
        count++;

        stream.send(`${count}. ${entry}`);

        const file = entry.replaceAll("$", "\\$").replaceAll("`", "\\`");

        const stdout: any = execSync(
          `ffprobe -show_entries 'stream:format' -output_format json "./${file}"`
        );

        const buffer = Buffer.from(stdout);
        const base64Data = buffer.toString("base64");
        const jsonString = atob(base64Data);

        // ? If no errors,
        const { streams, format } = JSON.parse(jsonString);

        // ? Remove root directory from entry
        const path = file
          .replace("Music/", "")
          .replaceAll("\\$", "$")
          .replaceAll("\\`", "`");

        // ? Destructure
        const { tags, bit_rate: bitrate, size, duration, format_name } = format;

        // ? Get the path and rename it to make artwork
        const artwork = `${path
          .replace(`.${format_name}`, "")
          .replace(/[^a-zA-Z0-9]/g, "_")}.jpg`; //\W+

        // ? Generate waveform
        const waveform = `${path
          .replace(`.${format_name}`, "")
          .replace(/[^a-zA-Z0-9]/g, "_")}.jpg`;

        const trackPath = `./Music/${path
          .replaceAll("$", "\\$")
          .replaceAll("`", "\\`")}`;
        const artworkPath = `./Artwork/${artwork}`;
        const waveformPath = `./Waveform/${waveform}`;

        // ? Execute ffmpeg to construct waveform
        // if (!existsSync(waveformPath)) {
        //   execSync(
        //     `ffmpeg -y -i "${trackPath}" -filter_complex showwavespic -frames:v 1 "${waveformPath}"`
        //   );
        // }

        // ? Execute ffmpeg to extract artwork
        if (!existsSync(artworkPath)) {
          try {
            execSync(
              `ffmpeg -y -i "${trackPath}" -an -vcodec copy "${artworkPath}"`
            );
          } catch (err: any) {
            DB.query(
              `INSERT INTO scanErrors VALUES (NULL,?,?,DateTime('now'))`
            ).run(["IMAGE_EXTRACTION", err.message] as any);
          }
        }

        // ? Insert record to DB
        try {
          DB.query(
            `INSERT INTO tracks VALUES (NULL,?,DateTime('now'),?,?,?,?,?,?,?,0,0,?,?,?,?,?,?,?,?,?,?,?,NULL)`
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
            (await colorsFromImage(artworkPath)) ?? null,
          ] as any);
        } catch (err: any) {
          console.log("DB:", err.message);
        }
      } catch (err: any) {
        stream.send(`${count}. ${entry}: ${err.message}`);

        DB.query(
          `INSERT INTO scanErrors VALUES (NULL,?,?,DateTime('now'))`
        ).run(["METADATA_EXTRACTION", err.message] as any);
      }
    }

    /* const paths: any = DB.query(
      `SELECT id, path, artwork, waveform FROM tracks`
    ).all();

    console.log("paths:", paths);

    for await (const { id, path, artwork, waveform } of paths) {
      const trackPath = `./Music/${path
        .replaceAll("$", "\\$")
        .replaceAll("`", "\\`")}`;
      const artworkPath = `./Artwork/${artwork}`;
      const waveformPath = `./Waveform/${waveform}`;

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

      // ? Execute ffmpeg to construct waveform
      if (!existsSync(waveformPath)) {
        exec(
          `ffmpeg -y -i "${trackPath}" -filter_complex showwavespic -frames:v 1 "${waveformPath}"`
        );
      }
    } */

    stream.close();
  });
}
