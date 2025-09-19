import { DB } from "..";

export type PlaylistProps = { body: any; set: any; error: any };

export default async function editPlaylist(params: PlaylistProps) {
  const { body, set, error } = params;
  const { name, artwork, id } = body;

  try {
    DB.run(
      `UPDATE playlists SET name = ?, artwork = ?, modifiedOn = DateTime('now') WHERE id = ?`,
      [name, artwork, id]
    );
  } catch (err: any) {
    return error(500, {
      subject: "Edit Playlist Error",
      body: err.message,
    });
  }
}
