import { DB } from "..";
import { execSync } from "child_process";
import dayjs from "dayjs";
import { renameSync, unlinkSync } from "fs";

export type TrackGain = {
  error: any;
  body: { trackId: number; path: string; decibels: number };
};

export default function updateTrackGain(params: TrackGain) {
  const {
    error,
    body: { trackId, path, decibels },
  } = params;

  const trackPath = `./Music/${path}`;
  const trackPathTemp = `./Music/${path.replace(`.mp3`, "_.mp3")}`;
  const waveformPath = `./Waveform/${path
    .replace(`.mp3`, "")
    .replace(/[^a-zA-Z0-9]/g, "_")}.png`;

  try {
    // ? Adjust the track gain
    execSync(
      `ffmpeg \
      -y \
      -i "${trackPath}" \
      -af "volume=${decibels}dB" \
      -b:a 320k \
      -id3v2_version 3 \
      -map 0:0 \
      -map 0:1 \
      "${trackPathTemp}"`
    );

    // ? Regenerate the waveform
    execSync(
      `ffmpeg \
      -y \
      -i "${trackPathTemp}" \
      -filter_complex showwavespic \
      -frames:v 1 "${waveformPath}"`
    );

    // ? Delete the original track
    unlinkSync(trackPath);

    // ? Rename the temporary track
    renameSync(trackPathTemp, trackPath);

    // ? Save adjusted track to DB
    return DB.exec(`INSERT INTO trackGains VALUES (NULL, ?, ?, NULL, ?)`, [
      trackId,
      decibels,
      dayjs().format("YYYY-MM-DD HH:mm:ss"),
    ]);
  } catch (err: any) {
    return error(404, err.message);
  }
}
