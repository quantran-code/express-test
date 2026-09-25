const express = require('express');
const loanService = require('../services/loanService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.post('/', (req, res, next) => {
  try {
    const loan = loanService.createLoan(req.body);
    res.status(201).json({ id: loan.id, dueDate: loan.dueDate });
  } catch (err) {
    next(err);
  }
});

router.get('/overdue', (req, res, next) => {
  try {
    const overdueLoans = loanService.listOverdueLoans();
    res.status(200).json(overdueLoans);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/return', (req, res, next) => {
  try {
    const loan = loanService.returnLoan(req.params.id);
    res.status(200).json({ id: loan.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
