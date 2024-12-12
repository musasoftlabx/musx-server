import { ARTWORK_URL, AUDIO_URL, DB } from "..";

export default function artists() {
  return DB.query(
    //`SELECT albumArtist, path, COUNT(albumArtist) AS tracks, SUM(plays) AS plays FROM tracks GROUP BY albumArtist, plays ORDER BY tracks`
    `SELECT ('${AUDIO_URL}' || path) url, albumArtist, path, genre, COUNT(albumArtist) AS tracks FROM tracks GROUP BY albumArtist ORDER BY albumArtist`
  )
    .all()
    .map((artist: any) => {
      if (artist.albumArtist?.includes("Various"))
        return {
          ...artist,
          artworks: DB.query(
            `SELECT
             ('${ARTWORK_URL}' || artwork) artwork
             FROM tracks
             WHERE path LIKE "%Various Artists (${artist.genre})%"
             LIMIT 4`
          )
            .all()
            .map(({ artwork }: any) => artwork),
        };
      else return artist;
    });
}
