import { DB } from "..";
import { Palette } from "../types";

export default function updatePalette(params: Palette) {
  const { id, palette } = params.body;
  return DB.query(`UPDATE tracks SET palette = ? WHERE id = ?`).run([
    JSON.stringify(palette),
    id,
  ] as {});
}
