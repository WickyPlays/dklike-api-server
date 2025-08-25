const express = require("express");
const router = express.Router();
const { query } = require("../database");
const jwt = require("jsonwebtoken");

router.post("/", async (req, res) => {
  try {
    const { accountId, password } = req.body;

    const result = await query(
      `SELECT * FROM accounts WHERE account_id = $1`,
      [accountId]
    );
    const account = result.rows[0];

    if (!account) {
      res.status(401).json({ success: false, message: 'Account not found.' });
      return;
    }

    if (account.password !== password) {
      res.status(401).json({ success: false, message: 'Wrong password.' });
      return;
    }

    const token = jwt.sign({ aid: account.account_id }, req.app.get('jwtToken'), {
      expiresIn: '24h'
    });

    await query(
      `UPDATE accounts SET token = $1 WHERE account_id = $2`,
      [token, accountId]
    );

    res.status(200).json({
      success: true,
      message: 'Authentication successful.',
      account: {
        accountId: account.account_id,
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