import { DB } from "..";

export default function searchHistory() {
  return DB.query(`SELECT query FROM searchHistory ORDER BY id DESC LIMIT 20`)
    .all()
    .map(({ query }: any) => query);
}
