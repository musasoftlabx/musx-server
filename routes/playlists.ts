import { DB } from "..";

type TParams = { body: any; set: any; error: any };

export default async function createPlaylist(params: TParams) {
  const { body, set, error } = params;
  const { name } = body;

  return DB.query(`SELECT * FROM playlists`).run();
}
