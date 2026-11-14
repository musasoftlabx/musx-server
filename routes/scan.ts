import { DB } from "..";
import type { Context } from "elysia";
import { Glob } from "bun";
import type { SQLQueryBindings } from "bun:sqlite";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, rmdir, stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const probeFile = promisify(execFile);
const CONCURRENCY = 4;
const PROBE_TIMEOUT_MS = 30_000;

interface ProbeMetadata {
  format?: {
    tags?: Record<string, string | undefined>;
    bit_rate?: string;
    size?: string;
    duration?: string;
    format_name?: string;
  };
  streams?: {
    codec_type?: string;
    channels?: number;
    channel_layout?: string;
    sample_rate?: string;
    tags?: { encoder?: string };
  }[];
}

interface Track {
  id: number;
  path: string;
  artwork: string | null;
  waveform: string | null;
  title: string | null;
  artists: string | null;
}

type ProbeResult =
  | { path: string; bindings: SQLQueryBindings[] }
  | { path: string; error: unknown };

function hasCode(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function probe(path: string, musicDirectory: string): Promise<ProbeResult> {
  try {
    const { stdout } = await probeFile(
      "ffprobe",
      [
        "-v", "error", "-hide_banner",
        "-select_streams", "a:0",
        "-show_format", "-show_streams", "-output_format", "json",
        resolve(musicDirectory, path),
      ],
      { encoding: "utf8", timeout: PROBE_TIMEOUT_MS, killSignal: "SIGKILL" }
    );
    const metadata: ProbeMetadata = JSON.parse(stdout);
    const stream = metadata.streams?.find((item) => item.codec_type === "audio");
    if (!metadata.format || !stream) {
      throw new Error("ffprobe returned no audio stream or format metadata");
    }

    const { tags, bit_rate, size, duration, format_name } = metadata.format;
    // Preserve MP3 asset names; retain other extensions to avoid format collisions.
    const assetName = path.replace(/\.mp3$/, "").replace(/[^a-zA-Z0-9]/g, "_");
    return {
      path,
      bindings: [
        path,
        tags?.title ?? null,
        tags?.album ?? null,
        tags?.album_artist ?? null,
        tags?.artist ?? null,
        tags?.genre ?? null,
        tags?.date ?? null,
        tags?.track ?? null,
        bit_rate ?? null,
        size ?? null,
        duration ?? null,
        format_name ?? null,
        stream.channels ?? null,
        stream.channel_layout ?? null,
        stream.sample_rate ?? null,
        stream.tags?.encoder ?? null,
        `${assetName}.jpg`,
        `${assetName}.png`,
        null,
      ],
    };
  } catch (error) {
    return { path, error };
  }
}

export default async function* ({ set }: Pick<Context, "set">) {
  const musicDirectory = resolve("./Music");
  const lockDirectory = resolve("./.music-scan.lock");

  try {
    await mkdir(lockDirectory);
  } catch (error) {
    if (!hasCode(error, "EEXIST")) throw error;
    set.status = 409;
    yield "A scan is already running. If a previous process crashed, remove .music-scan.lock only after confirming no scan is active.";
    return;
  }

  try {
    const scanError = DB.query<unknown, SQLQueryBindings[]>(
      `INSERT INTO scanErrors (track, operation, error, scannedOn)
       VALUES (?, ?, ?, DateTime('now'))`
    );
    const reportError = (path: string, operation: string, error: unknown) => {
      const message = errorMessage(error);
      scanError.run(path, operation, message);
      return `Error. ${path}: ${message}`;
    };

    try {
      const directory = await stat(musicDirectory);
      const checkDirectory = async () => {
        const current = await stat(musicDirectory);
        if (
          !current.isDirectory() ||
          current.dev !== directory.dev ||
          current.ino !== directory.ino
        ) {
          throw new Error("Music directory changed during scanning; cleanup aborted");
        }
        await access(musicDirectory, constants.R_OK | constants.X_OK);
      };
      await checkDirectory();

      const tracks = DB.query<Track, []>(
        `SELECT id, path, artwork, waveform, title, artists FROM tracks`
      ).all();
      const existingPaths = new Set(tracks.map((track) => track.path));
      const insertTrack = DB.query<unknown, SQLQueryBindings[]>(
        `INSERT INTO tracks (
          path, syncDate, title, album, albumArtist, artists, genre, year, track,
          rating, plays, bitrate, size, duration, format, channels, channelLayout,
          sampleRate, encoder, artwork, waveform, palette, lyrics
        ) VALUES (?, DateTime('now'), ?, ?, ?, ?, ?, ?, ?, 0, 0,
                  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
      );
      const saveBatch = DB.transaction((results: ProbeResult[]) => {
        const errors: string[] = [];
        for (const result of results) {
          if ("error" in result) {
            errors.push(reportError(result.path, "METADATA_EXTRACTION", result.error));
          } else {
            try {
              insertTrack.run(...result.bindings);
            } catch (error) {
              errors.push(reportError(result.path, "DB_INSERTION", error));
            }
          }
        }
        return errors;
      });

      let count = 0;
      const scanBatch = async function* (paths: string[]) {
        for (const path of paths) yield `${++count}. ${path}`;
        const results = await Promise.all(paths.map((path) => probe(path, musicDirectory)));
        // Keep disk/process work outside the short SQLite write transaction.
        yield* saveBatch(results);
      };

      let pending: string[] = [];
      for await (const path of new Glob("**/*.{mp3,flac,aac,m4a}").scan({ cwd: musicDirectory })) {
        if (existingPaths.has(path)) continue;
        pending.push(path);
        if (pending.length === CONCURRENCY) {
          yield* scanBatch(pending);
          pending = [];
        }
      }
      if (pending.length) yield* scanBatch(pending);

      const deleteTrack = DB.query<unknown, [number]>(
        "DELETE FROM tracks WHERE id = ?"
      );
      const recordDeletion = DB.query<unknown, SQLQueryBindings[]>(
        `INSERT INTO deletedTracks (path, title, artists, deletedOn)
         VALUES (?, ?, ?, DateTime('now'))`
      );
      const deleteBatch = DB.transaction((missing: Track[]) => {
        for (const track of missing) {
          deleteTrack.run(track.id);
          recordDeletion.run(track.path, track.title, track.artists);
        }
      });

      for (let i = 0; i < tracks.length; i += CONCURRENCY) {
        const checks = await Promise.all(
          tracks.slice(i, i + CONCURRENCY).map(async (track) => {
            try {
              await stat(resolve(musicDirectory, track.path));
              return { track, missing: false };
            } catch (error) {
              if (hasCode(error, "ENOENT")) return { track, missing: true };
              return { track, missing: false, error };
            }
          })
        );
        const missing: Track[] = [];
        for (const check of checks) {
          if ("error" in check) {
            yield reportError(check.track.path, "FILE_ACCESS", check.error);
          } else if (check.missing) {
            missing.push(check.track);
          }
        }
        if (!missing.length) continue;

        await checkDirectory();
        deleteBatch(missing);
        for (const track of missing) {
          for (const asset of [
            track.artwork && resolve("./Artwork", track.artwork),
            track.waveform && resolve("./Waveform", track.waveform),
          ]) {
            if (!asset) continue;
            try {
              await unlink(asset);
            } catch (error) {
              if (!hasCode(error, "ENOENT")) {
                yield reportError(asset, "ASSET_DELETION", error);
              }
            }
          }
        }
      }
    } catch (error) {
      yield reportError(musicDirectory, "SCAN", error);
    }
  } finally {
    await rmdir(lockDirectory);
  }
}
