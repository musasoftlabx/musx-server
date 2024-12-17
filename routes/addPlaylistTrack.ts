import { DB } from "..";

type TParams = { body: any; set: any; error: any };

export default async function addPlaylistTrack(params: TParams) {
  const { body, set, error } = params;
  const { playlistId, trackId, startsAt, endsAt } = body;

  const _tracksCount = DB.query(
    `SELECT position FROM playlistTracks WHERE playlistId = ${playlistId}`
  ).values();

  const tracksCount = Number(_tracksCount[0][0]) + 1;

  console.log("tracksCount:", tracksCount);

  try {
    return DB.run(
      `INSERT INTO playlistTracks
       VALUES (NULL, ${playlistId}, ${trackId}, ${tracksCount}, ${startsAt}, ${endsAt}, DateTime('now'))`
    );
  } catch (err: any) {
    return error(500, {
      subject: "Playlist Track Insertion Error",
      body: err.message,
    });
  }
}
