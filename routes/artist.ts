import { DB } from "..";
import byteSize from "byte-size";

import { AUDIO_URL, ARTWORK_URL, WAVEFORM_URL } from "..";

type TParams = { error: any; params: { artist: string } };

export default async function artist(params: TParams) {
  const {
    error,
    params: { artist },
  } = params;

  try {
    const albums = DB.query(
      `SELECT
        album,
        ('${ARTWORK_URL}' || artwork) AS artwork,
        COUNT(album) AS tracks,
        SUM(size) AS size
      FROM tracks
      WHERE albumArtist = ?
      GROUP BY album HAVING COUNT(album) > 1`
    ).all([decodeURIComponent(artist)] as any);

    const singles = DB.query(
      `SELECT 
        id,
        ('${AUDIO_URL}' || path) AS url,
        path, syncDate, title, album, albumArtist, artists, genre, year, track, rating, plays, bitrate, size, duration, format, channels, channelLayout, sampleRate, encoder,
        ('${ARTWORK_URL}' || artwork) AS artwork,
        ('${WAVEFORM_URL}' || waveform) AS waveform,
        palette
      FROM tracks
      WHERE albumArtist = ?
      GROUP BY album HAVING COUNT(album) = 1
      ORDER BY rating DESC, plays DESC`
    ).all([decodeURIComponent(artist)] as any);

    return {
      albums: albums.map((album: any) => ({
        ...album,
        size: `${byteSize(album.size)}`,
      })),
      singles,
    };
  } catch (err: any) {
    return error(500, {
      subject: "Artist Album Retrieval Error",
      body: err.message,
    });
  }
}
