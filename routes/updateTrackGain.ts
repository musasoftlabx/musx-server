import { execSync } from "child_process";
import { DB } from "..";
import dayjs from "dayjs";

export type TrackGain = {
  error: any;
  query: { trackId: number; path: string; decibels: number };
};

export default function updateTrackGain(params: TrackGain) {
  const {
    error,
    query: { trackId, path, decibels },
  } = params;

  const audioPath = `./Music/${path}`;

  try {
    execSync(`ffmpeg -i ${audioPath} -af "volume=${decibels}dB" ${audioPath}`);
    return DB.exec(`INSERT INTO trackGains VALUES (NULL, ?, ?, NULL, ?)`, [
      trackId,
      decibels,
      dayjs().format("YYYY-MM-DD HH:mm:ss"),
    ]);
  } catch (err: any) {
    return error(404, err.message);
  }
}
