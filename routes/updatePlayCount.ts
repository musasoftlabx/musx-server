import { DB } from "..";
import { PlayCount } from "../types";

export default function updatePlayCount(params: PlayCount) {
  const { id } = params.body;
  DB.query(`UPDATE tracks SET plays = plays + 1 WHERE id = ${id}`).run();
  DB.query(`INSERT INTO plays VALUES (NULL, ${id}, DateTime('now'))`).run();
  return true;
}
