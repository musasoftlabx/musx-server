import { DB } from "..";
import { Context } from "elysia";
import { RateTrackBodyProps } from "../types";

export type RateTrack = Pick<Context, "set"> & RateTrackBodyProps;

export default function rateTrack(params: RateTrack) {
  const {
    set,
    body: { id, rating },
  } = params;

  try {
    return DB.run(`UPDATE tracks SET rating = ${rating} WHERE id = ${id}`);
  } catch (err) {
    set.status = 502;
    if (err instanceof Error)
      return {
        subject: "Track rating error",
        body: err.message,
      };
  }
}
