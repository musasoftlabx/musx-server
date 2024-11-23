import { DB } from "../";
import libraryCount from "./libraryCount";

export const dashboard = () => {
  const mostPlayed = DB.query(
    `SELECT * FROM tracks ORDER BY plays DESC LIMIT 10`
  ).all();

  const recentlyAdded = DB.query(
    `SELECT * FROM tracks ORDER BY id DESC LIMIT 20`
  ).all();

  const recentlyPlayed = DB.query(
    `SELECT DISTINCT trackId AS id, path, title, albumArtist, artists, genre, year, track, rating, plays, bitrate, size, duration, format, channels, channelLayout, sampleRate, encoder, artwork, waveform, palette
     FROM plays
     INNER JOIN tracks
     ON plays.trackId = tracks.id
     ORDER BY plays.id DESC
     LIMIT 20`
  ).all();

  const favouriteArtists = DB.query(
    `SELECT path, genre, albumArtist, (AVG(rating) + AVG(plays)) AS rating, COUNT(path) AS tracks FROM tracks GROUP BY albumArtist ORDER BY rating DESC LIMIT 20`
  ).all();

  return {
    favouriteArtists: favouriteArtists.map(
      //(artist: { albumArtist: string; genre: string }) => {
      (artist: any) => {
        //if (artist.albumArtist) {
        if (artist.albumArtist?.includes("Various"))
          return {
            ...artist,
            artworks: DB.query(
              `SELECT artwork FROM tracks WHERE path LIKE "%Various Artists (${artist.genre})%" LIMIT 4`
            )
              .all()
              .map(({ artwork }) => artwork),
            //CONCAT('http://75.119.137.255/Artwork/', artwork)
          };
        else return artist;
        //}
      }
    ),
    recentlyAdded,
    recentlyPlayed,
    //recentlyPlayed: [...new Set(recentlyPlayed)],
    mostPlayed,
    stats: libraryCount(),
  };
};
