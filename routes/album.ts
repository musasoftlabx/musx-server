import { DB } from "..";

type TParams = { error: any; params: { artist: string; album: string } };

export default async function artist(params: TParams) {
  const {
    error,
    params: { artist, album },
  } = params;

  try {
    return DB.query(
      `SELECT * FROM tracks WHERE albumArtist = ? AND album = ?`
    ).all([artist, decodeURI(album)] as any);
  } catch (err: any) {
    return error(500, {
      subject: "Album Retrieval Error",
      body: err.message,
    });
  }
}
