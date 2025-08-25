const express = require("express");
const router = express.Router();
const { dbPromise } = require("../database");

async function updateVoteAverageScore(contentId) {
  const db = await dbPromise;
  const votes = await db.all(`SELECT score FROM votes WHERE contentId = ?`, [contentId]);
  if (votes.length === 0) return;
  const total = votes.reduce((sum, v) => sum + v.score, 0);
  const averageScore = total / votes.length;
  await db.run(`UPDATE contents SET voteAverageScore = ? WHERE id = ?`, [averageScore, contentId]);
}

router.get("/", async (req, res) => {
  const db = await dbPromise;
  const votes = await db.all(`SELECT * FROM votes`);
  res.status(200).json({ votes });
});

router.get("/:contentId", async (req, res) => {
  const id = req.params.contentId;
  const db = await dbPromise;
  const votes = await db.all(`SELECT * FROM votes WHERE contentId = ?`, [id]);
  res.status(200).json({ votes });
});

router.post("/:contentId", async (req, res) => {
  const contentId = req.params.contentId;
  const db = await dbPromise;
  try {
    const result = await db.run(
      `INSERT INTO votes (contentId, userId, name, score, comment, like, date) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        contentId,
        req.body.userId,
        req.body.name,
        req.body.score,
        req.body.comment,
        req.body.like || 0,
        req.body.date
      ]
    );
    
    res.status(200).json({ message: "Operation was successful." });
    updateVoteAverageScore(contentId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/:contentId", async (req, res) => {
  const contentId = req.params.contentId;
  const voteId = req.body.id;
  const db = await dbPromise;
  try {
    await db.run(
      `UPDATE votes SET name = ?, score = ?, comment = ?, like = 0, date = ? 
       WHERE id = ? AND userId = ?`,
      [
        req.body.name,
        req.body.score,
        req.body.comment,
        req.body.date,
        voteId,
        req.body.userId
      ]
    );
    
    await db.run(`DELETE FROM likes WHERE voteId = ?`, [voteId]);
    res.status(200).json({ message: "Operation was successful." });
    updateVoteAverageScore(contentId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;