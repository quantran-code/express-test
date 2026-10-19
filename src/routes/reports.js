const express = require('express');
const reportService = require('../services/reportService');

const router = express.Router();

router.get('/most-borrowed', (req, res) => {
  res.status(200).json(reportService.mostBorrowedBooks());
});

router.get('/overdue-summary', (req, res) => {
  res.status(200).json(reportService.overdueSummary());
});

module.exports = router;
