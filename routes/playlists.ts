import { DB } from "..";

type TParams = { body: any; set: any; error: any };

type PlaylistProps = {
  id: number;
  name: string;
  artwork: string;
  createdOn: string;
  modifiedOn: string;
  tracks: any;
};

type PlaylistsProps = PlaylistProps[];

export default async function playlists() {
  // ? Get playlists
  let playlists: PlaylistsProps = <PlaylistsProps>(
    DB.query(`SELECT * FROM playlists ORDER BY id DESC`).all()
  );

  // ? Get playlist tracks for each playlist
  playlists.forEach(({ id }, i) => {
    playlists[i].tracks = DB.query(
      `SELECT title, artwork 
          FROM playlistTracks
          JOIN tracks
          ON playlistTracks.id = tracks.id
          WHERE playlistId = ${id}`
    ).all();
  });

  return playlists;
}
