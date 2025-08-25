const express = require("express");
const router = express.Router();
const { query } = require("../database");

router.get("/:userId", async (req, res) => {
  const userId = req.params.userId;
  const result = await query(`SELECT * FROM likes WHERE user_id = $1`, [userId]);
  const likes = result.rows.map(l => ({
    userId: l.user_id,
    voteId: l.vote_id
  }));
  res.status(200).json({ likes });
});

router.put("/:userId", async (req, res) => {
  const voteId = req.body.voteId;
  const userId = req.params.userId;
  try {
    await query(`INSERT INTO likes (user_id, vote_id) VALUES ($1, $2)`, [userId, voteId]);
    await query(`UPDATE votes SET "like" = "like" + 1 WHERE id = $1`, [voteId]);
    res.status(200).json({ message: "Operation was successful." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;