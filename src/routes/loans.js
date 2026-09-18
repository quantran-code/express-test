const express = require('express');
const loanService = require('../services/loanService');

const router = express.Router();

router.post('/', (req, res, next) => {
  try {
    const { memberId, bookId } = req.body || {};
    const loan = loanService.createLoan({ memberId, bookId });
    res.status(201).json(loan);
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const loans = loanService.listLoans();
    res.status(200).json(loans);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const loan = loanService.getLoanById(req.params.id);
    if (!loan) {
      return res.status(404).json({ error: 'Not Found' });
    }
    res.status(200).json(loan);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/return', (req, res, next) => {
  try {
    const loan = loanService.returnLoan(req.params.id);
    res.status(200).json(loan);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
