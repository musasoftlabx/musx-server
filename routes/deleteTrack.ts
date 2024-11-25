import { DB } from "..";

import { unlink } from "node:fs/promises";

type TParams = { params: { id: string }; error: any };

export default async function deleteTrack(params: TParams) {
  const {
    params: { id },
    error,
  } = params;

  const { path, artwork, waveform }: any = DB.query(
    `SELECT path, artwork, waveform FROM tracks WHERE id = ${id}`
  ).get();

  try {
    console.log({ path, artwork, waveform });
    return { path, artwork, waveform };
    // await unlink(`./Music/${path}`);
    // await unlink(`./Artwork/${artwork}`);
    // await unlink(`./Waveform/${waveform}`);
    // return DB.query(`DELETE FROM tracks WHERE id = ${id}`).run();
  } catch (err: any) {
    return error(500, `${err.message}: ${path}`);
  }
}
