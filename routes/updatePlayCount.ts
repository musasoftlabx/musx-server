import { DB } from "..";
import { PlayCount } from "../types";

export default function updatePlayCount(params: PlayCount) {
  const {
    error,
    body: { id },
  } = params;

  try {
    DB.query(`UPDATE tracks SET plays = plays + 1 WHERE id = ${id}`).run();
    DB.query(`INSERT INTO plays VALUES (NULL, ${id}, DateTime('now'))`).run();
    return DB.query(`SELECT plays FROM tracks WHERE id = ${id}`).get();
  } catch (err: any) {
    return error(500, { subject: "Update Error", body: err.message });
  }
}
