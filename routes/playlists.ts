import { ARTWORK_URL, DB } from "..";

type PlaylistProps = {
  id: number;
  name: string;
  artwork: string;
  createdOn: string;
  modifiedOn: string;
  tracks: any;
};

type PlaylistsProps = PlaylistProps[];

export default function playlists() {
  // ? Get playlists
  let playlists: PlaylistsProps = <PlaylistsProps>(
    DB.query(`SELECT * FROM playlists ORDER BY id DESC`).all()
  );

  // ? Get playlist tracks for each playlist
  playlists.forEach(({ id }, i) => {
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
