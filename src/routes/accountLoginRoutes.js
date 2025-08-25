const express = require("express");
const router = express.Router();
const { dbPromise } = require("../database");
const jwt = require("jsonwebtoken");

router.post("/", async (req, res) => {
  try {
    const { accountId, password } = req.body;
    const db = await dbPromise;

    const account = await db.get(
      `SELECT * FROM accounts WHERE accountId = ?`,
      [accountId]
    );
    
    if (!account) {
      res.status(401).json({ success: false, message: 'Account not found.' });
      return;
    }

    if (account.password !== password) {
      res.status(401).json({ success: false, message: 'Wrong password.' });
      return;
    }

    const token = jwt.sign({ aid: account.accountId }, req.app.get('jwtToken'), {
      expiresIn: '24h'
    });

    await db.run(
      `UPDATE accounts SET token = ? WHERE accountId = ?`,
      [token, accountId]
    );

    res.status(200).json({
      success: true,
      message: 'Authentication successful.',
      account: {
        accountId: account.accountId,
        token: token,
        password: account.password,
        name: account.name,
        icon: account.icon
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;