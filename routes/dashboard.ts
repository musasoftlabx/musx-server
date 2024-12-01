import { DB } from "../";
import libraryCount from "./libraryCount";

import { AUDIO_URL, ARTWORK_URL, WAVEFORM_URL } from "..";

export default function dashboard() {
  const mostPlayed = DB.query(
    `SELECT
      id,
      ('${AUDIO_URL}' || path) url,
      path, syncDate, title, album, albumArtist, artists, genre, year, track, rating, plays, bitrate, size, duration, format, channels, channelLayout, sampleRate, encoder,
      ('${ARTWORK_URL}' || artwork) artwork,
      ('${WAVEFORM_URL}' || waveform) waveform,
      palette
    FROM tracks
    ORDER BY plays DESC
    LIMIT 10`
  ).all();

  const recentlyAdded = DB.query(
    `SELECT
      id,
      ('${AUDIO_URL}' || path) url,
      path, syncDate, title, album, albumArtist, artists, genre, year, track, rating, plays, bitrate, size, duration, format, channels, channelLayout, sampleRate, encoder,
      ('${ARTWORK_URL}' || artwork) artwork,
      ('${WAVEFORM_URL}' || waveform) waveform,
      palette
    FROM tracks
    ORDER BY id DESC
    LIMIT 20`
  ).all();

  const recentlyPlayed = DB.query(
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
  ).all();

  const favouriteArtists = <{ albumArtist: string; genre: string }[]>DB.query(
    `SELECT ('${AUDIO_URL}' || path) url,
     path, genre, albumArtist, (AVG(rating) + AVG(plays)) rating, COUNT(path) tracks
     FROM tracks
     GROUP BY albumArtist
     ORDER BY rating DESC
     LIMIT 20`
  ).all();

  return {
    favouriteArtists: favouriteArtists.map((artist) => {
      if (artist.albumArtist?.includes("Various"))
        return {
          ...artist,
          artworks: DB.query(
            `SELECT
               ('${ARTWORK_URL}' || artwork) artwork
               FROM tracks
               WHERE path LIKE "%Various Artists (${artist.genre})%"
               LIMIT 4`
          )
            .all()
            .map(({ artwork }: any) => artwork),
        };
      else return artist;
    }),
    recentlyAdded,
    recentlyPlayed,
    // //recentlyPlayed: [...new Set(recentlyPlayed)],
    mostPlayed,
    stats: libraryCount(),
  };
}
