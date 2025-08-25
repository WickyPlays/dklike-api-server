const express = require("express");
const router = express.Router();
const { dbPromise } = require("../database");
const jwt = require("jsonwebtoken");

router.post("/", async (req, res) => {
  try {
    const { accountId, password, name, icon } = req.body;
    const db = await dbPromise;

    const existingAccount = await db.get(
      `SELECT * FROM accounts WHERE accountId = ?`,
      [accountId]
    );
    
    if (existingAccount) {
      res.status(400).json({
        success: false,
        message: 'Account ID already exists.'
      });
      return;
    }

    await db.run(
      `INSERT INTO accounts (accountId, password, name, icon) VALUES (?, ?, ?, ?)`,
      [accountId, password, name, icon || 0]
    );

    res.status(201).json({
      success: true,
      message: 'Account successfully created.'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.put("/", async (req, res) => {
  try {
    const { accountId, token, name, icon, password } = req.body;
    const db = await dbPromise;

    if (!accountId || !token) {
      res.status(400).json({
        success: false,
        message: 'accountId and token are required.'
      });
      return;
    }

    const account = await db.get(
      `SELECT * FROM accounts WHERE accountId = ? AND token = ?`,
      [accountId, token]
    );
    
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found or invalid token.'
      });
      return;
    }

    const updateFields = [];
    const updateValues = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    
    if (icon !== undefined) {
      updateFields.push('icon = ?');
      updateValues.push(icon);
    }
    
    if (password !== undefined) {
      updateFields.push('password = ?');
      updateValues.push(password);
    }
    
    if (updateFields.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No fields to update.'
      });
      return;
    }
    
    updateValues.push(accountId, token);
    
    await db.run(
      `UPDATE accounts SET ${updateFields.join(', ')} WHERE accountId = ? AND token = ?`,
      updateValues
    );

    res.status(200).json({
      success: true,
      message: 'Account updated successfully.'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post("/login", async (req, res) => {
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
        name: account.name,
        icon: account.icon
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;