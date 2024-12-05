import { DB } from "..";
import { AUDIO_URL, ARTWORK_URL, WAVEFORM_URL } from "..";

export type RecentlyPlayed = {
  set: any;
  error: any;
  query: { pluck: string; startAt: string };
};

export default async function recentlyPlayed(params: RecentlyPlayed) {
  const {
    error,
    query: { pluck, startAt },
  } = params;

  const limit = Number(pluck);
  const offset = Number(startAt) - 1;

  try {
    return DB.query(
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
      OFFSET ?`
    ).all([limit, offset] as {});
  } catch (err: any) {
    return error(500, { subject: "Retrieval Error", body: err.message });
  }
}
