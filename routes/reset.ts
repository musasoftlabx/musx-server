import { readdirSync } from "fs";
import { emptydirSync, removeSync } from "fs-extra";

export default async function reset() {
  emptydirSync("./Artwork");
  emptydirSync("./Waveform");
  removeSync("./musx.db");
  return readdirSync("./").sort();
}
