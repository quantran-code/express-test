const app = require('../src/app');
const bookRepository = require('../src/repositories/bookRepository');
const memberRepository = require('../src/repositories/memberRepository');
const loanRepository = require('../src/repositories/loanRepository');
const { authedRequest, signInLibrarian } = require('./helpers/auth');

beforeAll(async () => {
  await signInLibrarian(app);
});

// Flat loan shape the API contract promises: no other keys are allowed.
const LOAN_KEYS = ['bookId', 'borrowedAt', 'id', 'memberId', 'returnedAt'];

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

function getBook(id) {
  return authedRequest(app).get(`/books/${id}`);
}

describe('Loans', () => {
  beforeEach(() => {
    bookRepository.reset();
    memberRepository.reset();
    loanRepository.reset();
  });

  describe('POST /loans', () => {
    it('creates a loan and decrements availableCopies by 1', async () => {
      const book = await seedBook({ totalCopies: 2 });
      const member = await seedMember();

      const res = await borrow(book.id, member.id);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(Number),
        bookId: book.id,
        memberId: member.id,
        borrowedAt: expect.any(String),
        returnedAt: null,
      });
      expect(res.body.borrowedAt.length).toBeGreaterThan(0);
      expect(Object.keys(res.body).sort()).toEqual(LOAN_KEYS);

      const stored = await getBook(book.id);
      expect(stored.status).toBe(200);
      expect(stored.body.availableCopies).toBe(1);
      expect(stored.body.totalCopies).toBe(2);
    });

    it('rejects borrowing a book with no copies available and changes nothing', async () => {
      const book = await seedBook({ totalCopies: 1 });
      const firstMember = await seedMember();
      const secondMember = await seedMember();

      const taken = await borrow(book.id, firstMember.id);
      expect(taken.status).toBe(201);

      const res = await borrow(book.id, secondMember.id);

      expect(res.status).toBe(409);
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error).toMatch(/no copies/i);

      const stored = await getBook(book.id);
      expect(stored.body.availableCopies).toBe(0);

      const secondMemberLoans = await authedRequest(app).get(
        `/members/${secondMember.id}/loans`,
      );
      expect(secondMemberLoans.body).toEqual([]);
    });

    it('rejects a duplicate active loan for the same book and changes nothing', async () => {
      const book = await seedBook({ totalCopies: 2 });
      const member = await seedMember();

      const first = await borrow(book.id, member.id);
      expect(first.status).toBe(201);

      const res = await borrow(book.id, member.id);

      expect(res.status).toBe(409);
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error).toMatch(/active loan/i);

      const stored = await getBook(book.id);
      expect(stored.body.availableCopies).toBe(1);

      const active = await authedRequest(app).get(`/members/${member.id}/loans`);
      expect(active.body).toHaveLength(1);
    });

    it('rejects a fourth active loan for the same member with a limit-reached error', async () => {
      const member = await seedMember();
      const books = [];

      for (let index = 0; index < 4; index += 1) {
        books.push(await seedBook({ totalCopies: 1 }));
      }

      for (const book of books.slice(0, 3)) {
        const loan = await borrow(book.id, member.id);
        expect(loan.status).toBe(201);
      }

      const fourth = books[3];
      const res = await borrow(fourth.id, member.id);

      expect(res.status).toBe(409);
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error).toMatch(/at most 3 active loans/i);

      const stored = await getBook(fourth.id);
      expect(stored.body.availableCopies).toBe(1);

      const active = await authedRequest(app).get(`/members/${member.id}/loans`);
      expect(active.body).toHaveLength(3);
    });

    it('rejects an unknown bookId with 404', async () => {
      const member = await seedMember();

      const res = await borrow(999, member.id);

      expect(res.status).toBe(404);
      expect(typeof res.body.error).toBe('string');
    });

    it('rejects an unknown memberId with 404', async () => {
      const book = await seedBook();

      const res = await borrow(book.id, 999);

      expect(res.status).toBe(404);
      expect(typeof res.body.error).toBe('string');

      const stored = await getBook(book.id);
      expect(stored.body.availableCopies).toBe(book.availableCopies);
    });
  });

  describe('POST /loans/:id/return', () => {
    it('sets returnedAt and increments availableCopies by 1', async () => {
      const book = await seedBook({ totalCopies: 1 });
      const member = await seedMember();

      const loan = await borrow(book.id, member.id);
      expect(loan.status).toBe(201);
      expect(loan.body.returnedAt).toBeNull();

      const res = await authedRequest(app).post(`/loans/${loan.body.id}/return`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: loan.body.id,
        bookId: book.id,
        memberId: member.id,
        borrowedAt: loan.body.borrowedAt,
        returnedAt: expect.any(String),
      });
      expect(res.body.returnedAt.length).toBeGreaterThan(0);
      expect(Object.keys(res.body).sort()).toEqual(LOAN_KEYS);

      const stored = await getBook(book.id);
      expect(stored.body.availableCopies).toBe(1);
      expect(stored.body.totalCopies).toBe(1);
    });

    it('returns 404 for an unknown loan id', async () => {
      const book = await seedBook();
      const member = await seedMember();
      await borrow(book.id, member.id);

      const res = await authedRequest(app).post('/loans/999/return');

      expect(res.status).toBe(404);
      expect(typeof res.body.error).toBe('string');
    });

    it('returns 409 for an already returned loan and leaves availableCopies unchanged', async () => {
      const book = await seedBook({ totalCopies: 2 });
      const member = await seedMember();

      const loan = await borrow(book.id, member.id);
      expect(loan.status).toBe(201);

      const firstReturn = await authedRequest(app).post(`/loans/${loan.body.id}/return`);
      expect(firstReturn.status).toBe(200);

      const res = await authedRequest(app).post(`/loans/${loan.body.id}/return`);

      expect(res.status).toBe(409);
      expect(typeof res.body.error).toBe('string');

      const stored = await getBook(book.id);
      expect(stored.body.availableCopies).toBe(2);
      expect(stored.body.availableCopies).toBeLessThanOrEqual(stored.body.totalCopies);
    });
  });

  describe('GET /members/:id/loans', () => {
    it("lists only the member's unreturned loans and shrinks after a return", async () => {
      const member = await seedMember();
      const otherMember = await seedMember();

      const firstBook = await seedBook({ totalCopies: 1 });
      const secondBook = await seedBook({ totalCopies: 1 });
      const otherBook = await seedBook({ totalCopies: 1 });

      const firstLoan = await borrow(firstBook.id, member.id);
      const secondLoan = await borrow(secondBook.id, member.id);
      const otherLoan = await borrow(otherBook.id, otherMember.id);

      expect(firstLoan.status).toBe(201);
      expect(secondLoan.status).toBe(201);
      expect(otherLoan.status).toBe(201);

      const res = await authedRequest(app).get(`/members/${member.id}/loans`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((loan) => loan.id).sort()).toEqual(
        [firstLoan.body.id, secondLoan.body.id].sort(),
      );
      expect(res.body.every((loan) => loan.returnedAt === null)).toBe(true);

      for (const loan of res.body) {
        expect(Object.keys(loan).sort()).toEqual(LOAN_KEYS);
      }

      const returned = await authedRequest(app).post(
        `/loans/${firstLoan.body.id}/return`,
      );
      expect(returned.status).toBe(200);

      const afterReturn = await authedRequest(app).get(`/members/${member.id}/loans`);

      expect(afterReturn.status).toBe(200);
      expect(afterReturn.body).toHaveLength(1);
      expect(afterReturn.body[0].id).toBe(secondLoan.body.id);
      expect(afterReturn.body.some((loan) => loan.returnedAt !== null)).toBe(false);
    });

    it('returns 404 for an unknown member id', async () => {
      await seedMember();

      const res = await authedRequest(app).get('/members/999/loans');

      expect(res.status).toBe(404);
      expect(typeof res.body.error).toBe('string');
    });
  });

  describe('copy balance', () => {
    it('returns availableCopies to totalCopies across borrow/return cycles and never exceeds it', async () => {
      const book = await seedBook({ totalCopies: 2 });
      const member = await seedMember();

      expect(book.availableCopies).toBe(2);

      for (let cycle = 0; cycle < 3; cycle += 1) {
        const borrowed = await borrow(book.id, member.id);
        expect(borrowed.status).toBe(201);

        const afterBorrow = await getBook(book.id);
        expect(afterBorrow.body.availableCopies).toBe(1);
        expect(afterBorrow.body.availableCopies).toBeLessThanOrEqual(
          afterBorrow.body.totalCopies,
        );

        const returned = await authedRequest(app).post(
          `/loans/${borrowed.body.id}/return`,
        );
        expect(returned.status).toBe(200);

        const afterReturn = await getBook(book.id);
        expect(afterReturn.body.availableCopies).toBe(2);
        expect(afterReturn.body.availableCopies).toBe(
          afterReturn.body.totalCopies,
        );
        expect(afterReturn.body.availableCopies).toBeLessThanOrEqual(
          afterReturn.body.totalCopies,
        );
      }
    });

    it('still rejects deleting a book while one of its copies is on loan', async () => {
      const book = await seedBook({ totalCopies: 1 });
      const member = await seedMember();

      const loan = await borrow(book.id, member.id);
      expect(loan.status).toBe(201);

      const res = await authedRequest(app).delete(`/books/${book.id}`);

      expect(res.status).toBe(409);
      expect(typeof res.body.error).toBe('string');

      const stillThere = await getBook(book.id);
      expect(stillThere.status).toBe(200);
      expect(stillThere.body.availableCopies).toBe(0);
    });
  });
});
