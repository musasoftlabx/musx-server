import { DB } from "..";
import { existsSync, mkdirSync } from "fs";

export default async function init() {
  DB.exec("PRAGMA timezone = 'Africa/Nairobi';");

  DB.query(
    `CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path VARCHAR(100),
    syncDate DATETIME,
    title VARCHAR (255),
    album VARCHAR(255),
    albumArtist VARCHAR(255),
    artists VARCHAR(255),
    genre VARCHAR(20),
    year VARCHAR(15),
    track TINYINT(3),
    rating TINYINT(1),
    plays TINYINT(4),
    bitrate INT(10),
    size MEDIUMINT,
    duration DOUBLE,
    format VARCHAR(5),
    channels TINYINT(1),
    channelLayout VARCHAR(15),
    sampleRate INT(10),
    encoder VARCHAR(20),
    artwork VARCHAR(255),
    waveform VARCHAR(255),
    palette VARCHAR(255),
    lyrics TEXT
  )`
  ).run();

  DB.query(`CREATE UNIQUE INDEX IF NOT EXISTS idxPath ON tracks (path)`).run();

  DB.query(
    `CREATE TABLE IF NOT EXISTS "plays" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trackId INTEGER,
    playedOn DATETIME,
    FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`
  ).run();

  DB.query(
    `CREATE TABLE IF NOT EXISTS "playlists" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(30),
    artwork VARCHAR(50),
    createdOn DATETIME,
    modifiedOn DATETIME
  )`
  ).run();

  DB.query(
    `CREATE TABLE IF NOT EXISTS "playlistTracks" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlistId INTEGER,
    trackId INTEGER,
    startsAt DOUBLE,
    endsAt DOUBLE,
    addedOn DATETIME,
    FOREIGN KEY ("playlistId") REFERENCES "playlists" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`
  ).run();

  DB.query(
    `CREATE TABLE IF NOT EXISTS "scanErrors" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track VARCHAR(255),
      operation VARCHAR(20),
      error TEXT,
      scannedOn DATETIME
    )`
  ).run();

  // ? Create artwork & waveform directories if it doesn't exist
  !existsSync("./Artwork") && mkdirSync("./Artwork", { recursive: true });
  !existsSync("./Waveform") && mkdirSync("./Waveform", { recursive: true });
}

//DB.query(`CREATE UNIQUE INDEX IF NOT EXISTS idxPath ON tracks (path)`).run();
//DB.query(`DROP TABLE IF EXISTS playlists`).run();
