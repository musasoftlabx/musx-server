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

export default async function createPlaylist(params: TParams) {
  const { body, set, error } = params;
  const { name, trackId } = body;

  try {
    // ? Create a playlist
    const { lastInsertRowid } = DB.run(
      `INSERT INTO playlists VALUES (NULL, "${name}", NULL, DateTime('now'), DateTime('now'))`
    );

    // ? Add initial track to playlist
    DB.run(
      `INSERT INTO playlistTracks VALUES (NULL, ${lastInsertRowid}, ${trackId}, NULL, NULL, DateTime('now'))`
    );

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
  } catch (err: any) {
    return error(500, {
      subject: "Playlist Creation Error",
      body: err.message,
    });
  }
}
