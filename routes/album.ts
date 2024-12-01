import { DB } from "..";

import { AUDIO_URL, ARTWORK_URL, WAVEFORM_URL } from "..";

type TParams = { error: any; params: { artist: string; album: string } };

export default async function artist(params: TParams) {
  const {
    error,
    params: { artist, album },
  } = params;

  try {
    return DB.query(
      `SELECT
        id,
        ('${AUDIO_URL}' || path) AS url,
        path, syncDate, title, album, albumArtist, artists, genre, year, track, rating, plays, bitrate, size, duration, format, channels, channelLayout, sampleRate, encoder,
        ('${ARTWORK_URL}' || artwork) AS artwork,
        ('${WAVEFORM_URL}' || waveform) AS waveform,
        palette
      FROM tracks
      WHERE albumArtist = ? AND album = ?`
    ).all([decodeURIComponent(artist), decodeURIComponent(album)] as any);
  } catch (err: any) {
    return error(500, {
      subject: "Album Retrieval Error",
      body: err.message,
    });
  }
}
