const express = require('express');
const router = express.Router();

// A simple health check endpoint
router.get('/', (req, res) => {
  // You can add more checks here, like database connectivity
  const healthStatus = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
  res.status(200).json(healthStatus);
});

module.exports = router;
