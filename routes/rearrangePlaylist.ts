import { ARTWORK_URL, DB } from "..";

import byteSize from "byte-size";

type PlaylistProps = {
  id: number;
  name: string;
  createdOn: string;
  modifiedOn: string;
  tracks: number;
  artworks: string[];
  duration: string;
  size: string;
};

const formatTime2 = (seconds: number) =>
  new Date(seconds * 1000).toLocaleTimeString("en-GB", {
    timeZone: "Etc/UTC",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

function formatTime(seconds: number) {
  return [
    Math.floor(seconds / 60 / 60),
    Math.floor((seconds / 60) % 60),
    Math.floor(seconds % 60),
  ]
    .join(":")
    .replace(/\b(\d)\b/g, "0$1");
}

export type RearrangePlaylist = {
  error: any;
  body: { playlistId: number; from: number; to: number };
};

export default function rearrangePlaylist(params: RearrangePlaylist) {
  const {
    error,
    body: { playlistId, from, to },
  } = params;

  // // ? Get playlists
  // let playlists: PlaylistsProps = <PlaylistsProps>(
  //   DB.query(`SELECT * FROM playlists ORDER BY id DESC`).all()
  // );

  // // ? Get playlist tracks for each playlist
  // playlists.forEach(({ id }, i) => {
  //   playlists[i].tracks = DB.query(
  //     `SELECT COUNT(trackId) tracks
  //     FROM playlistTracks
  //     JOIN tracks
  //     ON trackId = tracks.id
  //     WHERE playlistId = ${id}`
  //   ).values()[0][0] as number;

  //   playlists[i].size = `${byteSize(
  //     DB.query(
  //       `SELECT SUM(size) size
  //     FROM playlistTracks
  //     JOIN tracks
  //     ON trackId = tracks.id
  //     WHERE playlistId = ${id}`
  //     ).values()[0][0] as number
  //   )}`;

  //   playlists[i].duration = formatTime2(
  //     DB.query(
  //       `SELECT SUM(duration) duration
  //     FROM playlistTracks
  //     JOIN tracks
  //     ON trackId = tracks.id
  //     WHERE playlistId = ${id}`
  //     ).values()[0][0] as number
  //   );

  //   playlists[i].artworks = DB.query(
  //     `SELECT ('${ARTWORK_URL}' || artwork) artwork
  //     FROM playlistTracks
  //     JOIN tracks
  //     ON trackId = tracks.id
  //     WHERE playlistId = ${id}
  //     LIMIT 4`
  //   )
  //     .all()
  //     .map(({ artwork }: any) => artwork);
  // });

  return { playlistId, from, to };
}
