import { DB } from "..";

import { unlink } from "node:fs/promises";

type TParams = { body: any; set: any; error: any };

export default async function deleteTrack(params: TParams) {
  const { body, set, error } = params;
  const { id } = body;

  const { path, artwork, waveform }: any = DB.query(
    `SELECT path, artwork, waveform FROM tracks WHERE id = ${id}`
  ).get();

  try {
    await unlink(`./Music/${path}`);
    await unlink(`./Artwork/${artwork}`);
    await unlink(`./Waveform/${waveform}`);
    DB.query(`DELETE FROM tracks WHERE id = ${id}`).run();
  } catch (err: any) {
    return error(500, `${err.message}: ${path}`);
  }
}
