// server/routes/falsePositives.js
const express = require('express');
const router = express.Router();
const { addFalsePositive } = require('../services/falsePositiveService');

// POST endpoint to add a name to the false positive list
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const result = await addFalsePositive(name);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

module.exports = router;
