import { DB } from "..";

type TParams = { body: any; set: any };

export default async function createPlaylist(params: TParams) {
  const {
    body: { name, description },
    set,
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
      set.status = 403;
      return {
        subject: "Similar playlist exists",
        body: "A playlist with a similar name already exists.",
      };
    }
  } catch (err: any) {
    set.status = 502;
    return {
      subject: "Playlist Creation Error",
      body: err.message,
    };
  }
}
