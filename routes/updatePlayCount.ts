import { DB } from "..";

type TParams = { error: any; params: { id: string } };

export default function updatePlayCount(params: TParams) {
  const {
    error,
    params: { id },
  } = params;

  try {
    DB.query(`UPDATE tracks SET plays = plays + 1 WHERE id = ${id}`).run();
    DB.query(`INSERT INTO plays VALUES (NULL, ${id}, DateTime('now'))`).run();
    return true;
  } catch (err: any) {
    console.log("err", err.message);
    return error(500, {
      subject: "Update Error",
      body: err.message,
    });
  }
}
