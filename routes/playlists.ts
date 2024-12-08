import { ARTWORK_URL, DB } from "..";

import byteSize from "byte-size";

type PlaylistProps = {
  id: number;
  name: string;
  artwork: string;
  createdOn: string;
  modifiedOn: string;
  tracks: any;
  duration: number;
  size: string;
};

type PlaylistsProps = PlaylistProps[];

export default function playlists() {
  // ? Get playlists
  let playlists: PlaylistsProps = <PlaylistsProps>(
    DB.query(`SELECT * FROM playlists ORDER BY id DESC`).all()
  );

  // ? Get playlist tracks for each playlist
  playlists.forEach(({ id }, i) => {
    playlists[i].size = `${byteSize(
      DB.query(
        `SELECT SUM(size) size
      FROM playlistTracks
      JOIN tracks
      ON trackId = tracks.id
      WHERE playlistId = ${id}`
      ).values()[0][0] as number
    )}`;

    playlists[i].duration = DB.query(
      `SELECT SUM(duration) duration
      FROM playlistTracks
      JOIN tracks
      ON trackId = tracks.id
      WHERE playlistId = ${id}`
    ).values()[0][0] as number;

    playlists[i].tracks = DB.query(
      `SELECT 
        title,
        ('${ARTWORK_URL}' || artwork) artwork
      FROM playlistTracks
      JOIN tracks
      ON trackId = tracks.id
      WHERE playlistId = ${id}`
    ).all();
  });

  return playlists;
}
