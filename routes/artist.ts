import { DB } from "..";

type TParams = { error: any; params: { albumArtist: string } };

export default async function artist(params: TParams) {
  const {
    error,
    params: { albumArtist },
  } = params;

  const albums = DB.query(
    `SELECT album, artwork, COUNT(album) AS tracks FROM tracks WHERE albumArtist = ? GROUP BY album HAVING COUNT(album) > 1`
  ).all([albumArtist] as any);

  const singles = DB.query(
    `SELECT * FROM tracks WHERE albumArtist = ? GROUP BY album HAVING COUNT(album) = 1`
  ).all([albumArtist] as any);

  return { albums, singles };
}
