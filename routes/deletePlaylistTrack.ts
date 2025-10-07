import { DB } from "..";

export type DeletePlaylistTrack = {
  query: { playlistId: number; position: number };
  error: any;
};

export default function deletePlaylistTrack(params: DeletePlaylistTrack) {
  const {
    query: { playlistId, position },
  } = params;

  return DB.exec(
    `DELETE FROM playlistTracks WHERE position = ${position} AND playlistId = ${playlistId}`
  );
}
