import { DB } from "..";
import { AUDIO_URL, ARTWORK_URL, WAVEFORM_URL } from "..";

import dayjs from "dayjs";

export type MostPlayed = {
  set: any;
  error: any;
  query: { limit: string; offset: string };
};

export default function mostPlayed(params: MostPlayed) {
  const {
    error,
    query: { limit, offset },
  } = params;

  try {
    const plays = DB.query(
      `SELECT
        DISTINCT trackId id,
        ('${AUDIO_URL}' || path) url,
        path, title, albumArtist, artists, genre, year, track, rating, plays, bitrate, size, duration, format, channels, channelLayout, sampleRate, encoder,
        ('${ARTWORK_URL}' || artwork) artwork,
        ('${WAVEFORM_URL}' || waveform) waveform,
        palette
      FROM plays
      INNER JOIN tracks
      ON plays.trackId = tracks.id
      WHERE STRFTIME("%Y%m", playedOn) = ?
      ORDER BY plays.id DESC
      LIMIT ?
      OFFSET ?`
    ).all([
      dayjs().format("YYYYMM"),
      Number(limit),
      Number(offset) * Number(limit),
    ] as {});

    return {
      count: DB.query(`SELECT COUNT(id) FROM tracks`).values()[0][0],
      plays,
    };
  } catch (err: any) {
    return error(500, { subject: "Retrieval Error", body: err.message });
  }
}
