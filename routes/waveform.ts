import { DB } from "..";
import { exec } from "child_process";
import { existsSync } from "fs";
import { Stream } from "@elysiajs/stream";

export default async function waveform() {
  let count = 0;

  const paths: any = DB.query(
    `SELECT id, path, artwork, waveform FROM tracks`
  ).all();

  return new Stream(async (stream) => {
    for await (const { path, waveform } of paths) {
      count++;

      stream.send(`${count}. ${path}`);

      const trackPath = `./Music/${path
        .replaceAll("$", "\\$")
        .replaceAll("`", "\\`")}`;
      const waveformPath = `./Waveform/${waveform}`;

      // ? Execute ffmpeg to construct waveform
      if (!existsSync(waveformPath)) {
        exec(
          `ffmpeg -y -i "${trackPath}" -filter_complex showwavespic -frames:v 1 "${waveformPath}"`
        );
      }
    }

    stream.close();
  });
}
