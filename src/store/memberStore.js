const bookStore = require('./bookStore');
const ApiError = bookStore.ApiError;
const getBookById = bookStore.getBookById;
const borrowCopy = bookStore.borrowCopy;
const returnCopy = bookStore.returnCopy;

let nextId = 1;

// In-memory storage for members
// Member shape (internal): { id, name, loans: Map<bookId, { borrowedAt: Date, dueDate: Date }> }
const membersById = new Map();

const LOAN_PERIOD_DAYS = 14;

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
    loans: new Map(),
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

  const bookIdStr = String(bookId);

  if (member.loans.has(bookIdStr)) {
    throw new ApiError(409, 'Member already borrowed this book');
  }

  const borrowedAt = new Date();
  const dueDate = new Date(borrowedAt.getTime() + LOAN_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  borrowCopy(bookId);
  member.loans.set(bookIdStr, { borrowedAt, dueDate });

  return {
    memberId: String(memberId),
    bookId: bookIdStr,
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

  const bookIdStr = String(bookId);

  if (!member.loans.has(bookIdStr)) {
    throw new ApiError(409, 'Member does not have this book on loan');
  }

  returnCopy(bookId);
  member.loans.delete(bookIdStr);

  return {
    memberId: String(memberId),
    bookId: bookIdStr,
    book: getBookById(bookId),
  };
}

function getLoansForMember(memberId, options) {
  const member = membersById.get(String(memberId));
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }

  const overdueOnly = options && options.overdue === true;
  const now = new Date();

  const loans = [];

  for (const [bookId, loan] of member.loans.entries()) {
    const isOverdue = now.getTime() > loan.dueDate.getTime();

    if (overdueOnly && !isOverdue) {
      continue;
    }

    loans.push({
      bookId,
      borrowedAt: loan.borrowedAt.toISOString(),
      dueDate: loan.dueDate.toISOString(),
      book: getBookById(bookId),
    });
  }

  return loans;
}

module.exports = {
  ApiError,
  LOAN_PERIOD_DAYS,
  createMember,
  getAllMembers,
  getMemberById,
  borrowBook,
  returnBook,
  getLoansForMember,
};
