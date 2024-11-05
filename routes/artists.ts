import { DB } from "..";

export default function artists() {
  DB.query(
    `SELECT albumArtist FROM tracks GROUP BY albumArtist ORDER BY albumArtist`
  ).all();
}
