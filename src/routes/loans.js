const express = require('express');
const loanService = require('../services/loanService');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.post('/', (req, res, next) => {
  try {
    // eslint-disable-next-line eqeqeq
    if (req.user.role !== 'librarian' && String(req.body && req.body.memberId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const loan = loanService.createLoan(req.body);
    res.status(201).json({ id: loan.id, dueDate: loan.dueDate });
  } catch (err) {
    next(err);
  }
});

router.get('/overdue', requireRole('librarian'), (req, res, next) => {
  try {
    const overdueLoans = loanService.listOverdueLoans();
    res.status(200).json(overdueLoans);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/return', (req, res, next) => {
  try {
    const loan = loanService.getLoanById(req.params.id);
    if (!loan) {
      const err = new Error('Loan not found');
      err.status = 404;
      throw err;
    }

    // eslint-disable-next-line eqeqeq
    if (req.user.role !== 'librarian' && loan.memberId != req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const returned = loanService.returnLoan(req.params.id);
    res.status(200).json({ id: returned.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
