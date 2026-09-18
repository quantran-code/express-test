const express = require('express');
const memberService = require('../services/memberService');

const router = express.Router();

router.post('/', (req, res, next) => {
  try {
    const { name, email } = req.body || {};
    const member = memberService.createMember({ name, email });
    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const members = memberService.listMembers();
    res.status(200).json(members);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const member = memberService.getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Not Found' });
    }
    res.status(200).json(member);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', (req, res, next) => {
  try {
    const { name, email } = req.body || {};
    const member = memberService.updateMember(req.params.id, { name, email });
    res.status(200).json(member);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    memberService.deleteMember(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
