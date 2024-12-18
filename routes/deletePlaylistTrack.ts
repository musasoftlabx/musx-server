import { DB } from "..";

export type DeletePlaylistTrack = {
  query: { playlistId: number; trackId: number };
  error: any;
};

export default async function deletePlaylistTrack(params: DeletePlaylistTrack) {
  const {
    query: { playlistId, trackId },
  } = params;

  return DB.exec(
    `DELETE FROM playlistTracks WHERE trackId = ${trackId} AND playlistId = ${playlistId}`
  );
}
