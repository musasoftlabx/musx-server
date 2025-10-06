import { DB } from "..";

type TParams = { body: any; set: any; error: any };

export default async function createNewPlaylist(params: TParams) {
  const { body, set, error } = params;
  const { name, description } = body;

  try {
    const { lastInsertRowid } = DB.run(
      `INSERT INTO playlists VALUES (NULL, "${name}", "${description}", DateTime('now'), DateTime('now'))`
    );

    return lastInsertRowid;
  } catch (err: any) {
    return error(500, {
      subject: "Playlist Creation Error",
      body: err.message,
    });
  }
}
