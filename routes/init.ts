import { DB } from "..";
import { existsSync, mkdirSync } from "fs";

export default async function init() {
  DB.exec("PRAGMA timezone = 'Africa/Nairobi';");

  DB.exec(
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
  );

  DB.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idxPath ON tracks (path)`);

  DB.exec(
    `CREATE TABLE IF NOT EXISTS "plays" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trackId INTEGER,
    playedOn DATETIME,
    FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`
  );

  DB.exec(
    `CREATE TABLE IF NOT EXISTS "playlists" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(30),
      artwork VARCHAR(50),
      createdOn DATETIME,
      modifiedOn DATETIME
    )`
  );

  DB.exec(
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
  );

  DB.exec(
    `CREATE TABLE IF NOT EXISTS "scanErrors" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track VARCHAR(255),
      operation VARCHAR(20),
      error TEXT,
      scannedOn DATETIME
    )`
  );

  DB.exec(
    `CREATE TABLE IF NOT EXISTS deletedTracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path VARCHAR(100),
      title VARCHAR (255),
      artists VARCHAR(255),
      deletedOn DATETIME
    )`
  );

  DB.exec(
    `CREATE TABLE IF NOT EXISTS searchHistory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query VARCHAR(100),
      searchedOn DATETIME
    )`
  );

  //DB.exec(`ALTER TABLE playlistTracks ADD COLUMN position INTEGER`);
  //DB.exec(`ALTER TABLE playlistTracks DROP COLUMN priority`);

  // ? Create artwork & waveform directories if it doesn't exist
  !existsSync("./Artwork") && mkdirSync("./Artwork", { recursive: true });
  !existsSync("./Waveform") && mkdirSync("./Waveform", { recursive: true });

  //DB.query(`DROP TABLE IF EXISTS searchHistory`).run();
}

//DB.query(`CREATE UNIQUE INDEX IF NOT EXISTS idxPath ON tracks (path)`).run();

/* 
  // ? Move columns
  DB.exec(`
    BEGIN;
    CREATE TABLE playlistTracks_tmp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlistId INTEGER,
      trackId INTEGER,
      position INTEGER,
      startsAt DOUBLE,
      endsAt DOUBLE,
      addedOn DATETIME,
      FOREIGN KEY ("playlistId") REFERENCES "playlists" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
    INSERT INTO playlistTracks_tmp (id, playlistId, trackId, position, startsAt, endsAt, addedOn) SELECT id, playlistId, trackId, position, startsAt, endsAt, addedOn FROM playlistTracks;
    DROP TABLE playlistTracks;
    ALTER TABLE playlistTracks_tmp RENAME TO playlistTracks;
    COMMIT;
  `); */
