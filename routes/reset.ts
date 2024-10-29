import { exec } from "child_process";
import { readdirSync } from "fs";
import { emptydirSync, removeSync } from "fs-extra";

export default async function reset() {
  emptydirSync("./Artwork");
  emptydirSync("./Waveform");
  removeSync("./musx.db");
  exec(`pm2 restart index`);
  return readdirSync("./").sort();
}
