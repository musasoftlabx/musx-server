import { DB } from "../";

export const dashboard = () => {
  const mostPlayed = DB.query(
    `SELECT * FROM tracks ORDER BY plays DESC LIMIT 10`
  ).all();

  const recentlyAdded = DB.query(
    `SELECT * FROM tracks ORDER BY id DESC LIMIT 10`
  ).all();

  const recentlyPlayed = DB.query(
    `SELECT trackId AS id, path, title, albumArtist, artists, genre, year, track, rating, plays, bitrate, size, duration, format, channels, channelLayout, sampleRate, encoder, artwork, waveform, palette, playedOn
     FROM plays
     INNER JOIN tracks
     ON plays.trackId = tracks.id
     GROUP BY trackId
     ORDER BY plays.id DESC
     LIMIT 10`
  ).all();

  const favouriteArtists = DB.query(
    `SELECT path, albumArtist, (AVG(rating) + AVG(plays)) AS rating FROM tracks GROUP BY albumArtist ORDER BY rating DESC LIMIT 10`
  ).all();

  return { favouriteArtists, recentlyAdded, recentlyPlayed, mostPlayed };
};
