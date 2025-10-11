import { DB } from "..";

type TParams = { body: any; set: any; error: any };

export default async function createPlaylist(params: TParams) {
  const {
    body: { name, description },
    set,
    error,
  } = params;

  try {
    const { lastInsertRowid } = DB.run(
      `INSERT INTO playlists VALUES (NULL, "${name}", "${description}", NULL, DateTime('now'), DateTime('now'))`
    );

    return lastInsertRowid;
  } catch (err: any) {
    return error(500, {
      subject: "Playlist Creation Error",
      body: err.message,
    });
  }
}
