import { DB } from "..";

export const artists = () =>
  DB.query(
    `SELECT albumArtist FROM tracks GROUP BY albumArtist ORDER BY albumArtist`
  ).all();
