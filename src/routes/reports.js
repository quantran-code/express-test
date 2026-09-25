const express = require('express');
const reportService = require('../services/reportService');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('librarian'));

router.get('/most-borrowed', (req, res, next) => {
  try {
    const report = reportService.mostBorrowedBooks();
    res.status(200).json(report);
  } catch (err) {
    next(err);
  }
});

router.get('/overdue-summary', (req, res, next) => {
  try {
    const report = reportService.overdueSummary();
    res.status(200).json(report);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
