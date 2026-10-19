const express = require('express');
const loanService = require('../services/loanService');
const { requireLibrarian } = require('../middleware/authorize');

const router = express.Router();

router.post('/', (req, res) => {
  res.status(201).json(loanService.borrowBook(req.body, req.user));
});

router.get('/overdue', requireLibrarian, (req, res) => {
  res.status(200).json(loanService.listOverdueLoans());
});

router.post('/:id/return', (req, res) => {
  res.status(200).json(loanService.returnLoan(req.params.id, req.user));
});

module.exports = router;
