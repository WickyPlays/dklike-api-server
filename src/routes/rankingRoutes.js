const express = require("express");
const router = express.Router();
const { dbPromise } = require("../database");

router.get("/", async (req, res) => {
  try {
    const { chartHash, difficulty } = req.query;
    const db = await dbPromise;

    if (!chartHash || !difficulty) {
      res.status(400).json({
        error: "chartHash and difficulty are required"
      });
      return;
    }

    const ranking = await db.all(
      `SELECT r.*, a.name, a.icon 
       FROM ranking r 
       LEFT JOIN accounts a ON r.accountId = a.accountId 
       WHERE r.chartHash = ? AND r.difficulty = ? 
       ORDER BY r.score DESC, r.abCount DESC 
       LIMIT 200`,
      [chartHash, difficulty]
    );

    const data = ranking.map(r => ({
      score: r.score,
      abCount: r.abCount,
      date: r.date,
      account: r.accountId ? {
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
    const db = await dbPromise;

    if (!songTitle || !chartHash || !accountId || !accountToken || score == null || maxScore == null) {
      res.status(400).json({ error: "songTitle, chartHash, accountId, accountToken, score, and maxScore are required" });
      return;
    }

    const account = await db.get(
      `SELECT * FROM accounts WHERE accountId = ? AND token = ?`,
      [accountId, accountToken]
    );
    
    if (!account) {
      return res.status(403).json({ error: "Your account login token is invalid" });
    }

    const today = new Date().toISOString().split("T")[0];

    const existing = await db.get(
      `SELECT * FROM ranking WHERE songTitle = ? AND difficulty = ? AND chartHash = ? AND accountId = ?`,
      [songTitle, difficulty, chartHash, accountId]
    );

    if (existing) {
      let updated = false;
      let newScore = existing.score;
      let newAbCount = existing.abCount;
      let newDate = existing.date;

      if (score > (existing.score || 0)) {
        newScore = score;
        newDate = today;
        updated = true;
      }

      if (score === maxScore) {
        newAbCount = (existing.abCount || 0) + 1;
        newDate = today;
        updated = true;
      }

      if (updated) {
        await db.run(
          `UPDATE ranking SET score = ?, abCount = ?, date = ? 
           WHERE songTitle = ? AND difficulty = ? AND chartHash = ? AND accountId = ?`,
          [newScore, newAbCount, newDate, songTitle, difficulty, chartHash, accountId]
        );
        
        res.status(200).json({ message: "Ranking updated successfully." });
        return;
      } else {
        res.status(200).json({ message: "No ranking update needed." });
        return;
      }
    }

    await db.run(
      `INSERT INTO ranking (songTitle, difficulty, chartHash, accountId, score, abCount, date) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
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