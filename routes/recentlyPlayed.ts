import { DB } from "..";
import { AUDIO_URL, ARTWORK_URL, WAVEFORM_URL } from "..";

export type RecentlyPlayed = {
  set: any;
  error: any;
  query: { limit: string; from: string; to: string };
};

export default async function recentlyPlayed(params: RecentlyPlayed) {
  const {
    error,
    query: { limit, from, to },
  } = params;

  const _limit = Number(limit);
  const _from = Number(from);
  const _to = Number(to);

  console.log(_limit, _from, _to);

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
      ORDER BY plays.id DESC
      LIMIT ?
      OFFSET ?, ?`
    ).all([_limit, _from, _to] as {});

    return {
      count: DB.query(
        `SELECT COUNT(DISTINCT trackId) FROM plays`
      ).values()[0][0],
      plays,
    };
  } catch (err: any) {
    return error(500, { subject: "Retrieval Error", body: err.message });
  }
}
