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

type TParams = { body: any; set: any; error: any };

export default async function refreshMetadata(params: TParams) {
  const { body } = params;
  const { path } = body;

  let count = 0;
  const glob = new Glob(`**/${path}`);

  return new Stream(async (stream) => {
    for await (const entry of glob.scan(".")) {
      const file = entry.replaceAll("$", "\\$").replaceAll("`", "\\`");

      // ? Remove root directory from entry
      const path = file
        .replace("Music/", "")
        .replaceAll("\\$", "$")
        .replaceAll("\\`", "`");

      const pathExists: any = DB.query(
        `SELECT COUNT(path) FROM tracks WHERE path = "${path}"`
      ).values();

      if (Boolean(pathExists[0][0])) {
        stream.send(`${count}. ${path}`);

        try {
          count++;

          const stdout: any = execSync(
            `ffprobe -show_entries 'stream:format' -output_format json "./${file}"`
          );

          const buffer = Buffer.from(stdout);
          const base64Data = buffer.toString("base64");
          const jsonString = atob(base64Data);
          const metadata = JSON.parse(jsonString);

          // ? Destructure
          const {
            bit_rate: bitrate,
            size,
            duration,
            format_name,
          } = metadata.format;

          // ? Update track metadata
          try {
            DB.query(
              `UPDATE tracks SET
                syncDate = DateTime('now'),
                bitrate = ?,
                size = ?,
                duration = ?,
                format = ?,
                channels = ?,
                channelLayout = ?,
                sampleRate = ?,
                encoder = ?
              `
            ).run([
              bitrate,
              size,
              duration,
              format_name,
              metadata?.streams[0].channels ?? null,
              metadata?.streams[0].channel_layout ?? null,
              metadata?.streams[0].sample_rate ?? null,
              metadata?.streams[0]?.tags?.encoder ?? null,
            ] as any);
          } catch (err: any) {
            console.log("DB:", err.message);
          }
        } catch (err: any) {
          stream.send(`Error. ${entry}: ${err.message}`);

          DB.query(
            `INSERT INTO scanErrors VALUES (NULL,?,?,?,DateTime('now'))`
          ).run([file, "METADATA_EXTRACTION", null] as any);
        }
      }
    }

    stream.close();

    const track: any = DB.query(
      `SELECT id, path, artwork, waveform FROM tracks WHERE path = "${path}"`
    ).get();

    const trackPath = `./Music/${path
      .replaceAll("$", "\\$")
      .replaceAll("`", "\\`")}`;
    const artworkPath = `./Artwork/${track.artwork}`;
    const waveformPath = `./Waveform/${track.waveform}`;

    // ? Execute ffmpeg to extract artwork
    if (!existsSync(artworkPath))
      try {
        execSync(
          `ffmpeg -y -i "${trackPath}" -an -vcodec copy "${artworkPath}"`
        );
        DB.query(`UPDATE tracks SET palette = ? WHERE id = ${track.id}`).run([
          await colorsFromImage(artworkPath),
        ] as any);
      } catch (err: any) {
        DB.query(
          `INSERT INTO scanErrors VALUES (NULL,?,?,?,DateTime('now'))`
        ).run([path, "IMAGE_EXTRACTION", null] as any);
      }

    // ? Execute ffmpeg to construct waveform
    if (!existsSync(waveformPath))
      try {
        execSync(
          `ffmpeg -y -i "${trackPath}" -filter_complex showwavespic -frames:v 1 "${waveformPath}"`
        );
      } catch (err) {
        DB.query(
          `INSERT INTO scanErrors VALUES (NULL,?,?,?,DateTime('now'))`
        ).run([path, "WAVEFORM_EXTRACTION", null] as any);
      }
  });
}
