const express = require('express');
const memberService = require('../services/memberService');
const loanService = require('../services/loanService');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.post('/', requireRole('librarian'), (req, res, next) => {
  try {
    const member = memberService.createMember(req.body);
    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
});

router.get('/', requireRole('librarian'), (req, res, next) => {
  try {
    const members = memberService.listMembers();
    res.status(200).json(members);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    // eslint-disable-next-line eqeqeq
    const isSelf = req.user && req.user.id == req.params.id;
    if (req.user.role !== 'librarian' && !isSelf) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const member = memberService.getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Not Found' });
    }

    res.status(200).json(member);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/loans', (req, res, next) => {
  try {
    // eslint-disable-next-line eqeqeq
    const isSelf = req.user && req.user.id == req.params.id;
    if (req.user.role !== 'librarian' && !isSelf) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const member = memberService.getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Not Found' });
    }

    res.status(200).json(loanService.getLoansByMemberId(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRole('librarian'), (req, res, next) => {
  try {
    const updated = memberService.updateMember(req.params.id, req.body);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('librarian'), (req, res, next) => {
  try {
    memberService.deleteMember(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
