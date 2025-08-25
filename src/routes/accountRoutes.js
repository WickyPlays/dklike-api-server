const express = require("express");
const router = express.Router();
const { query } = require("../database");

router.post("/", async (req, res) => {
  try {
    const { accountId, password, name, icon } = req.body;

    const existingAccount = await query(
      `SELECT * FROM accounts WHERE account_id = $1`,
      [accountId]
    );

    if (existingAccount.rows.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Account ID already exists.'
      });
      return;
    }

    await query(
      `INSERT INTO accounts (account_id, password, name, icon) VALUES ($1, $2, $3, $4)`,
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

    if (!accountId || !token) {
      res.status(400).json({
        success: false,
        message: 'accountId and token are required.'
      });
      return;
    }

    const account = await query(
      `SELECT * FROM accounts WHERE account_id = $1 AND token = $2`,
      [accountId, token]
    );

    if (account.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Account not found or invalid token.'
      });
      return;
    }

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = $' + (updateValues.length + 1));
      updateValues.push(name);
    }

    if (icon !== undefined) {
      updateFields.push('icon = $' + (updateValues.length + 1));
      updateValues.push(icon);
    }

    if (password !== undefined) {
      updateFields.push('password = $' + (updateValues.length + 1));
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

    await query(
      `UPDATE accounts SET ${updateFields.join(', ')} WHERE account_id = $${updateValues.length - 1} AND token = $${updateValues.length}`,
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

module.exports = router;