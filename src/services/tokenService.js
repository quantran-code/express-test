const crypto = require('crypto');
const config = require('../config');
const HttpError = require('../errors/httpError');

const TOKEN_ALGORITHM = 'HS256';

/**
 * @returns {HttpError}
 */
function unauthorized() {
  return new HttpError(401, 'Unauthorized');
}

/**
 * @param {string} value
 * @returns {string}
 */
function encodeSegment(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

/**
 * @param {string} value
 * @returns {string | null}
 */
function decodeSegment(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const remainder = normalized.length % 4;

  if (remainder === 1) {
    return null;
  }

  const padded = normalized + '='.repeat((4 - remainder) % 4);

  return Buffer.from(padded, 'base64').toString('utf8');
}

/**
 * @param {string} signingInput
 * @returns {string}
 */
function computeSignature(signingInput) {
  return crypto
    .createHmac('sha256', config.jwtSecret)
    .update(signingInput, 'utf8')
    .digest('base64url');
}

/**
 * @param {{ sub: number, role: 'member' | 'librarian' }} payload
 * @param {{ expiresInSeconds?: number }} [options]
 * @returns {string}
 */
function signAccessToken(payload, options) {
  const settings = options || {};
  const ttlSeconds =
    settings.expiresInSeconds === undefined
      ? config.accessTokenTtlSeconds
      : settings.expiresInSeconds;

  const issuedAt = Math.floor(Date.now() / 1000);

  const header = { alg: TOKEN_ALGORITHM, typ: 'JWT' };
  const body = {
    sub: payload.sub,
    role: payload.role,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
  };

  const encodedHeader = encodeSegment(JSON.stringify(header));
  const encodedBody = encodeSegment(JSON.stringify(body));
  const signature = computeSignature(`${encodedHeader}.${encodedBody}`);

  return `${encodedHeader}.${encodedBody}.${signature}`;
}

/**
 * @param {string} token
 * @returns {{ sub: number, role: 'member' | 'librarian', iat: number, exp: number }}
 */
function verifyAccessToken(token) {
  if (typeof token !== 'string') {
    throw unauthorized();
  }

  const segments = token.split('.');

  if (segments.length !== 3) {
    throw unauthorized();
  }

  const [encodedHeader, encodedBody, providedSignature] = segments;
  const expectedSignature = computeSignature(`${encodedHeader}.${encodedBody}`);

  const providedBuffer = Buffer.from(providedSignature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw unauthorized();
  }

  const headerJson = decodeSegment(encodedHeader);
  const payloadJson = decodeSegment(encodedBody);

  if (headerJson === null || payloadJson === null) {
    throw unauthorized();
  }

  let header;
  let payload;

  try {
    header = JSON.parse(headerJson);
    payload = JSON.parse(payloadJson);
  } catch (error) {
    throw unauthorized();
  }

  if (!header || header.alg !== TOKEN_ALGORITHM) {
    throw unauthorized();
  }

  if (
    !payload ||
    payload.sub === undefined ||
    payload.sub === null ||
    typeof payload.role !== 'string' ||
    typeof payload.exp !== 'number' ||
    !Number.isFinite(payload.exp)
  ) {
    throw unauthorized();
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (payload.exp <= nowSeconds) {
    throw unauthorized();
  }

  return {
    sub: payload.sub,
    role: payload.role,
    iat: payload.iat,
    exp: payload.exp,
  };
}

module.exports = {
  TOKEN_ALGORITHM,
  signAccessToken,
  verifyAccessToken,
};
