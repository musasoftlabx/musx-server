import { DB } from "..";

type TParams = { error: any; params: { id: string } };

export default function playlist(params: TParams) {
  const {
    error,
    params: { id },
  } = params;

  try {
    return DB.query(
      `SELECT tracks.id AS id, path, title, albumArtist, artists, genre, year, track, rating, plays, bitrate, size, duration, format, channels, channelLayout, sampleRate, encoder, artwork, waveform, palette, startsAt, endsAt, addedOn
        FROM playlistTracks
        JOIN tracks
        ON trackId = tracks.id
        WHERE playlistId = ${Number(id)}`
    ).all();
  } catch (err: any) {
    return error(500, {
      subject: "Playlist Retrieval Error",
      body: err.message,
    });
  }
}
