const express = require('express');
const healthRoutes = require('./health');
const bookRoutes = require('./books');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/books', bookRoutes);

module.exports = router;
