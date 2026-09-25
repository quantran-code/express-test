const bookService = require('./bookService');
const memberService = require('./memberService');
const {
  getLoanById: getLoanByIdFromStorage,
  getLoansByMemberId: getLoansByMemberIdFromStorage,
  getActiveLoanForMemberAndBook,
  createLoanRecord,
  getAllLoans,
} = require('../storage/loans');

const LOAN_PERIOD_DAYS = 14;

function createError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function createLoan(data) {
  const { memberId, bookId } = data || {};

  const member = memberService.getMemberById(memberId);
  if (!member) {
    throw createError('Member not found', 404);
  }

  const book = bookService.getBookById(bookId);
  if (!book) {
    throw createError('Book not found', 404);
  }

  if (book.availableCopies <= 0) {
    throw createError('No available copies for this book', 400);
  }

  const existingActiveLoan = getActiveLoanForMemberAndBook(member.id, book.id);
  if (existingActiveLoan) {
    throw createError('An active loan for this member and book already exists', 409);
  }

  const borrowedAt = new Date();
  const dueDate = new Date(borrowedAt.getTime() + LOAN_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const loan = createLoanRecord({
    memberId: member.id,
    bookId: book.id,
    borrowedAt: borrowedAt.toISOString(),
    dueDate: dueDate.toISOString(),
    returnedAt: null,
    status: 'active',
  });

  book.availableCopies -= 1;

  return loan;
}

function returnLoan(id) {
  const loan = getLoanByIdFromStorage(id);
  if (!loan) {
    throw createError('Loan not found', 404);
  }

  if (loan.status === 'returned') {
    return loan;
  }

  loan.returnedAt = new Date().toISOString();
  loan.status = 'returned';

  const book = bookService.getBookById(loan.bookId);
  if (book) {
    book.availableCopies += 1;
  }

  return loan;
}

function getLoansByMemberId(memberId) {
  return getLoansByMemberIdFromStorage(memberId);
}

function getLoanById(id) {
  return getLoanByIdFromStorage(id);
}

function listOverdueLoans() {
  const now = Date.now();
  return getAllLoans().filter(
    (loan) => loan.status !== 'returned' && new Date(loan.dueDate).getTime() < now
  );
}

module.exports = {
  createLoan,
  returnLoan,
  getLoansByMemberId,
  getLoanById,
  listOverdueLoans,
};
