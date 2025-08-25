const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const dbPromise = open({
  filename: 'src/database/charts.db',
  driver: sqlite3.Database
});

async function initializeDatabase() {
  const db = await dbPromise;

  await db.exec(`CREATE TABLE IF NOT EXISTS contents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contentType INTEGER NOT NULL,
    title TEXT,
    publisher TEXT,
    description TEXT,
    downloadUrl TEXT,
    imageUrl TEXT,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    downloadCount INTEGER DEFAULT 0,
    voteAverageScore REAL DEFAULT 0,
    songInfo TEXT
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contentId INTEGER NOT NULL,
    userId TEXT NOT NULL,
    name TEXT,
    score INTEGER,
    comment TEXT,
    like INTEGER DEFAULT 0,
    date TEXT NOT NULL,
    FOREIGN KEY(contentId) REFERENCES contents(id)
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS likes (
    userId TEXT NOT NULL,
    voteId INTEGER NOT NULL,
    PRIMARY KEY(userId, voteId),
    FOREIGN KEY(voteId) REFERENCES votes(id)
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    accountId TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    token TEXT,
    name TEXT,
    icon INTEGER DEFAULT 0
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS ranking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    songTitle TEXT NOT NULL,
    difficulty INTEGER NOT NULL,
    chartHash TEXT NOT NULL,
    accountId TEXT,
    score INTEGER,
    abCount INTEGER DEFAULT 0,
    date TEXT NOT NULL,
    UNIQUE(songTitle, difficulty, chartHash, accountId)
  )`);

  return db;
}

module.exports = { dbPromise, initializeDatabase };