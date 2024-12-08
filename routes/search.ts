import { DB } from "..";
import { AUDIO_URL, ARTWORK_URL, WAVEFORM_URL } from "..";

import dayjs from "dayjs";

export type Search = { set: any; error: any; query: { query: string } };

export default async function search(params: Search) {
  const {
    error,
    query: { query },
  } = params;

  try {
    const results = DB.query(
      `SELECT
        id,
        ('${AUDIO_URL}' || path) AS url,
        path, syncDate, title, album, albumArtist, artists, genre, year, track, rating, plays, bitrate, size, duration, format, channels, channelLayout, sampleRate, encoder,
        ('${ARTWORK_URL}' || artwork) AS artwork,
        ('${WAVEFORM_URL}' || waveform) AS waveform,
        palette
      FROM tracks
      WHERE (title || " " || albumArtist || " " || artists || " " || album) LIKE ?
      LIMIT 20`
    ).all([`%${decodeURIComponent(query)}%`] as {});

    // ? Insert into searches
    DB.exec(`INSERT INTO searchHistory VALUES (NULL, ?, ?)`, [
      query,
      dayjs().format("YYYY-MM-DD HH:mm:ss"),
    ]);

    return {
      tracks: results,
      artists: [], //results.filter((result)=>result.albumArtist === )
      albums: [],
    };
  } catch (err: any) {
    return error(500, { subject: "Search Error", body: err.message });
  }
}
