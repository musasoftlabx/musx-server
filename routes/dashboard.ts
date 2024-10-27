import { DB } from "../";

export const dashboard = () => {
  const mostPlayed = DB.query(
    `SELECT id, path, title, rating, plays, artists, artwork FROM directory ORDER BY plays DESC LIMIT 10`
  ).all();

  const recentlyAdded = DB.query(
    `SELECT id, path, title, rating, plays, artists, artwork FROM directory ORDER BY id DESC LIMIT 10`
  ).all();

  const recentlyPlayed = DB.query(
    `SELECT DISTINCT path, title, rating, plays, artists, albumArtist, artwork
     FROM plays
     INNER JOIN directory
     ON plays.directoryId = directory.id
     ORDER BY plays.id DESC
     LIMIT 10`
  ).all();

  const favoriteArtists = DB.query(
    `SELECT albumArtist, SUM(rating) AS cumulativeRating FROM directory GROUP BY albumArtist ORDER BY cumulativeRating DESC LIMIT 10`
  ).all();

  return { mostPlayed, recentlyAdded, recentlyPlayed, favoriteArtists };
};
