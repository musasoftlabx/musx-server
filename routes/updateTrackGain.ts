import { execSync } from "child_process";
import { DB } from "..";
import dayjs from "dayjs";

export type TrackGain = {
  error: any;
  body: { trackId: number; path: string; decibels: number };
};

export default function updateTrackGain(params: TrackGain) {
  const {
    error,
    body: { trackId, path, decibels },
  } = params;

  const audioPath = `./Music/${path}`;

  try {
    execSync(
      `ffmpeg -i "${audioPath}" -codec:a mp3 -af "volume=${decibels}dB" "${audioPath}"`
    );
    return params.body;
    // return DB.exec(`INSERT INTO trackGains VALUES (NULL, ?, ?, NULL, ?)`, [
    //   trackId,
    //   decibels,
    //   dayjs().format("YYYY-MM-DD HH:mm:ss"),
    // ]);
  } catch (err: any) {
    return error(404, err.message);
  }
}
