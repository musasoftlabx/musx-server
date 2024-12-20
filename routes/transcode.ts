import { SERVER_URL } from "./../../../mobile/musx/app/store";
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
  const transcodeURL = `${SERVER_URL}${transcodeDir}/${path
    .split("/")
    .slice(-1)}`.replace(".mp3", ".m3u8");

  // ? Check if Transcodes directory exists. If not create it
  !existsSync(transcodeDir) && mkdirSync(transcodeDir, { recursive: true });
  // ? Empty the directory
  emptyDirSync(`${transcodeDir}`);

  try {
    // ? Convert the track and store it in the directory
    //execSync(`ffmpeg -i "${mp3Path}" -strict -2 "${oggPath}"`);
    execSync(`ffmpeg -i "${mp3Path}" \
              -map 0:a \
              -codec: copy \
              -hls_time 1 \
              -hls_flags independent_segments \
              -hls_segment_filename ${transcodeDir}/data%03d.ts \
              -hls_list_size 180 \
              -f hls \
              "${transcodeURL}"
            `);
    //-hls_segment_filename ${transcodeDir}/stream_%v/data%03d.ts \
    // ? Send file to client
    return;
  } catch (err: any) {
    return err.message;
  }
}
//-c:a libopus -b:a 64k
//libvorbis libopus libmp3lame
