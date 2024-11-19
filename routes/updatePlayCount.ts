import { DB } from "..";

type TParams = { error: any; body: { id: string } };

export default function updatePlayCount(params: TParams) {
  const {
    error,
    body: { id },
  } = params;

  try {
    DB.query(`UPDATE tracks SET plays = plays + 1 WHERE id = ${id}`).run();
    DB.query(`INSERT INTO plays VALUES (NULL, ${id}, DateTime('now'))`).run();
    return DB.query(`SELECT rating FROM tracks WHERE id = ${id}`).get();
  } catch (err: any) {
    return error(500, {
      subject: "Update Error",
      body: err.message,
    });
  }
}
