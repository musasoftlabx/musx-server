import { DB } from "..";

import { Glob } from "bun";
import { exec } from "child_process";
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
                      await colorsFromImage(`./Artwork/${artwork}`),
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
}