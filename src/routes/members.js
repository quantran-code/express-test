const express = require('express');
const memberService = require('../services/memberService');
const loanService = require('../services/loanService');

const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json(memberService.listMembers());
});

router.get('/:id', (req, res) => {
  res.status(200).json(memberService.getMember(req.params.id));
});

router.get('/:id/loans', (req, res) => {
  res.status(200).json(loanService.listActiveLoansForMember(req.params.id));
});

router.post('/', (req, res) => {
  res.status(201).json(memberService.createMember(req.body));
});

router.patch('/:id', (req, res) => {
  res.status(200).json(memberService.updateMember(req.params.id, req.body));
});

router.delete('/:id', (req, res) => {
  memberService.deleteMember(req.params.id);
  res.status(204).end();
});

module.exports = router;
