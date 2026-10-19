const bookRepository = require('../repositories/bookRepository');
const memberRepository = require('../repositories/memberRepository');
const loanRepository = require('../repositories/loanRepository');
const loanService = require('./loanService');

/**
 * Ranks books by how many loans they have ever had, most borrowed first.
 *
 * @returns {{ bookId: number, title: string, totalBorrows: number }[]}
 */
function mostBorrowedBooks() {
  const counts = new Map();

  for (const loan of loanRepository.findAll()) {
    counts.set(loan.bookId, (counts.get(loan.bookId) || 0) + 1);
  }

  const rows = [];

  for (const [bookId, totalBorrows] of counts.entries()) {
    const book = bookRepository.findById(bookId);

    if (!book) {
      continue;
    }

    rows.push({ bookId, title: book.title, totalBorrows });
  }

  rows.sort(
    (left, right) =>
      right.totalBorrows - left.totalBorrows || left.bookId - right.bookId,
  );

  return rows;
}

/**
 * Counts the currently overdue loans per member; members without an overdue
 * loan are not reported.
 *
 * @returns {{ memberId: number, name: string, overdueCount: number }[]}
 */
function overdueSummary() {
  const now = Date.now();
  const counts = new Map();

  for (const loan of loanRepository.findAll()) {
    if (!loanService.isOverdue(loan, now)) {
      continue;
    }

    counts.set(loan.memberId, (counts.get(loan.memberId) || 0) + 1);
  }

  const rows = [];

  for (const [memberId, overdueCount] of counts.entries()) {
    const member = memberRepository.findById(memberId);

    if (!member) {
      continue;
    }

    rows.push({ memberId, name: member.name, overdueCount });
  }

  rows.sort((left, right) => left.memberId - right.memberId);

  return rows;
}

module.exports = {
  mostBorrowedBooks,
  overdueSummary,
};
