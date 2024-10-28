import { DB } from "..";

type TParams = { body: any; set: any; error: any };

export default async function addPlaylistTrack(params: TParams) {
  const { body, set, error } = params;
  const { playlistId, trackId, startsAt, endsAt } = body;

  try {
    return DB.query(
      `INSERT INTO playlistTracks VALUES (NULL, ${playlistId}, ${trackId}, ${startsAt}, ${endsAt}, DateTime('now'))`
    ).run();
  } catch (err: any) {
    return error(500, {
      subject: "Playlist Track Insertion Error",
      body: err.message,
    });
  }
}
