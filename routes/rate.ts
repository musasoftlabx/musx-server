import { DB } from "..";

export const rate = (params: { body: { id: number; rating: number } }) => {
  const { id, rating } = params.body;
  return DB.query(
    `UPDATE directory SET rating = ${rating} WHERE id = ${id}`
  ).run();
};
