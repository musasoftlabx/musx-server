import { DB } from "..";

export const rate = (params) => {
  const { id, rating } = params.body;
  return DB.query(
    `UPDATE directory SET rating = ${rating} WHERE id = ${id}`
  ).run();
};
