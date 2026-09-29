const express = require('express');

const userStore = require('../store/userStore');
const ApiError = require('../store/bookStore').ApiError;
const sessionStore = require('../store/sessionStore');

const { registerMember, createLibrarian, getUserByEmail, verifyPassword } = userStore;

const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const member = await registerMember(req.body);
    res.status(201).json(member);
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    return next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    const user = await getUserByEmail(email);
    if (!user) {
      throw new ApiError(401, 'invalid credentials');
    }

    const ok = await verifyPassword(user, password);
    if (!ok) {
      throw new ApiError(401, 'invalid credentials');
    }

    const { token } = sessionStore.issueToken({ id: user.id, role: user.role });
    res.status(200).json({ token });
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    return next(err);
  }
});

router.post('/librarians', requireAuth, requireRole('librarian'), async (req, res, next) => {
  try {
    const librarian = await createLibrarian(req.body);
    res.status(201).json(librarian);
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    return next(err);
  }
});

module.exports = router;
