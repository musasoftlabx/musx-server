import { DB } from "../";

export const dashboard = () => {
  const mostPlayed = DB.query(
    `SELECT * FROM tracks ORDER BY plays DESC LIMIT 10`
  ).all();

  const recentlyAdded = DB.query(
    `SELECT * FROM tracks ORDER BY id DESC LIMIT 10`
  ).all();

  const recentlyPlayed = DB.query(
    `SELECT DISTINCT path, trackId, title, albumArtist, artists, genre, year, track, rating, plays, bitrate, size, duration, format, channels, channelLayout, sampleRate, encoder, artwork, waveform, palette, playedOn
     FROM plays
     INNER JOIN tracks
     ON plays.trackId = tracks.id
     ORDER BY plays.id DESC
     LIMIT 10`
  ).all();

  const favouriteArtists = DB.query(
    `SELECT path, albumArtist, (AVG(rating) + AVG(plays)) AS standing FROM tracks GROUP BY albumArtist ORDER BY standing DESC LIMIT 10`
  ).all();

  return { mostPlayed, recentlyAdded, recentlyPlayed, favouriteArtists };
};
