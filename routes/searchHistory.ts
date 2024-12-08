import { DB } from "..";

export default function searchHistory() {
  return DB.query(`SELECT query FROM searchHistory LIMIT 20`)
    .all()
    .map(({ query }: any) => query);
}
