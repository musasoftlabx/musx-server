import { dateTime, DB } from "..";
import { Glob } from "bun";
import { exec, execSync } from "child_process";
import { existsSync } from "fs";
import { Stream } from "@elysiajs/stream";
import rgbHex from "rgb-hex";
import { unlink } from "fs/promises";
import dayjs from "dayjs";
const ColorThief = require("colorthief");

const colorsFromImage = async (path: string) => {
  const rgbArray = await ColorThief.getColor(path);
  const rgbPalette = await ColorThief.getPalette(path);
  return JSON.stringify([
    `#${rgbHex(rgbArray.join())}`,
    ...rgbPalette.map((rgbArray: []) => `#${rgbHex(rgbArray.join())}`),
  ]);
};

export default async function* () {
  let count = 0;
  const glob = new Glob("**/*.{mp3}");
  const musicDirectory = "./Music";

  for await (const entry of glob.scan({ cwd: musicDirectory })) {
    const file = entry.replaceAll("$", "\\$").replaceAll("`", "\\`");

    // ? Remove root directory from entry
    const path = file.replaceAll("\\$", "$").replaceAll("\\`", "`");

    const pathExists: any = DB.query(
      `SELECT COUNT(path) FROM tracks WHERE path = "${path}"`,
    ).values();

    if (!Boolean(pathExists[0][0])) {
      yield `${count}. ${path}`;

      try {
        count++;

        const stdout: any = execSync(
          `ffprobe -v error -hide_banner -show_format -show_streams -output_format json "${musicDirectory}/${file}"`,
        );

        const buffer: Buffer = Buffer.from(stdout);
        const base64Data = buffer.toString("base64");
        const jsonString = atob(base64Data);
        const metadata = JSON.parse(jsonString);

        // ? Destructure
        const {
          tags,
          bit_rate: bitrate,
          size,
          duration,
          format_name,
        } = metadata.format;

        // ? Get the path and rename it to make artwork
        const artwork = `${path
          .replace(`.${format_name}`, "")
          .replace(/[^a-zA-Z0-9]/g, "_")}.jpg`; //\W+

        // ? Generate waveform
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
            null, //(await colorsFromImage(artworkPath)) ?? null,
          ] as any);
        } catch (err: any) {
          console.log("DB:", err.message);
        }
      } catch (err: any) {
        yield `Error. ${entry}: ${err.message}`;

        DB.query(
          `INSERT INTO scanErrors VALUES (NULL,?,?,?,DateTime('now'))`,
        ).run([file, "METADATA_EXTRACTION", null] as any);
      }
    }
  }

  const paths: any = DB.query(
    `SELECT id, path, artwork, waveform, title, artists FROM tracks`,
  ).all();

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
        DB.query(`UPDATE tracks SET palette = ? WHERE id = ${id}`).run([
          await colorsFromImage(artworkPath),
        ] as any);
      } catch (err: any) {
        DB.query(
          `INSERT INTO scanErrors VALUES (NULL,?,?,?,DateTime('now'))`,
        ).run([path, "IMAGE_EXTRACTION", null] as any);
      }
  }

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
        DB.query(
          `INSERT INTO scanErrors VALUES (NULL,?,?,?,DateTime('now'))`,
        ).run([path, "WAVEFORM_EXTRACTION", null] as any);
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
