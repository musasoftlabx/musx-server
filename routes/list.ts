import { DB } from "..";

import { AUDIO_URL, ARTWORK_URL, WAVEFORM_URL } from "..";

export default async function list({ params }: { params: { "*": string } }) {
  const decoded = decodeURI(params["*"]);

  const entry = decoded === "/" ? "" : decoded;

  const selection = DB.prepare(
    `SELECT path FROM tracks WHERE path LIKE "%${entry}%"`
  ).all();

  const paths = [
    ...new Set( // ? new Set removes duplicates
      selection.map(({ path }: any) => path.replace(entry, "").split("/")[0])
    ),
  ];

  const folders = [];
  const files = [];

  for await (const path of paths) {
    if (!path.includes(".mp3"))
      folders.push({
        name: path,
        path: `${entry.split("/").slice(0, -1).join("/")}/`,
      });
    else
      files.push(
        DB.query(
          `SELECT 
            id,
            ('${AUDIO_URL}' || path) AS url,
            path, syncDate, title, album, albumArtist, artists, genre, year, track, rating, plays, bitrate, size, duration, format, channels, channelLayout, sampleRate, encoder,
            ('${ARTWORK_URL}' || artwork) AS artwork,
            ('${WAVEFORM_URL}' || waveform) AS waveform,
            palette
          FROM tracks
          WHERE path = "${entry}${path}"`
        ).get()
      );
  }

  const sortedFolders = folders.sort((a, b) => a.name - b.name);
  const sortedFiles = files.sort((a: any, b: any) => a.path - b.path);

  return [...sortedFolders, ...sortedFiles];
}
