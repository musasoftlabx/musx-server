import { Database } from "bun:sqlite";
export const DB = new Database("muzix.db", { create: true });
import { SQLQueryBindings } from "bun:sqlite";

type Track = {
  id: number;
  path: string;
  artwork: string | null;
  waveform: string | null;
  title: string | null;
  artists: string | null;
};

export const paths = DB.query<Track, SQLQueryBindings[]>(
  `SELECT id, path, artwork, waveform, title, artists FROM tracks`,
).all();
