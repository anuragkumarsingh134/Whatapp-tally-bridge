const express = require('express');
const router = express.Router();
const { handleCopy } = require('../services/copy.service');

router.all('/copy', (req, res) => handleCopy(req, res));
router.all('/api/stamp-and-copy', (req, res) => handleCopy(req, res, 'stamp'));

module.exports = router;

