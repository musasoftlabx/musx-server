import { DB } from "..";
import { RateTrack } from "../types";

export default function rateTrack(params: RateTrack) {
  const { id, rating } = params.body;
  return DB.query(
    `UPDATE tracks SET rating = ${rating} WHERE id = ${id}`
  ).run();
}
