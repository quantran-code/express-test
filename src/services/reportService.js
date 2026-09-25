const bookService = require('./bookService');
const { getAllLoans } = require('../storage/loans');

function mostBorrowedBooks() {
  const loans = getAllLoans();
  const counts = new Map();

  loans.forEach((loan) => {
    const current = counts.get(loan.bookId) || 0;
    counts.set(loan.bookId, current + 1);
  });

  const entries = Array.from(counts.entries()).map(([bookId, totalBorrowCount]) => {
    const book = bookService.getBookById(bookId);
    return {
      bookId,
      title: book ? book.title : null,
      totalBorrowCount,
    };
  });

  entries.sort((a, b) => b.totalBorrowCount - a.totalBorrowCount);

  return entries;
}

function overdueSummary() {
  const now = Date.now();
  const loans = getAllLoans();
  const counts = new Map();

  loans.forEach((loan) => {
    if (loan.status === 'returned') {
      return;
    }
    if (new Date(loan.dueDate).getTime() >= now) {
      return;
    }
    const current = counts.get(loan.memberId) || 0;
    counts.set(loan.memberId, current + 1);
  });

  return Array.from(counts.entries())
    .filter(([, overdueCount]) => overdueCount > 0)
    .map(([memberId, overdueCount]) => ({ memberId, overdueCount }));
}

module.exports = {
  mostBorrowedBooks,
  overdueSummary,
};
