const HttpError = require('../errors/httpError');
const memberRepository = require('../repositories/memberRepository');
const loanRepository = require('../repositories/loanRepository');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {*} email
 * @returns {string}
 */
function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

/**
 * @param {*} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

/**
 * @param {*} value
 * @param {string} field
 * @returns {string}
 */
function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, `${field} is required`);
  }

  return value.trim();
}

/**
 * @param {number | string} id
 * @returns {number}
 */
function parseId(id) {
  const parsed = Number.parseInt(id, 10);

  if (Number.isNaN(parsed)) {
    throw new HttpError(404, 'Member not found');
  }

  return parsed;
}

/**
 * @param {*} value
 * @returns {string}
 */
function requireValidEmail(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, 'email is required');
  }

  const email = normalizeEmail(value);

  if (!isValidEmail(email)) {
    throw new HttpError(400, 'email must be a valid email address');
  }

  return email;
}

/**
 * @param {object} payload
 * @returns {import('../repositories/memberRepository').Member}
 */
function createMember(payload) {
  const data = payload || {};

  const name = requireNonEmptyString(data.name, 'name');
  const email = requireValidEmail(data.email);

  if (memberRepository.findByEmail(email)) {
    throw new HttpError(409, 'This email is already in use');
  }

  return memberRepository.create({ name, email });
}

/**
 * @returns {import('../repositories/memberRepository').Member[]}
 */
function listMembers() {
  return memberRepository.findAll();
}

/**
 * @param {number | string} id
 * @returns {import('../repositories/memberRepository').Member}
 */
function getMember(id) {
  const memberId = parseId(id);
  const member = memberRepository.findById(memberId);

  if (!member) {
    throw new HttpError(404, 'Member not found');
  }

  return member;
}

/**
 * @param {number | string} id
 * @param {object} payload
 * @returns {import('../repositories/memberRepository').Member}
 */
function updateMember(id, payload) {
  const memberId = parseId(id);
  const member = memberRepository.findById(memberId);

  if (!member) {
    throw new HttpError(404, 'Member not found');
  }

  const data = payload || {};
  const patch = {};

  if (data.name !== undefined) {
    patch.name = requireNonEmptyString(data.name, 'name');
  }

  if (data.email !== undefined) {
    const email = requireValidEmail(data.email);
    const existing = memberRepository.findByEmail(email);

    if (existing && existing.id !== memberId) {
      throw new HttpError(409, 'This email is already in use');
    }

    patch.email = email;
  }

  return memberRepository.update(memberId, patch);
}

/**
 * @param {number | string} id
 * @returns {void}
 */
function deleteMember(id) {
  const memberId = parseId(id);
  const member = memberRepository.findById(memberId);

  if (!member) {
    throw new HttpError(404, 'Member not found');
  }

  if (loanRepository.countActiveByMemberId(memberId) > 0) {
    throw new HttpError(409, 'Cannot delete a member with active loans');
  }

  memberRepository.remove(memberId);
}

module.exports = {
  normalizeEmail,
  isValidEmail,
  requireNonEmptyString,
  parseId,
  createMember,
  listMembers,
  getMember,
  updateMember,
  deleteMember,
};
