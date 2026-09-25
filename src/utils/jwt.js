const jwt = require('jsonwebtoken');
const config = require('../config');

function signToken(payload) {
  return jwt.sign({ id: payload.id, role: payload.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function verifyToken(token) {
  const decoded = jwt.verify(token, config.jwtSecret);
  return { id: decoded.id, role: decoded.role };
}

module.exports = {
  signToken,
  verifyToken,
};
