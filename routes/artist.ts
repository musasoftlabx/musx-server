import { DB } from "..";
import byteSize from "byte-size";

type TParams = { error: any; params: { artist: string } };

export default async function artist(params: TParams) {
  const {
    error,
    params: { artist },
  } = params;

  try {
    const albums = DB.query(
      `SELECT album, artwork, COUNT(album) AS tracks, SUM(size) AS size FROM tracks WHERE albumArtist = ? GROUP BY album HAVING COUNT(album) > 1`
    ).all([decodeURIComponent(artist)] as any);

    const singles = DB.query(
      `SELECT * FROM tracks WHERE albumArtist = ? GROUP BY album HAVING COUNT(album) = 1 ORDER BY rating DESC, plays DESC`
    ).all([decodeURIComponent(artist)] as any);

    return {
      albums: albums.map((album: any) => ({
        ...album,
        size: `${byteSize(album.size)}`,
      })),
      singles,
    };
  } catch (err: any) {
    return error(500, {
      subject: "Artist Album Retrieval Error",
      body: err.message,
    });
  }
}
