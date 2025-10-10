import { DB } from "..";

export type DeletePlaylist = {
  query: { playlistId: number };
  error: any;
};

export default function deletePlaylist(params: DeletePlaylist) {
  const {
    query: { playlistId },
  } = params;

  console.log(typeof playlistId);

  return DB.exec(`DELETE FROM playlists WHERE id = ${playlistId}`);
}
