const express = require('express');
const memberService = require('../services/memberService');
const { signToken } = require('../utils/jwt');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const member = await memberService.register(req.body);
    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const member = await memberService.verifyCredentials(email, password);

    if (!member) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const token = signToken({ id: member.id, role: member.role });
    res.status(200).json({ token });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
