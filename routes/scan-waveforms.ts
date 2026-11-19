import { DB } from "..";
import { Context } from "elysia";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { paths } from "../utils/getStoredPaths";

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
  const lockDirectory = resolve("./.waveform-scan.lock");

  try {
    await mkdir(lockDirectory);
  } catch (error) {
    if (!hasCode(error, "EEXIST")) throw error;
    set.status = 409;
    yield "A scan is already running. If a previous process crashed, remove .waveform-scan.lock only after confirming no scan is active.";
    return;
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
        count++;
        yield `${count}. ${path}`; // ? Send an output to client to show file being probed.

        execSync(
          `ffmpeg -v error -hide_banner -y -i "${trackPath}" -filter_complex showwavespic -frames:v 1 "${waveformPath}"`,
        );
      } catch (err) {
        if (err instanceof Error) {
          DB.run(`INSERT INTO scanErrors VALUES (NULL,?,?,?,DateTime('now'))`, [
            path,
            "WAVEFORM_EXTRACTION",
            null,
          ]);
        }
      }
  }
}
