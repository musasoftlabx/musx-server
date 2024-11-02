import { DB } from "..";
import { Lyrics } from "../types";

export default function updateLyrics(params: Lyrics) {
  const { id, lyrics } = params.body;
  return DB.query(`UPDATE tracks SET lyrics = ? WHERE id = ?`).run([
    atob(lyrics),
    id,
  ] as {});
}
