import { DB } from "../";

export const dashboard = () => {
  const mostPlayed = DB.query(
    `SELECT id, path, title, rating, plays, artists, artwork FROM tracks ORDER BY plays DESC LIMIT 10`
  ).all();

  const recentlyAdded = DB.query(
    `SELECT id, path, title, rating, plays, artists, artwork FROM tracks ORDER BY id DESC LIMIT 10`
  ).all();

  const recentlyPlayed = DB.query(
    `SELECT DISTINCT path, title, rating, plays, artists, albumArtist, artwork
     FROM plays
     INNER JOIN tracks
     ON plays.trackId = tracks.id
     ORDER BY plays.id DESC
     LIMIT 10`
  ).all();

  const favoriteArtists = DB.query(
    `SELECT albumArtist, SUM(rating) AS cumulativeRating FROM tracks GROUP BY albumArtist ORDER BY cumulativeRating DESC LIMIT 10`
  ).all();

  return { mostPlayed, recentlyAdded, recentlyPlayed, favoriteArtists };
};
