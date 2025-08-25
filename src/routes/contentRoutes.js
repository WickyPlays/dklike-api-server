const express = require("express");
const router = express.Router();
const { query } = require("../database");
const { convertLinkToDownloadable } = require("../converter.js");

router.get("/", async (req, res) => {
  const result = await query(`SELECT * FROM contents`);
  const list = result.rows.map(c => ({
    id: c.id,
    contentType: c.content_type,
    title: c.title,
    publisher: c.publisher,
    date: c.date,
    downloadCount: c.download_count,
    voteAverageScore: c.vote_average_score,
    songInfo: JSON.parse(c.song_info || '{}'),
    downloadUrl: convertLinkToDownloadable(c.download_url)
  }));
  res.status(200).json({ contents: list });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id;
  const result = await query(`SELECT * FROM contents WHERE id = $1`, [id]);
  let content = result.rows[0];
  if (content) {
    content = {
      id: content.id,
      contentType: content.content_type,
      title: content.title,
      publisher: content.publisher,
      description: content.description,
      downloadUrl: convertLinkToDownloadable(content.download_url),
      imageUrl: content.image_url,
      date: content.date,
      downloadCount: content.download_count,
      voteAverageScore: content.vote_average_score,
      songInfo: JSON.parse(content.song_info || '{}')
    };
  }
  res.status(200).json({ contents: content });
});

router.get("/:id/description", async (req, res) => {
  const id = req.params.id;
  const result = await query(`SELECT description, download_url, image_url FROM contents WHERE id = $1`, [id]);
  let content = result.rows[0];
  if (content) {
    content = {
      description: content.description,
      downloadUrl: convertLinkToDownloadable(content.download_url),
      imageUrl: content.image_url
    };
  }
  res.status(200).json(content);
});

router.put("/:id/downloaded", async (req, res) => {
  const id = req.params.id;
  try {
    await query(`UPDATE contents SET download_count = download_count + 1 WHERE id = $1`, [id]);
    res.status(200).json({ message: "Operation was successful." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;