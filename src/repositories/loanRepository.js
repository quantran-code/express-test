/**
 * @typedef {Object} Loan
 * @property {number} id
 * @property {number} bookId
 * @property {number} memberId
 * @property {string} borrowedAt
 * @property {string | null} returnedAt
 * @property {string} dueDate
 */

let loans = [];
let nextId = 1;

/**
 * @param {{ bookId: number, memberId: number, borrowedAt: string, returnedAt: string | null, dueDate: string }} data
 * @returns {Loan}
 */
function create(data) {
  const loan = {
    id: nextId,
    bookId: data.bookId,
    memberId: data.memberId,
    borrowedAt: data.borrowedAt,
    returnedAt: data.returnedAt,
    dueDate: data.dueDate,
  };

  nextId += 1;
  loans.push(loan);

  return loan;
}

/**
 * @param {number} id
 * @returns {Loan | undefined}
 */
function findById(id) {
  return loans.find((loan) => loan.id === id);
}

/**
 * @returns {Loan[]}
 */
function findAll() {
  return loans.slice();
}

/**
 * @param {number} memberId
 * @returns {Loan[]}
 */
function findActiveByMemberId(memberId) {
  return loans.filter(
    (loan) => loan.memberId === memberId && loan.returnedAt === null,
  );
}

/**
 * @param {number} memberId
 * @param {number} bookId
 * @returns {Loan | undefined}
 */
function findActiveByMemberAndBook(memberId, bookId) {
  return loans.find(
    (loan) =>
      loan.memberId === memberId &&
      loan.bookId === bookId &&
      loan.returnedAt === null,
  );
}

/**
 * @param {number} memberId
 * @returns {number}
 */
function countActiveByMemberId(memberId) {
  return findActiveByMemberId(memberId).length;
}

/**
 * @param {number} id
 * @param {Partial<Loan>} patch
 * @returns {Loan | undefined}
 */
function update(id, patch) {
  const loan = findById(id);

  if (!loan) {
    return undefined;
  }

  Object.assign(loan, patch);

  return loan;
}

/**
 * @returns {void}
 */
function reset() {
  loans = [];
  nextId = 1;
}

module.exports = {
  create,
  findById,
  findAll,
  findActiveByMemberId,
  findActiveByMemberAndBook,
  countActiveByMemberId,
  update,
  reset,
};
