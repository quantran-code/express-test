const express = require('express');
const authService = require('../services/authService');
const { optionalAuthenticate } = require('../middleware/authenticate');

const router = express.Router();

// Public: a missing Authorization header is fine, an invalid one is still 401.
router.post('/register', optionalAuthenticate, async (req, res) => {
  res.status(201).json(await authService.registerAccount(req.body, req.user));
});

router.post('/login', async (req, res) => {
  res.status(200).json(await authService.login(req.body));
});

module.exports = router;
