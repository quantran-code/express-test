const HttpError = require('../errors/httpError');

/**
 * Allows only a librarian caller; everyone else is forbidden.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function requireLibrarian(req, res, next) {
  if (!req.user || req.user.role !== 'librarian') {
    throw new HttpError(403, 'Forbidden');
  }

  next();
}

/**
 * Allows a librarian through, and a member only for their own :id.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function requireSelfOrLibrarian(req, res, next) {
  if (req.user && req.user.role === 'librarian') {
    next();
    return;
  }

  const requestedId = Number.parseInt(req.params.id, 10);

  if (req.user && req.user.role === 'member' && requestedId === req.user.memberId) {
    next();
    return;
  }

  throw new HttpError(403, 'Forbidden');
}

module.exports = {
  requireLibrarian,
  requireSelfOrLibrarian,
};
