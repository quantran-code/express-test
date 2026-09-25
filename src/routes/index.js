const express = require('express');
const healthRoutes = require('./health');
const bookRoutes = require('./books');
const memberRoutes = require('./members');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/books', bookRoutes);
router.use('/members', memberRoutes);

module.exports = router;
