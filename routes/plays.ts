import { DB } from "..";

type TParams = { error: any; params: { id: string } };

export default function plays(params: TParams) {
  const {
    error,
    //params: { id },
  } = params;

  try {
    return DB.query(
      `SELECT plays.id AS id, path, title, albumArtist, artists, genre, year, track, rating, plays, bitrate, size, duration, format, channels, channelLayout, sampleRate, encoder, artwork, waveform, palette, playedOn
        FROM plays
        JOIN tracks
        ON trackId = tracks.id
        ORDER BY playedOn DESC
        LIMIT 50`
    ).all();
  } catch (err: any) {
    return error(500, {
      subject: "Plays Retrieval Error",
      body: err.message,
    });
  }
}
