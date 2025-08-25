const express = require("express");
const router = express.Router();
const { query } = require("../database");

router.get("/", async (req, res) => {
  try {
    const { chartHash, difficulty } = req.query;

    if (!chartHash || !difficulty) {
      res.status(400).json({
        error: "chartHash and difficulty are required"
      });
      return;
    }

    const result = await query(
      `SELECT r.*, a.name, a.icon 
       FROM ranking r 
       LEFT JOIN accounts a ON r.account_id = a.account_id 
       WHERE r.chart_hash = $1 AND r.difficulty = $2 
       ORDER BY r.score DESC, r.ab_count DESC 
       LIMIT 200`,
      [chartHash, difficulty]
    );

    const data = result.rows.map(r => ({
      score: r.score,
      abCount: r.ab_count,
      date: r.date,
      account: r.account_id ? {
        name: r.name,
        icon: r.icon
      } : null
    }));

    res.status(200).json({ ranking: data });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { songTitle, difficulty, chartHash, accountId, accountToken, score, maxScore } = req.body;

    if (!songTitle || !chartHash || !accountId || !accountToken || score == null || maxScore == null) {
      res.status(400).json({ error: "songTitle, chartHash, accountId, accountToken, score, and maxScore are required" });
      return;
    }

    const account = await query(
      `SELECT * FROM accounts WHERE account_id = $1 AND token = $2`,
      [accountId, accountToken]
    );

    if (account.rows.length === 0) {
      return res.status(403).json({ error: "Your account login token is invalid" });
    }

    const today = new Date().toISOString().split("T")[0];

    const existing = await query(
      `SELECT * FROM ranking WHERE song_title = $1 AND difficulty = $2 AND chart_hash = $3 AND account_id = $4`,
      [songTitle, difficulty, chartHash, accountId]
    );

    if (existing.rows.length > 0) {
      let updated = false;
      let newScore = existing.rows[0].score;
      let newAbCount = existing.rows[0].ab_count;
      let newDate = existing.rows[0].date;

      if (score > (existing.rows[0].score || 0)) {
        newScore = score;
        newDate = today;
        updated = true;
      }

      if (score === maxScore) {
        newAbCount = (existing.rows[0].ab_count || 0) + 1;
        newDate = today;
        updated = true;
      }

      if (updated) {
        await query(
          `UPDATE ranking SET score = $1, ab_count = $2, date = $3 
           WHERE song_title = $4 AND difficulty = $5 AND chart_hash = $6 AND account_id = $7`,
          [newScore, newAbCount, newDate, songTitle, difficulty, chartHash, accountId]
        );

        res.status(200).json({ message: "Ranking updated successfully." });
        return;
      } else {
        res.status(200).json({ message: "No ranking update needed." });
        return;
      }
    }

    await query(
      `INSERT INTO ranking (song_title, difficulty, chart_hash, account_id, score, ab_count, date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        songTitle,
        difficulty,
        chartHash,
        accountId,
        score,
        score === maxScore ? 1 : 0,
        today
      ]
    );

    res.status(201).json({ message: "Ranking created successfully." });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;