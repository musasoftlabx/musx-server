import { DB } from "..";

export default function artists() {
  return DB.query(
    `SELECT albumArtist, path, COUNT(albumArtist) AS tracks, SUM(plays) AS plays FROM tracks GROUP BY albumArtist, plays ORDER BY tracks`
    //`SELECT albumArtist, path, COUNT(albumArtist) AS tracks FROM tracks GROUP BY albumArtist ORDER BY tracks LIMIT 10`
  ).all();
}
