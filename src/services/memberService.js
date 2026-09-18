const crypto = require('crypto');

let members = [];

function resetMembers() {
  members = [];
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function createMember(data) {
  const { name, email } = data || {};

  if (!isNonEmptyString(name) || !isNonEmptyString(email)) {
    throw createError('name and email are required non-empty strings', 400);
  }

  const normalizedEmail = email.trim();

  if (members.some((m) => m.email === normalizedEmail)) {
    throw createError(`A member with email "${normalizedEmail}" already exists`, 409);
  }

  const now = new Date().toISOString();
  const member = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    createdAt: now,
    updatedAt: now,
  };

  members.push(member);
  return member;
}

function listMembers() {
  return members;
}

function getMemberById(id) {
  return members.find((member) => member.id === id);
}

function updateMember(id, data) {
  const member = getMemberById(id);
  if (!member) {
    throw createError('Member not found', 404);
  }

  const { name, email } = data || {};

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

    const normalizedEmail = email.trim();
    if (members.some((m) => m.email === normalizedEmail && m.id !== id)) {
      throw createError(`A member with email "${normalizedEmail}" already exists`, 409);
    }

    member.email = normalizedEmail;
  }

  member.updatedAt = new Date().toISOString();
  return member;
}

function deleteMember(id) {
  const member = getMemberById(id);
  if (!member) {
    throw createError('Member not found', 404);
  }

  members = members.filter((m) => m.id !== id);
  return true;
}

module.exports = {
  createMember,
  listMembers,
  getMemberById,
  updateMember,
  deleteMember,
  resetMembers,
};
