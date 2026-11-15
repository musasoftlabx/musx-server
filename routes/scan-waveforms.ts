import { DB } from "..";
import type { Context } from "elysia";
import type { SQLQueryBindings } from "bun:sqlite";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readdir, rename, rmdir, stat, unlink } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const CONCURRENCY = 2;
const FFMPEG_TIMEOUT_MS = 5 * 60_000;

interface Track {
  path: string;
  waveform: string | null;
}

interface Result {
  id: number;
  path: string;
  errors: unknown[];
}

function hasCode(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code;
}

async function generateWaveform(
  path: string,
  waveform: string,
  musicDirectory: string,
  waveformDirectory: string,
  signal: AbortSignal,
) {
  const temporaryPath = resolve(
    waveformDirectory,
    `.waveform-${randomUUID()}${extname(waveform)}`,
  );
  const errors: unknown[] = [];
  try {
    const command = runFile(
      "ffmpeg",
      [
        "-v", "error", "-hide_banner", "-nostdin", "-y",
        "-threads", "1",
        "-i", resolve(musicDirectory, path),
        "-filter_complex_threads", "1",
        "-filter_complex", "[0:a:0]showwavespic=s=600x240[waveform]",
        "-map", "[waveform]", "-frames:v", "1", "-threads", "1",
        temporaryPath,
      ],
      {
        encoding: "utf8",
        timeout: FFMPEG_TIMEOUT_MS,
        killSignal: "SIGKILL",
        signal,
      },
    );
    const closed = new Promise<void>((resolve) => {
      command.child.once("close", () => resolve());
    });
    try {
      await command;
    } finally {
      await closed;
    }
    if ((await stat(temporaryPath)).size === 0) {
      throw new Error("FFmpeg produced an empty waveform");
    }
    await rename(temporaryPath, resolve(waveformDirectory, waveform));
  } catch (error) {
    errors.push(error);
  } finally {
    try {
      await unlink(temporaryPath);
    } catch (error) {
      if (!hasCode(error, "ENOENT")) errors.push(error);
    }
  }
  return errors;
}

export default async function* ({ set }: Pick<Context, "set">) {
  const musicDirectory = resolve("./Music");
  const waveformDirectory = resolve("./Waveform");
  const lockDirectory = resolve("./.waveform-scan.lock");
  try {
    await mkdir(lockDirectory);
  } catch (error) {
    if (!hasCode(error, "EEXIST")) throw error;
    set.status = 409;
    yield "A waveform scan is already running. After a process crash, remove .waveform-scan.lock only after confirming no scan is active.";
    return;
  }

  try {
    const scanError = DB.query<unknown, SQLQueryBindings[]>(
      `INSERT INTO scanErrors (track, operation, error, scannedOn)
       VALUES (?, ?, ?, DateTime('now'))`,
    );
    const reportError = (path: string, error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      scanError.run(path, "WAVEFORM_EXTRACTION", message);
      return `Error. ${path}: ${message}`;
    };
    const controller = new AbortController();
    const running = new Map<number, Promise<Result>>();
    try {
      await access(musicDirectory, constants.R_OK | constants.X_OK);
      await mkdir(waveformDirectory, { recursive: true });
      const existing = new Set(await readdir(waveformDirectory));
      const tracks = DB.query<Track, []>(
        "SELECT path, waveform FROM tracks",
      ).all();
      let index = 0;
      let count = 0;
      while (index < tracks.length || running.size) {
        while (index < tracks.length && running.size < CONCURRENCY) {
          const { path, waveform } = tracks[index++];
          if (!waveform) {
            yield reportError(path, new Error("Track has no waveform filename"));
            continue;
          }
          if (existing.has(waveform)) continue;
          // Reserve the filename so tracks sharing an output cannot race.
          existing.add(waveform);
          yield `${++count}. ${path}`;
          const id = index;
          running.set(
            id,
            generateWaveform(
              path, waveform, musicDirectory, waveformDirectory, controller.signal,
            ).then((errors) => ({ id, path, errors })),
          );
        }
        if (!running.size) break;
        const result = await Promise.race(running.values());
        running.delete(result.id);
        for (const error of result.errors) yield reportError(result.path, error);
      }
    } catch (error) {
      yield reportError(waveformDirectory, error);
    } finally {
      controller.abort();
      // Do not release the cross-process lock until children and temp files are gone.
      for (const result of await Promise.all(running.values())) {
        for (const error of result.errors) reportError(result.path, error);
      }
    }
  } finally {
    await rmdir(lockDirectory);
  }
}
