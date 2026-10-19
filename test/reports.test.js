const request = require('supertest');
const app = require('../src/app');
const bookRepository = require('../src/repositories/bookRepository');
const memberRepository = require('../src/repositories/memberRepository');
const loanRepository = require('../src/repositories/loanRepository');
const userRepository = require('../src/repositories/userRepository');
const {
  authedRequest,
  requestAs,
  registerAndSignInMember,
  signInLibrarian,
} = require('./helpers/auth');

beforeAll(async () => {
  await signInLibrarian(app);
});

// Report payload shapes: exactly these keys, nothing else.
const MOST_BORROWED_KEYS = ['bookId', 'title', 'totalBorrows'];
const OVERDUE_SUMMARY_KEYS = ['memberId', 'name', 'overdueCount'];

let bookCounter = 0;
let memberCounter = 0;

async function seedBook(overrides = {}) {
  bookCounter += 1;

  const res = await authedRequest(app)
    .post('/books')
    .send({
      title: `Seeded Book ${bookCounter}`,
      author: 'Seeded Author',
      isbn: `978000000${String(bookCounter).padStart(4, '0')}`,
      totalCopies: 1,
      ...overrides,
    });

  return res.body;
}

async function seedMember(overrides = {}) {
  memberCounter += 1;

  const res = await authedRequest(app)
    .post('/members')
    .send({
      name: `Seeded Member ${memberCounter}`,
      email: `member${memberCounter}@example.com`,
      ...overrides,
    });

  return res.body;
}

function borrow(bookId, memberId) {
  return authedRequest(app).post('/loans').send({ bookId, memberId });
}

function returnLoan(loanId) {
  return authedRequest(app).post(`/loans/${loanId}/return`);
}

/**
 * Simulates time having passed by moving the stored dueDate into the past.
 *
 * @param {number} loanId
 * @param {string} isoDueDate
 * @returns {object | undefined}
 */
function backdateDueDate(loanId, isoDueDate) {
  return loanRepository.update(loanId, { dueDate: isoDueDate });
}

/**
 * @param {number} daysAgo
 * @returns {string}
 */
function pastIsoDate(daysAgo) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

function getMostBorrowed() {
  return authedRequest(app).get('/reports/most-borrowed');
}

function getOverdueSummary() {
  return authedRequest(app).get('/reports/overdue-summary');
}

describe('reports', () => {
  beforeEach(() => {
    bookRepository.reset();
    memberRepository.reset();
    loanRepository.reset();
    userRepository.reset();
  });

  describe('GET /reports/most-borrowed', () => {
    it('counts every loan ever recorded, returned or not, most borrowed first (AC6)', async () => {
      const popularBook = await seedBook({
        title: 'The Popular Book',
        totalCopies: 3,
      });
      const quietBook = await seedBook({ title: 'The Quiet Book' });

      const firstReader = await seedMember();
      const secondReader = await seedMember();
      const thirdReader = await seedMember();

      const firstLoan = await borrow(popularBook.id, firstReader.id);
      const secondLoan = await borrow(popularBook.id, secondReader.id);
      const thirdLoan = await borrow(popularBook.id, thirdReader.id);

      expect(firstLoan.status).toBe(201);
      expect(secondLoan.status).toBe(201);
      expect(thirdLoan.status).toBe(201);

      // A returned loan still counts towards the all-time total.
      const returned = await returnLoan(firstLoan.body.id);
      expect(returned.status).toBe(200);

      const quietLoan = await borrow(quietBook.id, firstReader.id);
      expect(quietLoan.status).toBe(201);

      const res = await getMostBorrowed();

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        {
          bookId: popularBook.id,
          title: 'The Popular Book',
          totalBorrows: 3,
        },
        {
          bookId: quietBook.id,
          title: 'The Quiet Book',
          totalBorrows: 1,
        },
      ]);
    });

    it('returns exactly the contract keys and omits books that were never borrowed', async () => {
      const borrowedBook = await seedBook({ title: 'Borrowed Book' });
      const untouchedBook = await seedBook({ title: 'Untouched Book' });
      const reader = await seedMember();

      const loan = await borrow(borrowedBook.id, reader.id);
      expect(loan.status).toBe(201);

      const res = await getMostBorrowed();

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].bookId).toBe(borrowedBook.id);
      expect(res.body.map((row) => row.bookId)).not.toContain(untouchedBook.id);

      for (const row of res.body) {
        expect(Object.keys(row).sort()).toEqual(MOST_BORROWED_KEYS);
      }
    });

    it('returns totals per book when one book has been borrowed many times', async () => {
      const book = await seedBook({ title: 'Repeated Book' });
      const reader = await seedMember();

      for (let cycle = 0; cycle < 3; cycle += 1) {
        const borrowed = await borrow(book.id, reader.id);
        expect(borrowed.status).toBe(201);

        const returned = await returnLoan(borrowed.body.id);
        expect(returned.status).toBe(200);
      }

      const res = await getMostBorrowed();

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { bookId: book.id, title: 'Repeated Book', totalBorrows: 3 },
      ]);
    });
  });

  describe('GET /reports/overdue-summary', () => {
    it('reports only members with currently overdue loans, counted per member (AC7)', async () => {
      const firstBook = await seedBook({ title: 'Overdue One' });
      const secondBook = await seedBook({ title: 'Overdue Two' });
      const thirdBook = await seedBook({ title: 'Overdue Three' });
      const freshBook = await seedBook({ title: 'Not Yet Due' });
      const returnedBook = await seedBook({ title: 'Backdated But Returned' });

      const twoOverdue = await seedMember({ name: 'Two Overdue' });
      const oneOverdue = await seedMember({ name: 'One Overdue' });
      const noneOverdue = await seedMember({ name: 'None Overdue' });

      const first = await borrow(firstBook.id, twoOverdue.id);
      const second = await borrow(secondBook.id, twoOverdue.id);
      const third = await borrow(thirdBook.id, oneOverdue.id);
      const fresh = await borrow(freshBook.id, noneOverdue.id);
      const backdatedReturned = await borrow(returnedBook.id, noneOverdue.id);

      for (const res of [first, second, third, fresh, backdatedReturned]) {
        expect(res.status).toBe(201);
      }

      const pastDueDate = pastIsoDate(1);
      backdateDueDate(first.body.id, pastDueDate);
      backdateDueDate(second.body.id, pastDueDate);
      backdateDueDate(third.body.id, pastDueDate);
      backdateDueDate(backdatedReturned.body.id, pastDueDate);

      const returned = await returnLoan(backdatedReturned.body.id);
      expect(returned.status).toBe(200);

      const res = await getOverdueSummary();

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { memberId: twoOverdue.id, name: 'Two Overdue', overdueCount: 2 },
        { memberId: oneOverdue.id, name: 'One Overdue', overdueCount: 1 },
      ]);
    });

    it('returns exactly the contract keys for every row', async () => {
      const book = await seedBook();
      const member = await seedMember({ name: 'Overdue Member' });

      const loan = await borrow(book.id, member.id);
      expect(loan.status).toBe(201);

      backdateDueDate(loan.body.id, pastIsoDate(1));

      const res = await getOverdueSummary();

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].memberId).toBe(member.id);

      for (const row of res.body) {
        expect(Object.keys(row).sort()).toEqual(OVERDUE_SUMMARY_KEYS);
      }
    });

    it('returns an empty array when no loan is currently overdue', async () => {
      const book = await seedBook();
      const member = await seedMember();

      const loan = await borrow(book.id, member.id);
      expect(loan.status).toBe(201);

      const res = await getOverdueSummary();

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('report access control', () => {
    it('forbids a member from reading either report (AC5)', async () => {
      const session = await registerAndSignInMember(app, {
        name: 'Report Reader',
        email: 'report.reader@example.com',
      });
      const asMember = requestAs(app, session.accessToken);

      const mostBorrowed = await asMember.get('/reports/most-borrowed');

      expect(mostBorrowed.status).toBe(403);
      expect(typeof mostBorrowed.body.error).toBe('string');
      expect(Array.isArray(mostBorrowed.body)).toBe(false);

      const overdueSummary = await asMember.get('/reports/overdue-summary');

      expect(overdueSummary.status).toBe(403);
      expect(typeof overdueSummary.body.error).toBe('string');
      expect(Array.isArray(overdueSummary.body)).toBe(false);
    });

    it('rejects an unauthenticated call to either report with 401', async () => {
      const mostBorrowed = await request(app).get('/reports/most-borrowed');

      expect(mostBorrowed.status).toBe(401);
      expect(typeof mostBorrowed.body.error).toBe('string');

      const overdueSummary = await request(app).get('/reports/overdue-summary');

      expect(overdueSummary.status).toBe(401);
      expect(typeof overdueSummary.body.error).toBe('string');
    });
  });
});
