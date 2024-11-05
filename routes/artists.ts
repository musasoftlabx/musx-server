import { DB } from "..";

export default function artists() {
  return DB.query(
    `SELECT albumArtist, COUNT(id) AS tracks FROM tracks GROUP BY albumArtist ORDER BY tracks`
  ).all();
}
