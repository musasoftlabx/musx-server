import { DB } from "..";

export default function updatePlayCount(params: { body: { id: number } }) {
  const { id } = params.body;
  DB.query(`UPDATE tracks SET plays = plays + 1 WHERE id = ${id}`).run();
  DB.query(`INSERT INTO plays VALUES (NULL, ${id}, DateTime('now'))`).run();
  return true;
}
