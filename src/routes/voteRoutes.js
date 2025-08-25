const express = require("express");
const router = express.Router();
const { query } = require("../database");

async function updateVoteAverageScore(contentId) {
  const votes = await query(`SELECT score FROM votes WHERE content_id = $1`, [contentId]);
  if (votes.rows.length === 0) return;
  const total = votes.rows.reduce((sum, v) => sum + v.score, 0);
  const averageScore = total / votes.rows.length;
  await query(`UPDATE contents SET vote_average_score = $1 WHERE id = $2`, [averageScore, contentId]);
}

router.get("/", async (req, res) => {
  const result = await query(`SELECT * FROM votes`);
  const votes = result.rows.map(v => ({
    id: v.id,
    contentId: v.content_id,
    userId: v.user_id,
    name: v.name,
    score: v.score,
    comment: v.comment,
    like: v.like,
    date: v.date
  }));
  res.status(200).json({ votes });
});

router.get("/:contentId", async (req, res) => {
  const id = req.params.contentId;
  const result = await query(`SELECT * FROM votes WHERE content_id = $1`, [id]);
  const votes = result.rows.map(v => ({
    id: v.id,
    contentId: v.content_id,
    userId: v.user_id,
    name: v.name,
    score: v.score,
    comment: v.comment,
    like: v.like,
    date: v.date
  }));
  res.status(200).json({ votes });
});

router.post("/:contentId", async (req, res) => {
  const contentId = req.params.contentId;
  try {
    await query(
      `INSERT INTO votes (content_id, user_id, name, score, comment, "like", date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
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
    await updateVoteAverageScore(contentId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/:contentId", async (req, res) => {
  const contentId = req.params.contentId;
  const voteId = req.body.id;
  try {
    await query(
      `UPDATE votes SET name = $1, score = $2, comment = $3, "like" = 0, date = $4 
       WHERE id = $5 AND user_id = $6`,
      [
        req.body.name,
        req.body.score,
        req.body.comment,
        req.body.date,
        voteId,
        req.body.userId
      ]
    );

    await query(`DELETE FROM likes WHERE vote_id = $1`, [voteId]);
    res.status(200).json({ message: "Operation was successful." });
    await updateVoteAverageScore(contentId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;