import { DB } from "..";

export default function libraryCount() {
  return {
    artists: DB.query(
      `SELECT albumArtist FROM tracks WHERE albumArtist IS NOT NULL GROUP BY albumArtist`
    )
      .values()
      .map((artist) => artist[0]).length,
    tracks: DB.query(`SELECT COUNT(id) FROM tracks`).values()[0][0],
    playlists: DB.query(`SELECT COUNT(id) FROM playlists`).values()[0][0],
    plays: DB.query(`SELECT COUNT(id) FROM plays`).values()[0][0],
  };
}
