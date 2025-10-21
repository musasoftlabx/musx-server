import { DB } from "..";
import { Context } from "elysia";
import { AddPlaylistTrackBodyProps } from "../types";

export type AddPlaylistTrack = Pick<Context, "set"> & AddPlaylistTrackBodyProps;

export default async function addPlaylistTrack(params: AddPlaylistTrack) {
  const {
    set,
    body: { playlistId, trackId, startsAt, endsAt },
  } = params;

  const tracksCount = DB.query(
    `SELECT MAX(position) FROM playlistTracks WHERE playlistId = ${playlistId}`
  ).values();

  const position = Number(tracksCount[0][0]) + 1;

  try {
    return DB.run(
      `INSERT INTO playlistTracks
       VALUES (NULL, ${playlistId}, ${trackId}, ${position}, ${
        startsAt ?? null
      }, ${endsAt ?? null}, DateTime('now'))`
    );
  } catch (err) {
    set.status = 502;
    if (err instanceof Error)
      return {
        subject: "Playlist track insertion error",
        body: err.message,
      };
  }
}
