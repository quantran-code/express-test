const bcrypt = require('bcrypt');
const HttpError = require('../errors/httpError');
const memberRepository = require('../repositories/memberRepository');
const userRepository = require('../repositories/userRepository');
const memberService = require('./memberService');
const { signAccessToken } = require('./tokenService');

const PASSWORD_MIN_LENGTH = 8;
const INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials';
const BCRYPT_ROUNDS = 10;

// Compared against when the email is unknown so both failure paths cost the same.
const INVALID_CREDENTIALS_PASSWORD_HASH = bcrypt.hashSync(
  'invalid-credentials-placeholder',
  BCRYPT_ROUNDS,
);

/**
 * @param {*} value
 * @returns {string}
 */
function requireValidEmail(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, 'email is required');
  }

  const email = memberService.normalizeEmail(value);

  if (!memberService.isValidEmail(email)) {
    throw new HttpError(400, 'email must be a valid email address');
  }

  return email;
}

/**
 * @param {*} value
 * @returns {string}
 */
function requirePassword(value) {
  if (typeof value !== 'string' || value === '') {
    throw new HttpError(400, 'password is required');
  }

  if (value.length < PASSWORD_MIN_LENGTH) {
    throw new HttpError(
      400,
      `password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    );
  }

  return value;
}

/**
 * @param {*} requestedRole
 * @param {{ id: number, role: 'member' | 'librarian' } | undefined} actingUser
 * @returns {'member' | 'librarian'}
 */
function resolveRole(requestedRole, actingUser) {
  if (requestedRole === undefined || requestedRole === null) {
    return 'member';
  }

  if (
    typeof requestedRole !== 'string' ||
    !userRepository.ROLES.includes(requestedRole)
  ) {
    throw new HttpError(
      400,
      `role must be one of: ${userRepository.ROLES.join(', ')}`,
    );
  }

  if (
    requestedRole === 'librarian' &&
    (!actingUser || actingUser.role !== 'librarian')
  ) {
    throw new HttpError(403, 'Only a librarian can create a librarian account');
  }

  return requestedRole;
}

/**
 * Explicit field allowlist so a stored password hash can never be serialized.
 *
 * @param {import('../repositories/userRepository').User} user
 * @param {import('../repositories/memberRepository').Member} member
 * @returns {{ id: number, memberId: number | null, name: string, email: string, role: 'member' | 'librarian' }}
 */
function toAccountResponse(user, member) {
  return {
    id: user.id,
    memberId: user.memberId,
    name: member.name,
    email: user.email,
    role: user.role,
  };
}

/**
 * @param {{ name?: string, email?: string, password?: string, role?: string }} payload
 * @param {{ id: number, role: 'member' | 'librarian' }} [actingUser]
 * @returns {Promise<{ id: number, memberId: number | null, name: string, email: string, role: 'member' | 'librarian' }>}
 */
async function registerAccount(payload, actingUser) {
  const data = payload || {};

  const name = memberService.requireNonEmptyString(data.name, 'name');
  const email = requireValidEmail(data.email);
  const password = requirePassword(data.password);
  const role = resolveRole(data.role, actingUser);

  if (userRepository.findByEmail(email) || memberRepository.findByEmail(email)) {
    throw new HttpError(409, 'This email is already in use');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // The member record is created first so the user always references a real id.
  const member = memberService.createMember({ name, email });

  const user = userRepository.create({
    memberId: member.id,
    email,
    passwordHash,
    role,
  });

  return toAccountResponse(user, member);
}

/**
 * @param {{ email?: string, password?: string }} payload
 * @returns {Promise<{ accessToken: string, tokenType: 'Bearer', role: 'member' | 'librarian' }>}
 */
async function login(payload) {
  const data = payload || {};

  const email =
    typeof data.email === 'string' ? memberService.normalizeEmail(data.email) : '';
  const password = typeof data.password === 'string' ? data.password : '';

  const user = email === '' ? undefined : userRepository.findByEmail(email);
  const passwordHash = user
    ? user.passwordHash
    : INVALID_CREDENTIALS_PASSWORD_HASH;

  const matches = await bcrypt.compare(password, passwordHash);

  if (!user || !matches) {
    throw new HttpError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    tokenType: 'Bearer',
    role: user.role,
  };
}

module.exports = {
  PASSWORD_MIN_LENGTH,
  INVALID_CREDENTIALS_MESSAGE,
  registerAccount,
  login,
  toAccountResponse,
};
