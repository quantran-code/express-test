const bcrypt = require('bcrypt');

const bookStore = require('./bookStore');
const ApiError = bookStore.ApiError;

const MIN_PASSWORD_LENGTH = 8;

// In-memory storage for users
// User shape: { id, name, email, passwordHash, role }
const usersById = new Map();
const usersByEmail = new Map();

let nextId = 1;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidEmail(email) {
  if (typeof email !== 'string') {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function assertValidRegisterInput(input) {
  const { name, email, password } = input || {};

  if (!isNonEmptyString(name)) {
    throw new ApiError(400, 'name is required');
  }

  if (!isValidEmail(email)) {
    throw new ApiError(400, 'email is invalid');
  }

  if (!isNonEmptyString(password)) {
    throw new ApiError(400, 'password is required');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(400, `password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function registerMember(input) {
  assertValidRegisterInput(input);

  const { name, email, password } = input;
  const emailNorm = email.trim().toLowerCase();

  if (usersByEmail.has(emailNorm)) {
    throw new ApiError(400, 'email must be unique');
  }

  const id = String(nextId++);
  const passwordHash = await hashPassword(password);

  const user = {
    id,
    name: name.trim(),
    email: emailNorm,
    passwordHash,
    role: 'member',
  };

  usersById.set(id, user);
  usersByEmail.set(emailNorm, user);

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async function createLibrarian(input) {
  assertValidRegisterInput(input);

  const { name, email, password } = input;
  const emailNorm = email.trim().toLowerCase();

  if (usersByEmail.has(emailNorm)) {
    throw new ApiError(400, 'email must be unique');
  }

  const id = String(nextId++);
  const passwordHash = await hashPassword(password);

  const user = {
    id,
    name: name.trim(),
    email: emailNorm,
    passwordHash,
    role: 'librarian',
  };

  usersById.set(id, user);
  usersByEmail.set(emailNorm, user);

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function getUserByEmail(email) {
  if (!isNonEmptyString(email)) {
    return undefined;
  }
  return usersByEmail.get(email.trim().toLowerCase());
}

function getUserById(id) {
  return usersById.get(String(id));
}

async function verifyPassword(user, plaintext) {
  if (!user || !plaintext) {
    return false;
  }
  return bcrypt.compare(plaintext, user.passwordHash);
}

// Seed at least one librarian ahead of time.
// Credentials are fixed so tests can login deterministically.
const SEEDED_LIBRARIAN = {
  name: 'Seed Librarian',
  email: 'librarian@example.com',
  password: 'password123',
};

(function seedLibrarianAtStartup() {
  // This file uses bcrypt (async hashing). Seed synchronously only by using an async IIFE.
  // eslint-disable-next-line no-void
  void (async () => {
    const existing = getUserByEmail(SEEDED_LIBRARIAN.email);
    if (existing) {
      return;
    }

    const { name, email, password } = SEEDED_LIBRARIAN;
    const emailNorm = email.trim().toLowerCase();

    const id = String(nextId++);
    const passwordHash = await hashPassword(password);

    const user = {
      id,
      name: name.trim(),
      email: emailNorm,
      passwordHash,
      role: 'librarian',
    };

    usersById.set(id, user);
    usersByEmail.set(emailNorm, user);
  })();
})();

module.exports = {
  ApiError,
  registerMember,
  createLibrarian,
  getUserByEmail,
  getUserById,
  verifyPassword,
  // exported for potential test determinism/fixtures
  SEEDED_LIBRARIAN,
};
