import { DB } from "..";
import { Context } from "elysia";
import { CreatePlaylistBodyProps } from "../types";

export type CreatePlaylist = Pick<Context, "set"> & CreatePlaylistBodyProps;

export default async function createPlaylist(params: CreatePlaylist) {
  const {
    set,
    body: { name, description },
  } = params;

  try {
    const exists = DB.query(
      `SELECT COUNT(id) FROM playlists WHERE name = "${name}"`
    ).values()[0][0];

    if (exists === 0) {
      const { lastInsertRowid } = DB.run(
        `INSERT INTO playlists VALUES (NULL, "${name}", "${description}", NULL, DateTime('now'), DateTime('now'))`
      );

      return lastInsertRowid;
    } else {
      set.status = "Forbidden";
      return {
        subject: "Similar playlist exists",
        body: "A playlist with a similar name already exists.",
      };
    }
  } catch (err) {
    set.status = 502;
    if (err instanceof Error)
      return {
        subject: "Playlist creation error",
        body: err.message,
      };
  }
}
