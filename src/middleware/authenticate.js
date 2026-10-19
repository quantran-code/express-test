const HttpError = require('../errors/httpError');
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

  req.user = { id: payload.sub, role: payload.role };
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

  req.user = { id: payload.sub, role: payload.role };
  next();
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  extractBearerToken,
};
