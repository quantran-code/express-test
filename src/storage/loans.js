let loans = [];
let nextId = 1;

function getAllLoans() {
  return loans;
}

function getLoanById(id) {
  // eslint-disable-next-line eqeqeq
  return loans.find((loan) => loan.id == id);
}

function getLoansByMemberId(memberId) {
  // eslint-disable-next-line eqeqeq
  return loans.filter((loan) => loan.memberId == memberId);
}

function getActiveLoanForMemberAndBook(memberId, bookId) {
  return loans.find(
    // eslint-disable-next-line eqeqeq
    (loan) => loan.memberId == memberId && loan.bookId == bookId && loan.status === 'active'
  );
}

function createLoanRecord(data) {
  const { memberId, bookId, borrowedAt, dueDate, status, returnedAt } = data;
  const loan = {
    id: nextId,
    memberId,
    bookId,
    borrowedAt,
    dueDate,
    returnedAt: returnedAt === undefined ? null : returnedAt,
    status,
  };
  nextId += 1;
  loans.push(loan);
  return loan;
}

module.exports = {
  getAllLoans,
  getLoanById,
  getLoansByMemberId,
  getActiveLoanForMemberAndBook,
  createLoanRecord,
};
