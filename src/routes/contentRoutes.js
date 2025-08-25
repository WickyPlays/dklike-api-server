const express = require("express");
const router = express.Router();
const { dbPromise } = require("../database");
const { convertLinkToDownloadable } = require("../converter.js");

router.get("/", async (req, res) => {
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

router.get("/:id", async (req, res) => {
  const id = req.params.id;
  const db = await dbPromise;
  const content = await db.get(`SELECT * FROM contents WHERE id = ?`, [id]);
  if (content) {
    content.downloadUrl = convertLinkToDownloadable(content.downloadUrl);
  }
  res.status(200).json({ contents: content });
});

router.get("/:id/description", async (req, res) => {
  const id = req.params.id;
  const db = await dbPromise;
  const content = await db.get(`SELECT description, downloadUrl, imageUrl FROM contents WHERE id = ?`, [id]);
  if (content) {
    content.downloadUrl = convertLinkToDownloadable(content.downloadUrl);
  }
  res.status(200).json(content);
});

router.put("/:id/downloaded", async (req, res) => {
  const id = req.params.id;
  const db = await dbPromise;
  try {
    await db.run(`UPDATE contents SET downloadCount = downloadCount + 1 WHERE id = ?`, [id]);
    res.status(200).json({ message: "Operation was successful." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;