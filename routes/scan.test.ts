import { afterAll, afterEach, beforeEach, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import { Elysia, type Context } from "elysia";
import * as childProcess from "node:child_process";
import type { ExecFileOptionsWithStringEncoding } from "node:child_process";
import { mkdtemp, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const DB = new Database(":memory:");
const runFile = promisify(childProcess.execFile);
let directory: string;
let useRealProbe = false;
const fixtureExecFile = Object.assign(
  () => { throw new Error("Use the promisified subprocess interface"); },
  {
    [promisify.custom]: (
      file: string,
      args: string[],
      options: ExecFileOptionsWithStringEncoding
    ) => file === "ffprobe" && !useRealProbe
      ? runFile(process.execPath, [join(directory, "fake-probe.ts"), ...args], options)
      : runFile(file, args, options),
  }
);
mock.module("node:child_process", () => ({
  ...childProcess,
  execFile: fixtureExecFile,
}));
mock.module("../index", () => ({ DB }));
const { default: scan } = await import("./scan");
const { default: init } = await import("./init");
const originalDirectory = process.cwd();
const realFfprobe = Bun.which("ffprobe");
const realFfmpeg = Bun.which("ffmpeg");

const fakeProbe = `
import { appendFileSync } from "node:fs";
const path = process.argv.at(-1);
const plan = await Bun.file(path).json();
const event = kind => appendFileSync("probe-events.jsonl", JSON.stringify({kind, path, pid: process.pid}) + "\\n");
event("start");
if (plan.mode === "hang") setInterval(() => {}, 1000);
else {
  await Bun.sleep(plan.delay ?? 40);
  event("end");
  if (plan.mode === "fail") {
    console.error("fixture probe failure");
    process.exit(2);
  }
  if (plan.mode === "invalid") console.log("invalid JSON");
  else console.log(JSON.stringify({
    format: { format_name: plan.format ?? "mp3", duration: "12.5", size: "1000", bit_rate: "128000", tags: { title: plan.title ?? "Track", artist: "Artist", album: "Album" } },
    streams: plan.mode === "no-audio" ? [] : [{ codec_type: "audio", channels: 2, sample_rate: "44100" }]
  }));
}
`;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "musx-scan-test-"));
  process.chdir(directory);
  await Promise.all(
    ["Music", "Artwork", "Waveform"].map((path) => mkdir(path))
  );
  await writeFile("fake-probe.ts", fakeProbe);
  useRealProbe = false;
  await init();
  DB.exec(`
    DROP TRIGGER IF EXISTS reject_track;
    DELETE FROM tracks;
    DELETE FROM scanErrors;
    DELETE FROM deletedTracks;
  `);
});

afterEach(async () => {
  process.chdir(originalDirectory);
  await rm(directory, { recursive: true, force: true });
});

afterAll(() => DB.close());

function context(): Pick<Context, "set"> {
  return { set: { headers: {} } };
}

async function collect() {
  const messages: string[] = [];
  for await (const message of scan(context())) messages.push(message);
  return messages;
}

async function addFile(path: string, plan: object = {}) {
  await writeFile(join("Music", path), JSON.stringify(plan));
}

function addTrack(path: string, artwork: string | null = null) {
  DB.query(
    "INSERT INTO tracks (path, title, artists, artwork, waveform) VALUES (?, ?, ?, ?, ?)"
  ).run(path, "Old title", "Old artist", artwork, "missing.png");
}

test("probes concurrently in bounded batches, preserves filenames/Unicode, and skips existing paths", async () => {
  const specialPath = 'quoted "$`\' track.mp3';
  const paths = [specialPath, ...Array.from({ length: 8 }, (_, i) => `track-${i}.mp3`)];
  await Promise.all(paths.map((path) => addFile(path, { title: "Beyonc\u00e9 \u2013 Caf\u00e9" })));
  await addFile("known.mp3", { mode: "fail" });
  addTrack("known.mp3");

  let ticks = 0;
  const timer = setInterval(() => ticks++, 5);
  let messages: string[];
  try {
    messages = await collect();
  } finally {
    clearInterval(timer);
  }
  expect(messages.filter((message) => message.startsWith("Error."))).toEqual([]);
  expect(DB.query("SELECT COUNT(*) AS count FROM tracks").get()).toEqual({ count: 10 });
  expect(DB.query("SELECT title, channels FROM tracks WHERE path = ?").get(specialPath)).toEqual({
    title: "Beyonc\u00e9 \u2013 Caf\u00e9",
    channels: 2,
  });
  expect(ticks).toBeGreaterThan(2);

  const events = (await readFile("probe-events.jsonl", "utf8"))
    .trim().split("\n").map((line) => JSON.parse(line));
  let active = 0;
  let maximum = 0;
  for (const event of events) {
    active += event.kind === "start" ? 1 : -1;
    maximum = Math.max(maximum, active);
  }
  expect(active).toBe(0);
  expect(maximum).toBeGreaterThan(1);
  expect(maximum).toBeLessThanOrEqual(4);
  expect(events.filter((event) => event.kind === "start")).toHaveLength(9);
  await collect();
  expect(await readFile("probe-events.jsonl", "utf8")).toBe(
    events.map((event) => JSON.stringify(event)).join("\n") + "\n"
  );
  expect(await stat(".music-scan.lock").catch((error) => error.code)).toBe("ENOENT");
});

test("discovers MP3, FLAC, AAC and M4A in subdirectories without asset collisions or rescanning", async () => {
  await mkdir("Music/Album");
  await Promise.all(
    ["mp3", "flac", "aac", "m4a"].map((format) =>
      addFile(`Album/track.${format}`, { format })
    )
  );
  await addFile("Album/notes.txt", { mode: "fail" });
  expect((await collect()).filter((message) => message.startsWith("Error."))).toEqual([]);
  const tracks = DB.query<{
    path: string;
    format: string;
    artwork: string;
    waveform: string;
  }, []>("SELECT path, format, artwork, waveform FROM tracks ORDER BY format").all();
  expect(tracks.map(({ path, format }) => ({ path, format }))).toEqual([
    { path: "Album/track.aac", format: "aac" },
    { path: "Album/track.flac", format: "flac" },
    { path: "Album/track.m4a", format: "m4a" },
    { path: "Album/track.mp3", format: "mp3" },
  ]);
  expect(new Set(tracks.map((track) => track.artwork)).size).toBe(4);
  expect(new Set(tracks.map((track) => track.waveform)).size).toBe(4);
  const events = await readFile("probe-events.jsonl", "utf8");
  await collect();
  expect(await readFile("probe-events.jsonl", "utf8")).toBe(events);
});

test("records probe, parse, missing-audio and insertion failures without discarding valid tracks", async () => {
  await Promise.all([
    addFile("bad.mp3", { mode: "fail" }),
    addFile("invalid.mp3", { mode: "invalid" }),
    addFile("silent.mp3", { mode: "no-audio" }),
    addFile("rejected.mp3"),
    addFile("valid.mp3"),
  ]);
  DB.exec(`
    CREATE TRIGGER reject_track BEFORE INSERT ON tracks
    WHEN NEW.path = 'rejected.mp3' BEGIN
      SELECT RAISE(ABORT, 'fixture insertion failure');
    END;
  `);
  const messages = await collect();
  expect(messages.filter((message) => message.startsWith("Error. valid.mp3:"))).toEqual([]);
  expect(messages.filter((message) => message.startsWith("Error."))).toHaveLength(4);
  const errors = DB.query<{ track: string; operation: string; error: string }, []>(
    "SELECT track, operation, error FROM scanErrors"
  ).all();
  expect(errors).toHaveLength(4);
  expect(errors.every((error) => error.error.length > 0)).toBe(true);
  expect(errors.find((error) => error.track === "bad.mp3")?.error).toContain("fixture probe failure");
  expect(errors.find((error) => error.track === "rejected.mp3")?.operation).toBe("DB_INSERTION");
  expect(DB.query("SELECT path FROM tracks").all()).toEqual([{ path: "valid.mp3" }]);
});

test("cleanup tolerates absent assets and records other asset failures", async () => {
  addTrack("missing-1.mp3", "absent.jpg");
  addTrack("missing-2.mp3", "unremovable.jpg");
  await mkdir("Artwork/unremovable.jpg");
  const messages = await collect();
  expect(DB.query("SELECT COUNT(*) AS count FROM tracks").get()).toEqual({ count: 0 });
  expect(DB.query("SELECT COUNT(*) AS count FROM deletedTracks").get()).toEqual({ count: 2 });
  expect(DB.query("SELECT operation FROM scanErrors").all()).toEqual([{ operation: "ASSET_DELETION" }]);
  expect(messages.some((message) => message.includes("unremovable.jpg"))).toBe(true);
});

test("an inaccessible or replaced music directory never triggers cleanup", async () => {
  addTrack("missing.mp3");
  await rename("Music", "Music-unavailable");
  expect((await collect()).some((message) => message.startsWith("Error."))).toBe(true);
  expect(DB.query("SELECT COUNT(*) AS count FROM tracks").get()).toEqual({ count: 1 });
  await rename("Music-unavailable", "Music");
  await addFile("new.mp3");

  const iterator = scan(context());
  expect((await iterator.next()).value).toContain("new.mp3");
  await rename("Music", "Music-original");
  await mkdir("Music");
  const messages: string[] = [];
  for await (const message of iterator) messages.push(message);
  expect(messages.some((message) => message.includes("Music directory changed"))).toBe(true);
  expect(DB.query("SELECT COUNT(*) AS count FROM deletedTracks").get()).toEqual({ count: 0 });
});

test("non-missing filesystem errors do not delete stored tracks", async () => {
  await writeFile("Music/not-a-directory", "file");
  addTrack("not-a-directory/track.mp3");
  const messages = await collect();
  expect(messages.some((message) => message.startsWith("Error."))).toBe(true);
  expect(DB.query("SELECT COUNT(*) AS count FROM tracks").get()).toEqual({ count: 1 });
  expect(DB.query("SELECT operation FROM scanErrors").all()).toEqual([{ operation: "FILE_ACCESS" }]);
});

test("rejects overlapping scans across processes and releases the lock on cancellation", async () => {
  await addFile("track.mp3");
  const first = scan(context());
  await first.next();
  const secondContext = context();
  const second = scan(secondContext);
  try {
    expect((await second.next()).value).toContain("already running");
    expect(secondContext.set.status).toBe(409);
    const { stdout } = await runFile(process.execPath, ["-e", `
      import { mock } from "bun:test";
      mock.module(${JSON.stringify(join(originalDirectory, "index.ts"))}, () => ({ DB: {} }));
      const { default: scan } = await import(${JSON.stringify(join(originalDirectory, "routes/scan.ts"))});
      const context = { set: { headers: {} } };
      for await (const message of scan(context)) {
        console.log(JSON.stringify({ status: context.set.status, message }));
      }
    `], { encoding: "utf8", timeout: 5000, killSignal: "SIGKILL" });
    const conflict = JSON.parse(stdout);
    expect(conflict.status).toBe(409);
    expect(conflict.message).toContain("already running");
  } finally {
    await second.return();
    await first.return();
  }
  expect((await collect()).some((message) => message.includes("track.mp3"))).toBe(true);
});

test("the HTTP route streams scan output and returns 409 for overlapping requests", async () => {
  await addFile("http.mp3");
  const app = new Elysia().get("/scan", scan);
  const response = await app.handle(new Request("http://localhost/scan"));
  expect(response.status).toBe(200);
  expect(await response.text()).toContain("http.mp3");
  expect(DB.query("SELECT path FROM tracks").all()).toEqual([{ path: "http.mp3" }]);
  await mkdir(".music-scan.lock");
  const conflict = await app.handle(new Request("http://localhost/scan"));
  expect(conflict.status).toBe(409);
  expect(await conflict.text()).toContain("already running");
});

test("kills timed-out probes, records the failure, and releases the lock", async () => {
  await addFile("hung.mp3", { mode: "hang" });
  const start = Date.now();
  const messages = await collect();
  expect(Date.now() - start).toBeLessThan(35_000);
  expect(messages.some((message) => message.startsWith("Error."))).toBe(true);
  expect(DB.query("SELECT operation FROM scanErrors").all()).toEqual([{ operation: "METADATA_EXTRACTION" }]);
  const event = JSON.parse((await readFile("probe-events.jsonl", "utf8")).trim());
  expect(() => process.kill(event.pid, 0)).toThrow();
  expect(await stat(".music-scan.lock").catch((error) => error.code)).toBe("ENOENT");
}, 40_000);

for (const format of ["mp3", "flac", "aac", "m4a"]) {
  test.skipIf(!realFfprobe || !realFfmpeg)(`imports metadata from a real ${format.toUpperCase()} using ffprobe`, async () => {
    if (!realFfprobe || !realFfmpeg) throw new Error("FFmpeg tools are required");
    await runFile(realFfmpeg, [
      "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.1",
      "-metadata", "title=Caf\u00e9", `Music/real.${format}`,
    ]);
    useRealProbe = true;
    expect((await collect()).filter((message) => message.startsWith("Error."))).toEqual([]);
    expect(DB.query("SELECT path, format FROM tracks").get()).toEqual({
      path: `real.${format}`,
      format: format === "m4a" ? "mov,mp4,m4a,3gp,3g2,mj2" : format,
    });
    if (format !== "aac") {
      expect(DB.query("SELECT title FROM tracks").get()).toEqual({ title: "Caf\u00e9" });
    }
  });
}
