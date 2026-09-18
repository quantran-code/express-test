let loans = [];

const MAX_ACTIVE_LOANS_PER_MEMBER = 3;

const memberService = require('./memberService');
const bookService = require('./bookService');

function resetLoans() {
  loans = [];
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function createLoan(data) {
  const { memberId, bookId } = data || {};

  if (!memberId || !bookId) {
    throw createError('memberId and bookId are required', 400);
  }

  const member = memberService.getMemberById(memberId);
  if (!member) {
    throw createError('Member not found', 404);
  }

  const book = bookService.getBookById(bookId);
  if (!book) {
    throw createError('Book not found', 404);
  }

  const hasActiveLoan = loans.some((loan) => loan.bookId === bookId && loan.status === 'active');
  if (hasActiveLoan) {
    throw createError('BOOK_ALREADY_BORROWED', 409);
  }

  const activeLoansForMember = loans.filter((loan) => loan.memberId === memberId && loan.status === 'active');
  if (activeLoansForMember.length >= MAX_ACTIVE_LOANS_PER_MEMBER) {
    throw createError('MEMBER_LOAN_LIMIT_REACHED', 409);
  }

  const now = new Date().toISOString();
  const loan = {
    id: require('crypto').randomUUID(),
    memberId,
    bookId,
    borrowedAt: now,
    returnedAt: null,
    status: 'active',
  };

  loans.push(loan);
  return loan;
}

function listLoans() {
  return loans;
}

function getLoanById(id) {
  return loans.find((loan) => loan.id === id);
}

function returnLoan(id) {
  const loan = getLoanById(id);
  if (!loan) {
    throw createError('Loan not found', 404);
  }

  if (loan.status === 'returned') {
    return loan;
  }

  loan.returnedAt = new Date().toISOString();
  loan.status = 'returned';
  return loan;
}

module.exports = {
  MAX_ACTIVE_LOANS_PER_MEMBER,
  createLoan,
  listLoans,
  getLoanById,
  returnLoan,
  resetLoans,
};
