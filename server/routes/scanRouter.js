const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scanController');

router.post('/screen', scanController.scanName);

module.exports = router;
