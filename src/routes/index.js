const express = require('express');
const healthRoutes = require('./health');
const authRoutes = require('./auth');
const bookRoutes = require('./books');
const memberRoutes = require('./members');
const loanRoutes = require('./loans');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

// /health and /auth stay public; every resource router below requires a token.
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/books', authenticate, bookRoutes);
router.use('/members', authenticate, memberRoutes);
router.use('/loans', authenticate, loanRoutes);

module.exports = router;
