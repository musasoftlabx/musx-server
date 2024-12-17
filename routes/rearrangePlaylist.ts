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
  body: {
    playlistId: number;
    from: { id: number; position: number };
    to: { id: number; position: number };
  };
};

export default function rearrangePlaylist(params: RearrangePlaylist) {
  const {
    error,
    body: { playlistId, from, to },
  } = params;

  DB.exec(
    `UPDATE playlistTracks SET position = ${to.position} WHERE trackId = ${from.id} AND playlistId = ${playlistId}`
  );

  DB.exec(
    `UPDATE playlistTracks SET position = ${from.position} WHERE trackId = ${to.id} AND playlistId = ${playlistId}`
  );

  return { playlistId, from, to };
}
