const HttpError = require('../errors/httpError');
const userRepository = require('../repositories/userRepository');
const { verifyAccessToken } = require('../services/tokenService');

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

/**
 * @param {string | undefined} header
 * @returns {string | null}
 */
function extractBearerToken(header) {
  if (typeof header !== 'string') {
    return null;
  }

  const match = BEARER_PATTERN.exec(header.trim());

  if (!match) {
    return null;
  }

  const token = match[1].trim();

  return token === '' ? null : token;
}

/**
 * Resolves the caller identity carried by an already verified token. The linked
 * member row is looked up so member-scoped routes can compare against it; it is
 * null for accounts without a member record (e.g. the seeded librarian).
 *
 * @param {{ sub: number, role: 'member' | 'librarian' }} payload
 * @returns {{ id: number, role: 'member' | 'librarian', memberId: number | null }}
 */
function buildRequestUser(payload) {
  const user = userRepository.findById(payload.sub);

  return {
    id: payload.sub,
    role: payload.role,
    memberId: user ? user.memberId ?? null : null,
  };
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function authenticate(req, res, next) {
  const token = extractBearerToken(req.headers && req.headers.authorization);

  if (!token) {
    throw new HttpError(401, 'Unauthorized');
  }

  const payload = verifyAccessToken(token);

  req.user = buildRequestUser(payload);
  next();
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function optionalAuthenticate(req, res, next) {
  const header = req.headers && req.headers.authorization;

  if (typeof header !== 'string' || header.trim() === '') {
    next();
    return;
  }

  const token = extractBearerToken(header);

  if (!token) {
    throw new HttpError(401, 'Unauthorized');
  }

  const payload = verifyAccessToken(token);

  req.user = buildRequestUser(payload);
  next();
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  extractBearerToken,
};
