const HttpError = require('../errors/httpError');
const bookRepository = require('../repositories/bookRepository');
const memberRepository = require('../repositories/memberRepository');
const loanRepository = require('../repositories/loanRepository');

const MAX_ACTIVE_LOANS = 3;

/**
 * @param {number | string} id
 * @param {string} message
 * @returns {number}
 */
function parseId(id, message) {
  const parsed = Number.parseInt(id, 10);

  if (Number.isNaN(parsed)) {
    throw new HttpError(404, message);
  }

  return parsed;
}

/**
 * @param {number | string} value
 * @param {string} field
 * @param {string} message
 * @returns {number}
 */
function requireId(value, field, message) {
  if (value === undefined || value === null || value === '') {
    throw new HttpError(400, `${field} is required`);
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new HttpError(404, message);
  }

  return parsed;
}

/**
 * @param {object} payload
 * @returns {import('../repositories/loanRepository').Loan}
 */
function borrowBook(payload) {
  const data = payload || {};

  const bookId = requireId(data.bookId, 'bookId', 'Book not found');
  const memberId = requireId(data.memberId, 'memberId', 'Member not found');

  const book = bookRepository.findById(bookId);

  if (!book) {
    throw new HttpError(404, 'Book not found');
  }

  const member = memberRepository.findById(memberId);

  if (!member) {
    throw new HttpError(404, 'Member not found');
  }

  if (book.availableCopies <= 0) {
    throw new HttpError(409, 'No copies available');
  }

  if (loanRepository.findActiveByMemberAndBook(memberId, bookId)) {
    throw new HttpError(
      409,
      'This member already has an active loan for this book',
    );
  }

  if (loanRepository.countActiveByMemberId(memberId) >= MAX_ACTIVE_LOANS) {
    throw new HttpError(
      409,
      `A member may have at most ${MAX_ACTIVE_LOANS} active loans`,
    );
  }

  const loan = loanRepository.create({
    bookId,
    memberId,
    borrowedAt: new Date().toISOString(),
    returnedAt: null,
  });

  bookRepository.update(bookId, { availableCopies: book.availableCopies - 1 });

  return loan;
}

/**
 * @param {number | string} id
 * @returns {import('../repositories/loanRepository').Loan}
 */
function returnLoan(id) {
  const loanId = parseId(id, 'Loan not found');
  const loan = loanRepository.findById(loanId);

  if (!loan) {
    throw new HttpError(404, 'Loan not found');
  }

  if (loan.returnedAt !== null) {
    throw new HttpError(409, 'This loan has already been returned');
  }

  const book = bookRepository.findById(loan.bookId);

  if (book) {
    bookRepository.update(loan.bookId, {
      availableCopies: Math.min(book.totalCopies, book.availableCopies + 1),
    });
  }

  return loanRepository.update(loanId, {
    returnedAt: new Date().toISOString(),
  });
}

/**
 * @param {number | string} memberId
 * @returns {import('../repositories/loanRepository').Loan[]}
 */
function listActiveLoansForMember(memberId) {
  const parsedMemberId = parseId(memberId, 'Member not found');
  const member = memberRepository.findById(parsedMemberId);

  if (!member) {
    throw new HttpError(404, 'Member not found');
  }

  return loanRepository.findActiveByMemberId(parsedMemberId);
}

module.exports = {
  MAX_ACTIVE_LOANS,
  parseId,
  borrowBook,
  returnLoan,
  listActiveLoansForMember,
};
