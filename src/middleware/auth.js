const memberService = require('../services/memberService');

function authenticate(req, res, next) {
  const memberId = req.header('x-member-id');

  if (!memberId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const member = memberService.getMemberById(memberId);

  if (!member) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = { id: member.id, role: member.role };
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = {
  authenticate,
  requireRole,
};
