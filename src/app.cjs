const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const { google } = require("googleapis");
const cron = require("node-cron");

require("dotenv").config();

const app = express();
app.use(express.json());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, "../.data/service_account.json"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = "Charts";

const dbPromise = open({
  filename: "./src/database/charts.db",
  driver: sqlite3.Database,
});

(async function initializeDatabase() {
  const db = await dbPromise;

  await db.exec(`CREATE TABLE IF NOT EXISTS contents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contentType INTEGER NOT NULL,
    title TEXT,
    publisher TEXT,
    description TEXT,
    downloadUrl TEXT,
    imageUrl TEXT,
    date DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
})();

const successMessage = { message: "Operation was successful." };

// Synchronize spreadsheet data with database
async function syncSpreadsheetToDatabase() {
  const db = await dbPromise;
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:K`, // Skip the first row
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      console.log("No data found in the spreadsheet.");
      return;
    }

    await db.run("DELETE FROM contents");

    for (const row of rows) {
      const [id, contentType, title, publisher, description, downloadUrl, imageUrl, date, downloadCount, voteAverageScore, songInfo] = row;

      await db.run(
        `INSERT INTO contents (id, contentType, title, publisher, description, downloadUrl, imageUrl, date, downloadCount, voteAverageScore, songInfo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          contentType,
          title,
          publisher,
          description,
          downloadUrl,
          imageUrl,
          date,
          downloadCount || 0,
          voteAverageScore || 0,
          songInfo || null,
        ]
      );
    }

    console.log("Spreadsheet data successfully synchronized with the database.");
  } catch (error) {
    console.error("Error synchronizing spreadsheet to database:", error);
  }
}

syncSpreadsheetToDatabase();

// Schedule synchronization every 30 minutes
cron.schedule("*/30 * * * *", syncSpreadsheetToDatabase);

app.get("/", async (req, res) => {
  const db = await dbPromise;
  const contents = await db.all(`SELECT * FROM contents`);
  const list = contents.map((c) => ({
    id: c.id,
    contentType: c.contentType,
    title: c.title,
    publisher: c.publisher,
    date: c.date,
    downloadCount: c.downloadCount,
    voteAverageScore: c.voteAverageScore,
    songInfo: JSON.parse(c.songInfo || '{"difficulties":[0,0,0,0,0],"hasLua":false}'),
    downloadUrl: c.downloadUrl,
  }));
  res.render("main", { contents: list });
});

app.get("/contents", async (req, res) => {
  const db = await dbPromise;
  const contents = await db.all(`SELECT * FROM contents`);
  res.status(200).json({ contents });
});

app.get("/contents/:id", async (req, res) => {
  const id = req.params.id;
  const db = await dbPromise;
  const content = await db.get(`SELECT * FROM contents WHERE id = ?`, [id]);
  res.status(200).json({ content });
});

app.get("/contents/:id/description", async (req, res) => {
  const id = req.params.id;
  const db = await dbPromise;
  const content = await db.get(`SELECT description, downloadUrl, imageUrl FROM contents WHERE id = ?`, [id]);
  res.status(200).json(content);
});

app.put("/contents/:id/downloaded", async (req, res) => {
  const id = req.params.id;
  const db = await dbPromise;
  try {
    await db.run(`UPDATE contents SET downloadCount = downloadCount + 1 WHERE id = ?`, [id]);
    res.status(200).send(successMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/votes", async (req, res) => {
  const db = await dbPromise;
  const votes = await db.all(`SELECT * FROM votes`);
  res.status(200).json({ votes });
});

app.get("/contents/:id/vote", async (req, res) => {
  const id = req.params.id;
  const db = await dbPromise;
  const votes = await db.all(`SELECT * FROM votes WHERE contentId = ?`, [id]);
  res.status(200).json({ votes });
});

app.post("/contents/:id/vote", async (req, res) => {
  const contentId = req.params.id;
  const db = await dbPromise;
  try {
    await db.run(`INSERT INTO votes (contentId, userId, name, score, comment, like, date) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
      contentId,
      req.body.userId,
      req.body.name,
      req.body.score,
      req.body.comment,
      req.body.like || 0,
      req.body.date
    ]);
    res.status(200).send(successMessage);
    updateVoteAverageScore(contentId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/contents/:id/vote", async (req, res) => {
  const contentId = req.params.id;
  const voteId = req.body.id;
  const db = await dbPromise;
  try {
    await db.run(`UPDATE votes SET name = ?, score = ?, comment = ?, like = 0, date = ? WHERE id = ? AND userId = ?`, [
      req.body.name,
      req.body.score,
      req.body.comment,
      req.body.date,
      voteId,
      req.body.userId
    ]);
    await db.run(`DELETE FROM likes WHERE voteId = ?`, [voteId]);
    res.status(200).send(successMessage);
    updateVoteAverageScore(contentId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const updateVoteAverageScore = async (contentId) => {
  const db = await dbPromise;
  const votes = await db.all(`SELECT score FROM votes WHERE contentId = ?`, [contentId]);
  if (votes.length === 0) return;
  const total = votes.reduce((sum, v) => sum + v.score, 0);
  const averageScore = total / votes.length;
  await db.run(`UPDATE contents SET voteAverageScore = ? WHERE id = ?`, [averageScore, contentId]);
};

app.get("/likes/:userId", async (req, res) => {
  const userId = req.params.userId;
  const db = await dbPromise;
  const likes = await db.all(`SELECT * FROM likes WHERE userId = ?`, [userId]);
  res.status(200).json({ likes });
});

app.put("/likes/:userId", async (req, res) => {
  const voteId = req.body.voteId;
  const userId = req.params.userId;
  const db = await dbPromise;
  try {
    await db.run(`INSERT INTO likes (userId, voteId) VALUES (?, ?)`, [userId, voteId]);
    await db.run(`UPDATE votes SET like = like + 1 WHERE id = ?`, [voteId]);
    res.status(200).send(successMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const EXPRESS_PORT = process.env.PORT || 3000;

app.listen(EXPRESS_PORT, () => {
  console.log("server running");
});
