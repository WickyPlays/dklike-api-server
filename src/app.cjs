const express = require("express");
const { Database } = require("sqlite3");
const { open } = require("sqlite");
const { existsSync, closeSync, openSync } = require("fs");

const app = express();
app.use(express.json());

const dbFilePath = "./src/database/charts.db";

const initDB = async () => {
  if (!existsSync(dbFilePath)) {
    console.log(`Creating new database file: ${dbFilePath}`);
    closeSync(openSync(dbFilePath, "w"));
  }
  const db = await open({
    filename: dbFilePath,
    driver: Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS contents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contentType INTEGER NOT NULL,
      title TEXT,
      publisher TEXT,
      description TEXT,
      downloadUrl TEXT,
      imageUrl TEXT,
      date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      downloadCount INTEGER DEFAULT 0,
      voteAverageScore REAL,
      songInfo TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contentId INTEGER NOT NULL,
      userId TEXT NOT NULL,
      name TEXT,
      score INTEGER,
      comment TEXT,
      like INTEGER DEFAULT 0,
      date TEXT NOT NULL,
      FOREIGN KEY(contentId) REFERENCES contents(id)
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      contentId INTEGER NOT NULL,
      voteUserId TEXT NOT NULL,
      FOREIGN KEY(contentId) REFERENCES contents(id)
    );
  `);

  return db;
};

const dbPromise = initDB();

app.get("/support", async (req, res) => {
  res.status(200).json({ contents: true });
});

app.get("/contents", async (req, res) => {
  const db = await dbPromise;
  const contents = await db.all("SELECT * FROM contents");
  const list = contents.map((c) => ({
    id: c.id,
    contentType: c.contentType,
    title: c.title,
    publisher: c.publisher,
    date: c.date,
    downloadCount: c.downloadCount,
    voteAverageScore: c.voteAverageScore,
    songInfo: c.songInfo ? JSON.parse(c.songInfo) : null,
  }));
  res.status(200).json({ contents: list });
});

app.get("/contents/:id", async (req, res) => {
  const db = await dbPromise;
  const id = req.params.id;
  const content = await db.get("SELECT * FROM contents WHERE id = ?", id);
  res.status(200).json({ contents: content });
});

app.get("/contents/:id/description", async (req, res) => {
  const db = await dbPromise;
  const id = req.params.id;
  const content = await db.get(
    "SELECT description, downloadUrl, imageUrl FROM contents WHERE id = ?",
    id
  );
  res.status(200).json(content);
});

app.put("/contents/:id/downloaded", async (req, res) => {
  const db = await dbPromise;
  const id = req.params.id;
  await db.run(
    "UPDATE contents SET downloadCount = downloadCount + 1 WHERE id = ?",
    id
  );
  res.status(200).json({ message: "Operation was successful." });
});

app.get("/votes", async (req, res) => {
  const db = await dbPromise;
  const votes = await db.all("SELECT * FROM votes");
  res.status(200).json({ votes });
});

app.get("/contents/:id/vote", async (req, res) => {
  const db = await dbPromise;
  const id = req.params.id;
  const votes = await db.all("SELECT * FROM votes WHERE contentId = ?", id);
  res.status(200).json({ votes });
});

app.post("/contents/:id/vote", async (req, res) => {
  const db = await dbPromise;
  const contentId = req.params.id;
  const { userId, name, score, comment, like, date } = req.body;

  await db.run(
    `INSERT INTO votes (contentId, userId, name, score, comment, like, date)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(userId) DO UPDATE SET
       score = excluded.score,
       comment = excluded.comment,
       like = excluded.like,
       date = excluded.date`,
    contentId,
    userId,
    name,
    score,
    comment,
    like,
    date
  );

  updateVoteAverageScore(Number(contentId));
  res.status(200).json({ message: "Operation was successful." });
});

const updateVoteAverageScore = async (contentId) => {
  const db = await dbPromise;
  const contentVotes = await db.all(
    "SELECT score FROM votes WHERE contentId = ?",
    contentId
  );

  if (contentVotes.length === 0) return;

  const total = contentVotes.reduce((acc, v) => acc + v.score, 0);
  const averageScore = total / contentVotes.length;
  await db.run(
    "UPDATE contents SET voteAverageScore = ? WHERE id = ?",
    averageScore,
    contentId
  );
};

app.get("/likes/:userId", async (req, res) => {
  const db = await dbPromise;
  const userId = req.params.userId;
  const likes = await db.all("SELECT * FROM likes WHERE userId = ?", userId);
  res.status(200).json({ likes });
});

app.put("/likes/:userId", async (req, res) => {
  const db = await dbPromise;
  const userId = req.params.userId;
  const { contentId, voteUserId } = req.body;

  await db.run(
    "INSERT INTO likes (userId, contentId, voteUserId) VALUES (?, ?, ?)",
    userId,
    contentId,
    voteUserId
  );
  await db.run(
    "UPDATE votes SET like = like + 1 WHERE contentId = ? AND userId = ?",
    contentId,
    voteUserId
  );

  res.status(200).json({ message: "Operation was successful." });
});

const EXPRESS_PORT = process.env.PORT || 3000;

app.listen(EXPRESS_PORT, () => {
  console.log("Server is running");
});
