const express = require('express');
const healthRoutes = require('./health');
const booksRoutes = require('./books');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/books', booksRoutes);

module.exports = router;
