const {
  getAllMembers,
  getMemberById,
  findMemberByEmail,
  createMemberRecord,
  deleteMemberRecord,
} = require('../storage/members');

const VALID_ROLES = ['member', 'librarian'];

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

function createMember(data) {
  const { name, email, role } = data || {};

  if (!isNonEmptyString(name)) {
    throw createError('name must be a non-empty string', 400);
  }

  if (!isNonEmptyString(email)) {
    throw createError('email must be a non-empty string', 400);
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

  return createMemberRecord({
    name: name.trim(),
    email: trimmedEmail,
    role: memberRole,
  });
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

module.exports = {
  createMember,
  listMembers,
  getMemberById,
  updateMember,
  deleteMember,
};
