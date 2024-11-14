import { DB } from "..";

type TParams = { error: any; params: { artist: string } };

export default async function artist(params: TParams) {
  const {
    error,
    params: { artist },
  } = params;

  try {
    const albums = DB.query(
      `SELECT album, artwork, COUNT(album) AS tracks FROM tracks WHERE albumArtist = ? GROUP BY album HAVING COUNT(album) > 1`
    ).all([artist] as any);

    const singles = DB.query(
      `SELECT * FROM tracks WHERE albumArtist = ? GROUP BY album HAVING COUNT(album) = 1`
    ).all([artist] as any);

    return { albums, singles };
  } catch (err: any) {
    return error(500, {
      subject: "Artist Album Retrieval Error",
      body: err.message,
    });
  }
}
