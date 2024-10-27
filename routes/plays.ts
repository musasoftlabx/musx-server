import { DB } from "..";

export const plays = (params: { body: { id: number } }) => {
  console.log("params:", params);
  const { id } = params.body;
  DB.query(`UPDATE directory SET plays = plays + 1 WHERE id = ${id}`).run();
  DB.query(`INSERT INTO plays VALUES (NULL, ${id}, DateTime('now'))`).run();
  return true;
};
