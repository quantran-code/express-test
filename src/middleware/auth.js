const sessionStore = require('../store/sessionStore');
const ApiError = require('../store/bookStore').ApiError;

function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || typeof header !== 'string') {
      throw new ApiError(401, 'invalid or expired token');
    }

    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new ApiError(401, 'invalid or expired token');
    }

    const user = sessionStore.verifyToken(token);
    req.user = {
      id: user.id,
      role: user.role,
    };

    return next();
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    return next(err);
  }
}

function requireRole(role) {
  return (req, res, next) => {
    try {
      if (!req.user || req.user.role !== role) {
        throw new ApiError(403, 'forbidden');
      }
      return next();
    } catch (err) {
      if (err instanceof ApiError) {
        return next(err);
      }
      return next(err);
    }
  };
}

module.exports = {
  requireAuth,
  requireRole,
};
