import { DB } from "..";

type TParams = { body: any; set: any; error: any };

export default async function createPlaylist(params: TParams) {
  const { body, set, error } = params;
  const { name } = body;

  try {
    DB.query(
      `INSERT INTO playlists VALUES (NULL, "${name}", NULL, DateTime('now'), DateTime('now'))`
    ).run();

    return DB.query(`SELECT * FROM playlists`).run();
  } catch (err: any) {
    return error(500, {
      subject: "Playlist Creation Error",
      body: err.message,
    });
  }
}
