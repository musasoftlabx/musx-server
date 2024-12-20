import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { emptyDirSync } from "fs-extra";

export type Transcode = {
  error: any;
  query: { path: string; duration: number; bitrate: number };
};

export default async function transcode(params: Transcode) {
  const {
    error,
    query: { path, duration, bitrate },
  } = params;

  const transcodeDir = "Transcodes";
  const mp3Path = `Music/${path}`;
  const transcodeHeaderFile = `${transcodeDir}/${path
    .split("/")
    .slice(-1)}`.replace(".mp3", ".m3u8");

  // ? Check if Transcodes directory exists. If not create it
  !existsSync(transcodeDir) && mkdirSync(transcodeDir, { recursive: true });

  // ? Empty the directory
  emptyDirSync(`${transcodeDir}`);

  try {
    // ? Convert into HLS chunks
    execSync(`ffmpeg -i "${mp3Path}" \
              -map 0:a \
              -b:a ${bitrate}k \
              -hls_time 1 \
              -hls_flags independent_segments \
              -hls_segment_filename ${transcodeDir}/chunk%03d.ts \
              -hls_list_size ${duration} \
              -f hls \
              "${transcodeHeaderFile}"
            `);
    // ? Show file contents to client
    return Bun.file(transcodeHeaderFile);
  } catch (err: any) {
    return error(502, err.message);
  }
}

// ? Convert to single file
//execSync(`ffmpeg -i "${mp3Path}" -strict -2 "${oggPath}"`);

//-hls_segment_filename ${transcodeDir}/stream_%v/data%03d.ts \
// -codec: copy \
//-c:a libopus -b:a 64k
//libvorbis libopus libmp3lame
