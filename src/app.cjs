const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const { convertLinkToDownloadable } = require("./converter.cjs");

const app = express();
app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

const dbPromise = open({
  filename: './src/database/charts.db',
  driver: sqlite3.Database
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
})();

const successMessage = { message: "Operation was successful." };

function transformContent(content) {
  return {
    id: Number(content.id),
    contentType: Number(content.contentType),
    title: content.title,
    publisher: content.publisher,
    description: content.description,
    downloadUrl: convertLinkToDownloadable(content.downloadUrl),
    imageUrl: content.imageUrl,
    date: new Date(content.date),
    downloadCount: Number(content.downloadCount),
    voteAverageScore: Number(content.voteAverageScore),
    songInfo: JSON.parse(content.songInfo || '{"difficulties":[0,0,0,0,0],"hasLua":false}')
  };
}

app.get("/", async (req, res) => {
  const db = await dbPromise;

  // Get the search parameters and pagination values
  const searchBy = req.query.searchBy || "title";
  const search = req.query.search || ""; // Default to empty string
  const page = parseInt(req.query.page) || 1; // Default to page 1
  const itemsPerPage = 15;
  const offset = (page - 1) * itemsPerPage;

  try {
    let whereClause = "";
    let params = [itemsPerPage, offset];

    // Add a WHERE clause if there is a search term
    if (search.trim()) {
      whereClause = `WHERE ${searchBy} LIKE ?`;
      params = [`%${search}%`, ...params];
    }

    // Fetch the total number of matching contents
    const totalContentsQuery = `
      SELECT COUNT(*) AS count FROM contents ${whereClause}
    `;
    const totalContents = await db.get(totalContentsQuery, params.slice(0, -2)); // Use only the first parameter for the count query
    const totalPages = Math.ceil(totalContents.count / itemsPerPage);

    // Fetch the current page of contents
    const contentsQuery = `
      SELECT * FROM contents ${whereClause} LIMIT ? OFFSET ?
    `;
    const contents = await db.all(contentsQuery, params);

    // Transform contents for the template
    const list = contents.map(transformContent);
    const contentsWithFormattedDate = list.map((content) => ({
      ...content,
      date: content.date.toISOString().slice(0, 10).replace(/-/g, "/"),
    }));

    // Render the page
    res.render("main", {
      contents: contentsWithFormattedDate,
      currentPage: page,
      totalPages: totalPages,
      totalCount: totalContents.count,
      searchBy: searchBy,
      search: search,
    });
  } catch (error) {
    console.error("Database query error:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/support", async (req, res) => {
  res.status(200).json({
    contents: true
  });
});

app.get("/contents", async (req, res) => {
  const db = await dbPromise;
  const contents = await db.all(`SELECT * FROM contents`);
  const list = contents.map(c => ({
    id: c.id,
    contentType: c.contentType,
    title: c.title,
    publisher: c.publisher,
    date: c.date,
    downloadCount: c.downloadCount,
    voteAverageScore: c.voteAverageScore,
    songInfo: JSON.parse(c.songInfo || '{}'),
    downloadUrl: convertLinkToDownloadable(c.downloadUrl)
  }));
  res.status(200).json({ contents: list });
});

app.get("/contents/:id", async (req, res) => {
  const id = req.params.id;
  const db = await dbPromise;
  const content = await db.get(`SELECT * FROM contents WHERE id = ?`, [id]);
  if (content) {
    content.downloadUrl = convertLinkToDownloadable(content.downloadUrl);
  }
  res.status(200).json({ contents: content });
});

app.get("/contents/:id/description", async (req, res) => {
  const id = req.params.id;
  const db = await dbPromise;
  const content = await db.get(`SELECT description, downloadUrl, imageUrl FROM contents WHERE id = ?`, [id]);
  if (content) {
    content.downloadUrl = convertLinkToDownloadable(content.downloadUrl);
  }
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
