import { DB } from "..";

type TParams = { error: any; params: { id: string } };

export default function trackMetadata(params: TParams) {
  const {
    error,
    params: { id },
  } = params;

  try {
    return DB.query(`SELECT * FROM tracks WHERE id = ${Number(id)}`).get();
  } catch (err: any) {
    return error(500, {
      subject: "Playlist Retrieval Error",
      body: err.message,
    });
  }
}
