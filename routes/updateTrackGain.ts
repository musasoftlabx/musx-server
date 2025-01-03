import { execSync } from "child_process";
import { DB } from "..";
import dayjs from "dayjs";

export type TrackGain = {
  error: any;
  params: { body: { trackId: number; path: string; decibels: number } };
};

export default function updateTrackGain(params: TrackGain) {
  const {
    error,
    params: {
      body: { trackId, path, decibels },
    },
  } = params;

  console.log(params);

  const audioPath = `./Music/${path}`;

  try {
    execSync(`ffmpeg -i ${audioPath} -af "volume=${decibels}dB" ${audioPath}`);
    return params;
    // return DB.exec(`INSERT INTO trackGains VALUES (NULL, ?, ?, NULL, ?)`, [
    //   trackId,
    //   decibels,
    //   dayjs().format("YYYY-MM-DD HH:mm:ss"),
    // ]);
  } catch (err: any) {
    return error(404, err.message);
  }
}