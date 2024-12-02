import { DB } from "..";
import { Glob } from "bun";
import { execSync } from "child_process";
import { Stream } from "@elysiajs/stream";

export default async function rescan() {
  let count = 0;
  const glob = new Glob(`**/*.mp3`);

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
              WHERE path = ?
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
              path,
            ] as {});
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
  });
}
