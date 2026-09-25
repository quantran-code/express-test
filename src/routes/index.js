const express = require('express');
const healthRoutes = require('./health');
const authRoutes = require('./auth');
const bookRoutes = require('./books');
const memberRoutes = require('./members');
const loanRoutes = require('./loans');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/books', bookRoutes);
router.use('/members', memberRoutes);
router.use('/loans', loanRoutes);

module.exports = router;
