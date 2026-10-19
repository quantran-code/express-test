const bcrypt = require('bcrypt');

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {number | null} memberId
 * @property {string} email
 * @property {string} passwordHash
 * @property {'member' | 'librarian'} role
 */

const ROLES = Object.freeze(['member', 'librarian']);

const SEEDED_LIBRARIAN_EMAIL = 'librarian@library.test';
const SEEDED_LIBRARIAN_PASSWORD = 'Librarian123!';

const BCRYPT_ROUNDS = 10;

// Hashed once so that seeding stays cheap every time reset() re-applies it.
const SEEDED_LIBRARIAN_PASSWORD_HASH = bcrypt.hashSync(
  SEEDED_LIBRARIAN_PASSWORD,
  BCRYPT_ROUNDS,
);

let users = [];
let nextId = 1;

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeForLookup(value) {
  return String(value).trim().toLowerCase();
}

/**
 * @returns {void}
 */
function seedLibrarian() {
  users.push({
    id: nextId,
    memberId: null,
    email: SEEDED_LIBRARIAN_EMAIL,
    passwordHash: SEEDED_LIBRARIAN_PASSWORD_HASH,
    role: 'librarian',
  });

  nextId += 1;
}

/**
 * @param {{ memberId: number | null, email: string, passwordHash: string, role: 'member' | 'librarian' }} data
 * @returns {User}
 */
function create(data) {
  if (!ROLES.includes(data.role)) {
    throw new RangeError(`Unknown role: ${data.role}`);
  }

  const user = {
    id: nextId,
    memberId: data.memberId === undefined ? null : data.memberId,
    email: data.email,
    passwordHash: data.passwordHash,
    role: data.role,
  };

  nextId += 1;
  users.push(user);

  return user;
}

/**
 * @returns {User[]}
 */
function findAll() {
  return users.slice();
}

/**
 * @param {number} id
 * @returns {User | undefined}
 */
function findById(id) {
  return users.find((user) => user.id === id);
}

/**
 * @param {string} email
 * @returns {User | undefined}
 */
function findByEmail(email) {
  const target = normalizeForLookup(email);

  return users.find((user) => normalizeForLookup(user.email) === target);
}

/**
 * @returns {void}
 */
function reset() {
  users = [];
  nextId = 1;
  seedLibrarian();
}

seedLibrarian();

module.exports = {
  ROLES,
  SEEDED_LIBRARIAN_EMAIL,
  SEEDED_LIBRARIAN_PASSWORD,
  create,
  findAll,
  findById,
  findByEmail,
  reset,
};
