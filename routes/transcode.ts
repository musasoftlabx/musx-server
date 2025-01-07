import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { emptyDirSync } from "fs-extra";

export type Transcode = {
  error: any;
  query: { trackId: number; path: string; duration: number; bitrate: string };
};

export default async function transcode(params: Transcode) {
  const {
    error,
    query: { trackId, path, duration, bitrate },
  } = params;

  const transcodeDir = "Transcodes";
  const mp3Path = `Music/${path}`;
  const transcodeHeaderFile = `${transcodeDir}/${path
    .split("/")
    .slice(-1)}`.replace(".mp3", ".m3u8");
  const conversion =
    bitrate === "Max" ? "-codec: copy" : `-b:a ${Number(bitrate)}k`;

  // ? Check if Transcodes directory exists. If not create it
  !existsSync(transcodeDir) && mkdirSync(transcodeDir, { recursive: true });

  // ? Empty the directory
  emptyDirSync(`${transcodeDir}`);

  try {
    // ? Convert into HLS chunks
    execSync(`ffmpeg -i "${mp3Path}" \
              -map 0:a \
              ${conversion} \
              -hls_time 1 \
              -hls_flags independent_segments \
              -hls_segment_filename ${transcodeDir}/${trackId}%03d.ts \
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

// execSync(`ffmpeg -i "${mp3Path}" -strict -2 "${oggPath}"`); // * Convert to single file
// -map 0:a \ // ? Selects the first stream from the input file (first stream is audio, second is album art)
// -preset veryfast \ // ? Encoding preset which determines the trade-off between encoding speed and compression efficiency. The medium preset is a balance between speed and compression. Other presets include veryslow, slow, fast, veryfast
// -hls_time 1 \ // ? Duration of each segment in the HLS playlist. In this case, each segment will be 1 second long.
// -f hls // ? Format of the output file, which in this case is HLS (HTTP Live Streaming).
// -hls_segment_filename ${transcodeDir}/stream_%v/data%03d.ts \ // ? Specifies the filename and chunks file names
// -codec: copy \ // ? Will preserve the video & audio codecs of the original
// -b:a 64k \ // ? Set bitrate to 64kbps
// -c:a libopus // ? Specify encoder
// libvorbis libopus libmp3lame // ? Encoders
