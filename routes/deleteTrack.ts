import { DB } from "..";

import { unlink } from "node:fs/promises";

type TParams = { params: { id: string }; error: any };

export default async function deleteTrack(params: TParams) {
  const {
    params: { id },
    error,
  } = params;

  const { path, title, artists, artwork, waveform }: any = DB.query(
    `SELECT path, title, artists, artwork, waveform FROM tracks WHERE id = ${id}`
  ).get();

  try {
    await unlink(`./Music/${path}`);
    await unlink(`./Artwork/${artwork}`);
    await unlink(`./Waveform/${waveform}`);
    DB.exec(`DELETE FROM tracks WHERE id = ${id}`);
    DB.exec(`INSERT INTO deletedTracks (NULL, path, title, artists)`);
    return true;
  } catch (err: any) {
    return error(500, `${err.message}: ${path}`);
  }
}
