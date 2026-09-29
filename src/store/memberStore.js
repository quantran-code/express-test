const bookStore = require('./bookStore');
const ApiError = bookStore.ApiError;
const getBookById = bookStore.getBookById;
const borrowCopy = bookStore.borrowCopy;
const returnCopy = bookStore.returnCopy;

let nextId = 1;

// In-memory storage for members
// Member shape (internal): { id, name, loans: Set<bookId> }
const membersById = new Map();

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertRequiredNonEmptyString(value, fieldName) {
  if (!isNonEmptyString(value)) {
    throw new ApiError(400, `${fieldName} is required`);
  }
}

function serializeMember(member) {
  const { loans, ...rest } = member;
  return rest;
}

function createMember(input) {
  const { name } = input || {};

  assertRequiredNonEmptyString(name, 'name');

  const id = String(nextId++);
  const member = {
    id,
    name: name.trim(),
    loans: new Set(),
  };

  membersById.set(id, member);

  return serializeMember(member);
}

function getAllMembers() {
  return Array.from(membersById.values()).map(serializeMember);
}

function getMemberById(id) {
  const member = membersById.get(String(id));
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }
  return serializeMember(member);
}

function borrowBook(memberId, bookId) {
  const member = membersById.get(String(memberId));
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }

  // Confirm book exists (and keep error codes consistent with bookStore)
  getBookById(bookId);

  if (member.loans.has(String(bookId))) {
    throw new ApiError(409, 'Member already borrowed this book');
  }

  borrowCopy(bookId);
  member.loans.add(String(bookId));

  return {
    memberId: String(memberId),
    bookId: String(bookId),
    book: getBookById(bookId),
  };
}

function returnBook(memberId, bookId) {
  const member = membersById.get(String(memberId));
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }

  // Confirm book exists (and keep error codes consistent with bookStore)
  getBookById(bookId);

  if (!member.loans.has(String(bookId))) {
    throw new ApiError(409, 'Member does not have this book on loan');
  }

  returnCopy(bookId);
  member.loans.delete(String(bookId));

  return {
    memberId: String(memberId),
    bookId: String(bookId),
    book: getBookById(bookId),
  };
}

module.exports = {
  ApiError,
  createMember,
  getAllMembers,
  getMemberById,
  borrowBook,
  returnBook,
};
