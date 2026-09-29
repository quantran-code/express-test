const express = require('express');
const healthRoutes = require('./health');
const booksRoutes = require('./books');
const membersRoutes = require('./members');
const authRoutes = require('./auth');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/books', booksRoutes);
router.use('/members', membersRoutes);

module.exports = router;
