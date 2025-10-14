import { DB } from "..";
import { Context } from "elysia";
import { DeletePlaylistBodyProps } from "../types";

export type DeletePlaylist = Pick<Context, "set"> & DeletePlaylistBodyProps;

export default function deletePlaylist(params: DeletePlaylist) {
  const {
    set,
    query: { playlistId },
  } = params;

  try {
    return DB.run(`DELETE FROM playlists WHERE id = ${Number(playlistId)}`);
  } catch (err) {
    set.status = 502;
    if (err instanceof Error)
      return {
        subject: "Playlist deletion error",
        body: err.message,
      };
  }
}
