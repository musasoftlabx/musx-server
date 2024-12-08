import { ARTWORK_URL, AUDIO_URL, DB, WAVEFORM_URL } from "..";

type TParams = { error: any; params: { id: string } };

export default function playlist(params: TParams) {
  const {
    error,
    params: { id },
  } = params;

  try {
    return DB.query(
      `SELECT
        tracks.id id,
        ('${AUDIO_URL}' || path) AS url,
        path, syncDate, title, album, albumArtist, artists, genre, year, track, rating, plays, bitrate, size, duration, format, channels, channelLayout, sampleRate, encoder,
        ('${ARTWORK_URL}' || artwork) AS artwork,
        ('${WAVEFORM_URL}' || waveform) AS waveform,
        palette
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
