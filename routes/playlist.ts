import { DB, tracksTableColumns } from "..";

type TParams = { error: any; params: { id: string } };

export default function playlist(params: TParams) {
  const {
    error,
    params: { id },
  } = params;

  try {
    return DB.query(
      `SELECT tracks.id AS id, ${tracksTableColumns}
        FROM playlistTracks
        JOIN tracks
        ON trackId = tracks.id
        WHERE playlistId = ${Number(id)}`
    ).all();
  } catch (err: any) {
    return error(500, {
      subject: "Playlist Retrieval Error",
      body: err.message,
    });
  }
}
