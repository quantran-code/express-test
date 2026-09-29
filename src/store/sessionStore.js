const crypto = require('crypto');

const bookStore = require('./bookStore');
const ApiError = bookStore.ApiError;

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

// token -> { userId, role, expiresAt }
const sessionsByToken = new Map();

function issueToken(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;

  sessionsByToken.set(token, {
    userId: user.id,
    role: user.role,
    expiresAt,
  });

  return {
    token,
    expiresAt,
  };
}

function verifyToken(token) {
  if (!token) {
    throw new ApiError(401, 'invalid or expired token');
  }

  const session = sessionsByToken.get(String(token));
  if (!session) {
    throw new ApiError(401, 'invalid or expired token');
  }

  if (Date.now() > session.expiresAt) {
    sessionsByToken.delete(String(token));
    throw new ApiError(401, 'invalid or expired token');
  }

  return {
    id: String(session.userId),
    role: session.role,
  };
}

module.exports = {
  SESSION_TTL_MS,
  issueToken,
  verifyToken,
};
