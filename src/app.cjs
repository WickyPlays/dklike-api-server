const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const { convertLinkToDownloadable } = require("./converter.cjs");
require('dotenv').config();

const app = express();
app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  //Necessary for Render hosting (maybe)
  ssl: {
    rejectUnauthorized: false,
  },
});

(async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS contents (
      id SERIAL PRIMARY KEY,
      contentType INTEGER NOT NULL,
      title TEXT,
      publisher TEXT,
      description TEXT,
      downloadUrl TEXT,
      imageUrl TEXT,
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      downloadCount INTEGER DEFAULT 0,
      voteAverageScore REAL DEFAULT 0,
      songInfo JSONB
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      contentId INTEGER NOT NULL REFERENCES contents(id),
      userId TEXT NOT NULL,
      name TEXT,
      score INTEGER,
      comment TEXT,
      likeCount INTEGER DEFAULT 0,
      date TEXT NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS likes (
      userId TEXT NOT NULL,
      voteId INTEGER NOT NULL REFERENCES votes(id),
      PRIMARY KEY(userId, voteId)
    )`);
  } finally {
    client.release();
  }
})();

const successMessage = { message: "Operation was successful." };

function transformContent(content) {
  return {
    id: Number(content.id),
    contentType: Number(content.contenttype),
    title: content.title,
    publisher: content.publisher,
    description: content.description,
    downloadUrl: convertLinkToDownloadable(content.downloadurl),
    imageUrl: content.imageurl,
    date: new Date(content.date),
    downloadCount: Number(content.downloadcount),
    voteAverageScore: Number(content.voteaveragescore),
    songInfo: content.songinfo || { difficulties: [0, 0, 0, 0, 0], hasLua: false },
  };
}

app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM contents");
    res.render("main", { contents: result.rows.map(transformContent) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/support", async (req, res) => {
  res.status(200).json({ contents: true });
});

app.get("/contents", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM contents");
    res.status(200).json({ contents: result.rows.map(transformContent) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/contents/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM contents WHERE id = $1", [req.params.id]);
    if (result.rows.length > 0) {
      res.status(200).json({ content: transformContent(result.rows[0]) });
    } else {
      res.status(404).json({ message: "Content not found." });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/contents/:id/description", async (req, res) => {
  try {
    const result = await pool.query("SELECT description, downloadUrl, imageUrl FROM contents WHERE id = $1", [req.params.id]);
    if (result.rows.length > 0) {
      res.status(200).json(result.rows[0]);
    } else {
      res.status(404).json({ message: "Content not found." });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/contents/:id/downloaded", async (req, res) => {
  try {
    await pool.query("UPDATE contents SET downloadCount = downloadCount + 1 WHERE id = $1", [req.params.id]);
    res.status(200).send(successMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/votes", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM votes");
    res.status(200).json({ votes: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/contents/:id/vote", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM votes WHERE contentId = $1", [req.params.id]);
    res.status(200).json({ votes: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/contents/:id/vote", async (req, res) => {
  const { userId, name, score, comment, like, date } = req.body;
  try {
    await pool.query(
      "INSERT INTO votes (contentId, userId, name, score, comment, likeCount, date) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [req.params.id, userId, name, score, comment, like || 0, date]
    );
    res.status(200).send(successMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/likes/:userId", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM likes WHERE userId = $1", [req.params.userId]);
    res.status(200).json({ likes: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/likes/:userId", async (req, res) => {
  try {
    await pool.query("INSERT INTO likes (userId, voteId) VALUES ($1, $2)", [req.params.userId, req.body.voteId]);
    await pool.query("UPDATE votes SET likeCount = likeCount + 1 WHERE id = $1", [req.body.voteId]);
    res.status(200).send(successMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const EXPRESS_PORT = process.env.PORT || 3000;
app.listen(EXPRESS_PORT, () => {
  console.log("server running");
});
