const HttpError = require('../errors/httpError');
const bookRepository = require('../repositories/bookRepository');
const memberRepository = require('../repositories/memberRepository');
const loanRepository = require('../repositories/loanRepository');

const MAX_ACTIVE_LOANS = 3;
const LOAN_PERIOD_DAYS = 14;

/**
 * @param {string} borrowedAt
 * @returns {string}
 */
function computeDueDate(borrowedAt) {
  const dueAt =
    Date.parse(borrowedAt) + LOAN_PERIOD_DAYS * 24 * 60 * 60 * 1000;

  return new Date(dueAt).toISOString();
}

/**
 * Strips the stored dueDate so existing loan payloads keep their shape.
 *
 * @param {import('../repositories/loanRepository').Loan} loan
 * @returns {{ id: number, bookId: number, memberId: number, borrowedAt: string, returnedAt: string | null }}
 */
function toLoanResponse(loan) {
  return {
    id: loan.id,
    bookId: loan.bookId,
    memberId: loan.memberId,
    borrowedAt: loan.borrowedAt,
    returnedAt: loan.returnedAt,
  };
}

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
 * @returns {{ id: number, bookId: number, memberId: number, borrowedAt: string, returnedAt: string | null }}
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

  const borrowedAt = new Date().toISOString();

  const loan = loanRepository.create({
    bookId,
    memberId,
    borrowedAt,
    returnedAt: null,
    dueDate: computeDueDate(borrowedAt),
  });

  bookRepository.update(bookId, { availableCopies: book.availableCopies - 1 });

  return toLoanResponse(loan);
}

/**
 * @param {number | string} id
 * @returns {{ id: number, bookId: number, memberId: number, borrowedAt: string, returnedAt: string | null }}
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

  return toLoanResponse(
    loanRepository.update(loanId, {
      returnedAt: new Date().toISOString(),
    }),
  );
}

/**
 * @param {number | string} memberId
 * @returns {{ id: number, bookId: number, memberId: number, borrowedAt: string, returnedAt: string | null }[]}
 */
function listActiveLoansForMember(memberId) {
  const parsedMemberId = parseId(memberId, 'Member not found');
  const member = memberRepository.findById(parsedMemberId);

  if (!member) {
    throw new HttpError(404, 'Member not found');
  }

  const activeLoans = loanRepository.findActiveByMemberId(parsedMemberId);

  return activeLoans.map(toLoanResponse);
}

/**
 * @param {import('../repositories/loanRepository').Loan} loan
 * @param {number} [now]
 * @returns {boolean}
 */
function isOverdue(loan, now = Date.now()) {
  if (loan.returnedAt !== null) {
    return false;
  }

  return now > Date.parse(loan.dueDate);
}

/**
 * @param {import('../repositories/loanRepository').Loan} loan
 * @returns {{ id: number, bookId: number, memberId: number, borrowedAt: string, returnedAt: string | null, dueDate: string }}
 */
function toLoanWithDueDate(loan) {
  return {
    id: loan.id,
    bookId: loan.bookId,
    memberId: loan.memberId,
    borrowedAt: loan.borrowedAt,
    returnedAt: loan.returnedAt,
    dueDate: loan.dueDate,
  };
}

/**
 * Overdue status is evaluated on every call so it always reflects the current moment.
 *
 * @returns {{ id: number, bookId: number, memberId: number, borrowedAt: string, returnedAt: string | null, dueDate: string }[]}
 */
function listOverdueLoans() {
  const now = Date.now();

  return loanRepository
    .findAll()
    .filter((loan) => isOverdue(loan, now))
    .map(toLoanWithDueDate);
}

module.exports = {
  MAX_ACTIVE_LOANS,
  LOAN_PERIOD_DAYS,
  parseId,
  computeDueDate,
  toLoanResponse,
  isOverdue,
  toLoanWithDueDate,
  borrowBook,
  returnLoan,
  listActiveLoansForMember,
  listOverdueLoans,
};
