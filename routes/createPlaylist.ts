import { DB } from "..";

type TParams = { body: any; set: any; error: any };

export default async function createPlaylist(params: TParams) {
  const {
    body: { name, description },
    set,
    error,
  } = params;

  try {
    const exists = DB.query(
      `SELECT COUNT(id) FROM playlists WHERE name = "${name}"`
    ).values()[0][0];

    console.log("exists", exists);

    if (exists)
      return error(403, {
        subject: "Playlist Creation Error",
        body: "A playlist with a similar name already exists",
      });
    else {
      const { lastInsertRowid } = DB.run(
        `INSERT INTO playlists VALUES (NULL, "${name}", "${description}", NULL, DateTime('now'), DateTime('now'))`
      );

      return lastInsertRowid;
    }
  } catch (err: any) {
    return error(500, {
      subject: "Playlist Creation Error",
      body: err.message,
    });
  }
}
