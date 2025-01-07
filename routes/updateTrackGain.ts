import { DB } from "..";
import { execSync } from "child_process";
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

  const trackPath = `./Music/${path}`;
  const waveformPath = `./Waveform/${path
    .replace(`.mp3`, "")
    .replace(/[^a-zA-Z0-9]/g, "_")}.png`;

  const tp2 = "./Music/Uganda/Various Artists (Uganda)/Tattoo2.mp3";
  console.log(waveformPath);

  try {
    // ? Adjust the track gain
    execSync(
      `ffmpeg \
      -i "${trackPath}" \
      -af "volume=${decibels}dB" \
      "${tp2}"`
    );

    // ? Regenerate the waveform
    execSync(
      `ffmpeg \
      -y -i "${trackPath}" \
      -filter_complex showwavespic \
      -frames:v 1 "${waveformPath}"`
    );

    // ? Save adjusted track to DB
    // return DB.exec(`INSERT INTO trackGains VALUES (NULL, ?, ?, NULL, ?)`, [
    //   trackId,
    //   decibels,
    //   dayjs().format("YYYY-MM-DD HH:mm:ss"),
    // ]);
  } catch (err: any) {
    return error(404, err.message);
  }
}
