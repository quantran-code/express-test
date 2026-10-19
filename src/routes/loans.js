const express = require('express');
const loanService = require('../services/loanService');

const router = express.Router();

router.post('/', (req, res) => {
  res.status(201).json(loanService.borrowBook(req.body));
});

router.post('/:id/return', (req, res) => {
  res.status(200).json(loanService.returnLoan(req.params.id));
});

module.exports = router;
