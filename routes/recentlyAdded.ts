import { DB } from "..";
import { AUDIO_URL, ARTWORK_URL, WAVEFORM_URL } from "..";

export type RecentlyAdded = {
  set: any;
  error: any;
  query: { limit: string; offset: string };
};

export default function recentlyAdded(params: RecentlyAdded) {
  const {
    error,
    query: { limit, offset },
  } = params;

  try {
    const plays = DB.query(
      `SELECT
        id,
        ('${AUDIO_URL}' || path) url,
        path, syncDate, title, album, albumArtist, artists, genre, year, track, rating, plays, bitrate, size, duration, format, channels, channelLayout, sampleRate, encoder,
        ('${ARTWORK_URL}' || artwork) artwork,
        ('${WAVEFORM_URL}' || waveform) waveform,
        palette
      FROM tracks
      ORDER BY id DESC
      LIMIT ?
      OFFSET ?`
    ).all([Number(limit), Number(offset) * Number(limit)] as {});

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
