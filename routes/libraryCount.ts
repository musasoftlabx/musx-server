import { DB } from "..";

export default function libraryCount() {
  return {
    artists: DB.query(`SELECT COUNT(albumArtist) FROM tracks`).values()[0][0],
    tracks: DB.query(`SELECT COUNT(id) FROM tracks`).values()[0][0],
    playlists: DB.query(`SELECT COUNT(id) FROM playlists`).values()[0][0],
  };
}
