import { afterAll, afterEach, beforeEach, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import { Elysia, type Context } from "elysia";
import * as childProcess from "node:child_process";
import type { ExecFileOptionsWithStringEncoding } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const DB = new Database(":memory:");
const runFile = promisify(childProcess.execFile);
const originalDirectory = process.cwd();
const realFfmpeg = Bun.which("ffmpeg");
let directory: string;
let useRealFfmpeg = false;
let shortenTimeout = false;

const fixtureExecFile = Object.assign(
  () => { throw new Error("Use the promisified subprocess interface"); },
  {
    [promisify.custom]: (
      file: string,
      args: string[],
      options: ExecFileOptionsWithStringEncoding,
    ) => {
      if (file !== "ffmpeg" || useRealFfmpeg) return runFile(file, args, options);
      if (shortenTimeout) {
        expect(options.timeout).toBe(5 * 60_000);
      }
      return runFile(
        process.execPath,
        [join(directory, "fake-ffmpeg.ts"), ...args],
        { ...options, timeout: shortenTimeout ? 200 : options.timeout },
      );
    },
  },
);
mock.module("node:child_process", () => ({
  ...childProcess,
  execFile: fixtureExecFile,
}));
mock.module("../index", () => ({ DB }));
const { default: scan } = await import("./scan-waveforms");

const fakeFfmpeg = `
import { appendFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const input = args[args.indexOf("-i") + 1];
const output = args.at(-1);
const plan = await Bun.file(input).json();
const event = kind => appendFileSync("events.jsonl", JSON.stringify({kind, input, output, pid: process.pid}) + "\\n");
event("start");
writeFileSync(output, "partial");
if (plan.mode === "hang") setInterval(() => {}, 1000);
else {
  await Bun.sleep(plan.delay ?? 60);
  event("end");
  if (plan.mode === "fail") {
    console.error("fixture decoding failure");
    process.exit(1);
  }
  writeFileSync(output, plan.mode === "empty" ? "" : "complete");
}
`;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "musx-waveforms-test-"));
  process.chdir(directory);
  await Promise.all(["Music", "Waveform"].map((path) => mkdir(path)));
  await writeFile("fake-ffmpeg.ts", fakeFfmpeg);
  useRealFfmpeg = false;
  shortenTimeout = false;
  DB.exec(`
    DROP TABLE IF EXISTS tracks;
    DROP TABLE IF EXISTS scanErrors;
    CREATE TABLE tracks (path TEXT, waveform TEXT);
    CREATE TABLE scanErrors (
      id INTEGER PRIMARY KEY, track TEXT, operation TEXT, error TEXT, scannedOn TEXT
    );
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

async function addTrack(path: string, waveform: string | null, plan: object = {}) {
  await writeFile(join("Music", path), JSON.stringify(plan));
  DB.query("INSERT INTO tracks (path, waveform) VALUES (?, ?)").run(path, waveform);
}

async function collect() {
  const messages: string[] = [];
  for await (const message of scan(context())) messages.push(message);
  return messages;
}

interface Event {
  kind: "start" | "end";
  input: string;
  output: string;
  pid: number;
}

async function events(): Promise<Event[]> {
  return (await readFile("events.jsonl", "utf8"))
    .trim().split("\n").map((line) => JSON.parse(line));
}

test("keeps two workers busy, skips completed outputs and preserves shell-special filenames", async () => {
  await addTrack('slow "$`\' track.flac', "slow.png", { delay: 500 });
  await addTrack("fast.aac", "fast.png");
  await addTrack("third.m4a", "third.png");
  await addTrack("existing.mp3", "existing.png", { mode: "fail" });
  await writeFile("Waveform/existing.png", "unchanged");
  let ticks = 0;
  const timer = setInterval(() => ticks++, 5);
  let messages: string[];
  try {
    messages = await collect();
  } finally {
    clearInterval(timer);
  }
  expect(messages).toHaveLength(3);
  expect(messages.some((message) => message.includes("existing.mp3"))).toBe(false);
  expect(messages.some((message) => message.startsWith("Error."))).toBe(false);
  expect(ticks).toBeGreaterThan(2);
  expect(await readFile("Waveform/existing.png", "utf8")).toBe("unchanged");
  for (const name of ["slow", "fast", "third"]) {
    expect(await readFile(`Waveform/${name}.png`, "utf8")).toBe("complete");
  }
  const log = await events();
  let active = 0;
  let maximum = 0;
  for (const entry of log) {
    active += entry.kind === "start" ? 1 : -1;
    maximum = Math.max(maximum, active);
  }
  expect(maximum).toBe(2);
  expect(active).toBe(0);
  expect(log.findIndex((entry) => entry.kind === "start" && entry.input.endsWith("third.m4a")))
    .toBeLessThan(log.findIndex((entry) => entry.kind === "end" && entry.input.includes("slow")));
  expect(await collect()).toEqual([]);
  expect(await events()).toEqual(log);
  expect((await readdir("Waveform")).some((path) => path.startsWith(".waveform-"))).toBe(false);
});

test("records decoding and empty-output errors, cleans temporary files and retries failures", async () => {
  await addTrack("bad.mp3", "bad.png", { mode: "fail" });
  await addTrack("empty.mp3", "empty.png", { mode: "empty" });
  await addTrack("good.mp3", "good.png");
  const messages = await collect();
  expect(messages.filter((message) => message.startsWith("Error."))).toHaveLength(2);
  expect(DB.query<{ error: string }, []>("SELECT error FROM scanErrors").all()
    .some((row) => row.error.includes("fixture decoding failure"))).toBe(true);
  expect(await readdir("Waveform")).toEqual(["good.png"]);
  await writeFile("Music/bad.mp3", "{}");
  await writeFile("Music/empty.mp3", "{}");
  expect((await collect()).filter((message) => message.startsWith("Error."))).toEqual([]);
  expect((await readdir("Waveform")).sort()).toEqual(["bad.png", "empty.png", "good.png"]);
});

test("kills timed-out FFmpeg processes and never publishes their partial output", async () => {
  shortenTimeout = true;
  await addTrack("hung.mp3", "hung.png", { mode: "hang" });
  const start = Date.now();
  const messages = await collect();
  expect(Date.now() - start).toBeLessThan(2000);
  expect(messages.filter((message) => message.startsWith("Error."))).toHaveLength(1);
  expect(DB.query("SELECT operation FROM scanErrors").all()).toEqual([
    { operation: "WAVEFORM_EXTRACTION" },
  ]);
  expect(await readdir("Waveform")).toEqual([]);
  const [entry] = await events();
  expect(() => process.kill(entry.pid, 0)).toThrow();
  expect(await access(".waveform-scan.lock").then(() => true, () => false)).toBe(false);
});

test("cancellation kills active workers, removes partial files and releases the cross-process lock", async () => {
  await addTrack("first.mp3", "first.png", { mode: "hang" });
  await addTrack("second.mp3", "second.png", { mode: "hang" });
  const iterator = scan(context());
  try {
    await iterator.next();
    await iterator.next();
    // The first worker is running while the second progress message is yielded.
    let started: Event[] = [];
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await readdir("Waveform")).length) {
        started = await events();
        break;
      }
      await Bun.sleep(10);
    }
    expect(started).toHaveLength(1);
    expect(await readFile(started[0].output, "utf8")).toBe("partial");
    expect(await access("Waveform/first.png").then(() => true, () => false)).toBe(false);

    const { stdout } = await runFile(process.execPath, ["-e", `
      import { mock } from "bun:test";
      mock.module(${JSON.stringify(join(originalDirectory, "index.ts"))}, () => ({ DB: {} }));
      const { default: scan } = await import(${JSON.stringify(join(originalDirectory, "routes/scan-waveforms.ts"))});
      const context = { set: { headers: {} } };
      for await (const message of scan(context)) console.log(JSON.stringify({status: context.set.status, message}));
    `], { encoding: "utf8", timeout: 5000, killSignal: "SIGKILL" });
    expect(JSON.parse(stdout).status).toBe(409);
  } finally {
    await iterator.return();
  }
  const [entry] = await events();
  expect(() => process.kill(entry.pid, 0)).toThrow();
  expect(await readdir("Waveform")).toEqual([]);
  expect(await access(".waveform-scan.lock").then(() => true, () => false)).toBe(false);
});

test("handles shared outputs once and reports missing waveform names", async () => {
  await addTrack("one.mp3", "shared.png");
  await addTrack("two.mp3", "shared.png");
  await addTrack("unnamed.mp3", null);
  const messages = await collect();
  expect(messages.filter((message) => /^\d+\./.test(message))).toHaveLength(1);
  expect(messages.filter((message) => message.startsWith("Error."))).toHaveLength(1);
  expect((await events()).filter((entry) => entry.kind === "start")).toHaveLength(1);
});

test("HTTP requests stream pending files and return 409 while the lock is held", async () => {
  await addTrack("http.mp3", "http.png");
  const app = new Elysia().get("/scan-waveforms", scan);
  const response = await app.handle(new Request("http://localhost/scan-waveforms"));
  expect(response.status).toBe(200);
  expect(await response.text()).toContain("http.mp3");
  expect(await readFile("Waveform/http.png", "utf8")).toBe("complete");
  await mkdir(".waveform-scan.lock");
  const conflict = await app.handle(new Request("http://localhost/scan-waveforms"));
  expect(conflict.status).toBe(409);
  expect(await conflict.text()).toContain("already running");
});

test.skipIf(!realFfmpeg)("generates complete 600x240 PNG and JPEG files using real FFmpeg", async () => {
  if (!realFfmpeg) throw new Error("FFmpeg is required");
  await runFile(realFfmpeg, [
    "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.1",
    "Music/real.wav",
  ]);
  DB.query("INSERT INTO tracks (path, waveform) VALUES (?, ?)").run("real.wav", "real.png");
  DB.query("INSERT INTO tracks (path, waveform) VALUES (?, ?)").run("real.wav", "legacy.jpg");
  useRealFfmpeg = true;
  expect((await collect()).filter((message) => message.startsWith("Error."))).toEqual([]);
  const png = await readFile("Waveform/real.png");
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(600);
  expect(png.readUInt32BE(20)).toBe(240);
  expect((await readFile("Waveform/legacy.jpg")).subarray(0, 2).toString("hex")).toBe("ffd8");
  expect((await readdir("Waveform")).sort()).toEqual(["legacy.jpg", "real.png"]);
});
