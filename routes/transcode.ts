import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { emptyDirSync } from "fs-extra";

export type Transcode = { query: { path: string } };

export default async function transcode(params: Transcode) {
  const {
    query: { path },
  } = params;

  const transcodeDir = "Transcodes";
  const mp3Path = `Music/${path}`;
  const oggPath = `${transcodeDir}/${path.split("/").slice(-1)}`.replace(
    ".mp3",
    ".opus"
  );

  // ? Check if Transcodes directory exists. If not create it
  !existsSync(transcodeDir) && mkdirSync(transcodeDir, { recursive: true });
  // ? Empty the directory
  emptyDirSync(`${transcodeDir}`);

  try {
    // ? Convert the track and store it in the directory
    //execSync(`ffmpeg -i "${mp3Path}" -strict -2 "${oggPath}"`);
    //execSync(`ffmpeg -i "${mp3Path}" -strict -2 "${oggPath}"`);
    // ? Send file to client
    console.log(oggPath);
    return Bun.file(oggPath);
  } catch (err: any) {
    return err.message;
  }
}
//-c:a libopus -b:a 64k
//libvorbis libopus libmp3lame
