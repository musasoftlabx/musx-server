import { DB } from "..";

export default function rateTrack(params: {
  body: { id: number; rating: number };
}) {
  const { id, rating } = params.body;
  return DB.query(
    `UPDATE tracks SET rating = ${rating} WHERE id = ${id}`
  ).run();
}
