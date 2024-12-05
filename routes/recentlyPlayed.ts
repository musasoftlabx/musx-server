import { DB } from "..";
import { AUDIO_URL, ARTWORK_URL, WAVEFORM_URL } from "..";

type TParams = { set: any; error: any; params: { offset: number } };

export default async function recentlyPlayed(params: TParams) {
  const {
    error,
    params: { offset },
  } = params;

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
      LIMIT 20`
    ).all([offset] as {});
  } catch (err: any) {
    return error(500, { subject: "Retrieval Error", body: err.message });
  }
}
