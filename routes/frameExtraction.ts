import { DB } from "..";
import { Glob } from "bun";
import { exec, execSync } from "child_process";
import { existsSync } from "fs";
import { Stream } from "@elysiajs/stream";
import rgbHex from "rgb-hex";
const ColorThief = require("colorthief");

export default async function frameExtraction() {
  let count = 0;
  const glob = new Glob("**/*.mp3");

  const stdout: any = execSync(
    `ffmpeg -i myvideo.avi -vf fps=1/60 img%03d.jpg`
  );
}
