const {
  getAllMembers,
  getMemberById,
  findMemberByEmail,
  createMemberRecord,
  deleteMemberRecord,
} = require('../storage/members');
const { hashPassword, hashPasswordSync, comparePassword } = require('../utils/password');

const VALID_ROLES = ['member', 'librarian'];
const MIN_PASSWORD_LENGTH = 8;

function createError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidRole(value) {
  return VALID_ROLES.includes(value);
}

function isValidPassword(value) {
  return typeof value === 'string' && value.length >= MIN_PASSWORD_LENGTH;
}

async function createMember(data) {
  const { name, email, role, password } = data || {};

  if (!isNonEmptyString(name)) {
    throw createError('name must be a non-empty string', 400);
  }

  if (!isNonEmptyString(email)) {
    throw createError('email must be a non-empty string', 400);
  }

  if (!isValidPassword(password)) {
    throw createError(`password must be a string with at least ${MIN_PASSWORD_LENGTH} characters`, 400);
  }

  let memberRole = 'member';
  if (role !== undefined) {
    if (!isValidRole(role)) {
      throw createError("role must be either 'member' or 'librarian'", 400);
    }
    memberRole = role;
  }

  const trimmedEmail = email.trim();
  const duplicate = findMemberByEmail(trimmedEmail);
  if (duplicate) {
    throw createError('email must be unique', 400);
  }

  const passwordHash = await hashPassword(password);

  return createMemberRecord({
    name: name.trim(),
    email: trimmedEmail,
    role: memberRole,
    passwordHash,
  });
}

async function register(data) {
  const { name, email, password } = data || {};

  return createMember({ name, email, password, role: 'member' });
}

async function verifyCredentials(email, password) {
  if (!isNonEmptyString(email) || typeof password !== 'string' || password.length === 0) {
    return null;
  }

  const member = findMemberByEmail(email.trim());
  if (!member || !member.passwordHash) {
    return null;
  }

  const matches = await comparePassword(password, member.passwordHash);
  if (!matches) {
    return null;
  }

  return member;
}

function listMembers() {
  return getAllMembers();
}

function updateMember(id, data) {
  const member = getMemberById(id);
  if (!member) {
    throw createError('Member not found', 404);
  }

  const { name, email, role } = data || {};

  if (name !== undefined) {
    if (!isNonEmptyString(name)) {
      throw createError('name must be a non-empty string', 400);
    }
    member.name = name.trim();
  }

  if (email !== undefined) {
    if (!isNonEmptyString(email)) {
      throw createError('email must be a non-empty string', 400);
    }
    const trimmedEmail = email.trim();
    const duplicate = findMemberByEmail(trimmedEmail, member.id);
    if (duplicate) {
      throw createError('email must be unique', 400);
    }
    member.email = trimmedEmail;
  }

  if (role !== undefined) {
    if (!isValidRole(role)) {
      throw createError("role must be either 'member' or 'librarian'", 400);
    }
    member.role = role;
  }

  return member;
}

function deleteMember(id) {
  const member = getMemberById(id);
  if (!member) {
    throw createError('Member not found', 404);
  }

  deleteMemberRecord(member.id);
}

function seedLibrarian() {
  const email = 'librarian@example.com';
  if (findMemberByEmail(email)) {
    return;
  }

  createMemberRecord({
    name: 'Seed Librarian',
    email,
    role: 'librarian',
    passwordHash: hashPasswordSync('LibrarianPass123'),
  });
}

seedLibrarian();

module.exports = {
  createMember,
  register,
  verifyCredentials,
  listMembers,
  getMemberById,
  updateMember,
  deleteMember,
};
