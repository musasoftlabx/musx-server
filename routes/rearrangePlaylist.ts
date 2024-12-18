import { DB } from "..";

export type RearrangePlaylist = {
  error: any;
  body: { playlistId: number; trackIds: number[] };
};

export default function rearrangePlaylist(params: RearrangePlaylist) {
  const {
    body: { playlistId, trackIds },
  } = params;

  let position = 1;

  for (const trackId of trackIds) {
    DB.exec(
      `UPDATE playlistTracks SET position = ${position} WHERE trackId = ${trackId} AND playlistId = ${playlistId}`
    );
    position++;
  }

  return trackIds;
}
