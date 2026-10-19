const express = require('express');
const memberService = require('../services/memberService');
const loanService = require('../services/loanService');
const {
  requireLibrarian,
  requireSelfOrLibrarian,
} = require('../middleware/authorize');

const router = express.Router();

router.get('/', requireLibrarian, (req, res) => {
  res.status(200).json(memberService.listMembers());
});

router.get('/:id', requireSelfOrLibrarian, (req, res) => {
  res.status(200).json(memberService.getMember(req.params.id));
});

router.get('/:id/loans', requireSelfOrLibrarian, (req, res) => {
  res.status(200).json(loanService.listActiveLoansForMember(req.params.id));
});

router.post('/', requireLibrarian, (req, res) => {
  res.status(201).json(memberService.createMember(req.body));
});

router.patch('/:id', requireSelfOrLibrarian, (req, res) => {
  res.status(200).json(memberService.updateMember(req.params.id, req.body));
});

router.delete('/:id', requireSelfOrLibrarian, (req, res) => {
  memberService.deleteMember(req.params.id);
  res.status(204).end();
});

module.exports = router;
