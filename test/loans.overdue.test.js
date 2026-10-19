const request = require('supertest');
const app = require('../src/app');
const bookRepository = require('../src/repositories/bookRepository');
const memberRepository = require('../src/repositories/memberRepository');
const loanRepository = require('../src/repositories/loanRepository');

// Overdue payload shape: the flat loan keys plus the system-set dueDate.
const OVERDUE_LOAN_KEYS = [
  'bookId',
  'borrowedAt',
  'dueDate',
  'id',
  'memberId',
  'returnedAt',
];

// Flat loan shape the API contract promises: no other keys are allowed.
const LOAN_KEYS = ['bookId', 'borrowedAt', 'id', 'memberId', 'returnedAt'];

const LOAN_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;

let bookCounter = 0;
let memberCounter = 0;

async function seedBook(overrides = {}) {
  bookCounter += 1;

  const res = await request(app)
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

  const res = await request(app)
    .post('/members')
    .send({
      name: `Seeded Member ${memberCounter}`,
      email: `member${memberCounter}@example.com`,
      ...overrides,
    });

  return res.body;
}

function borrow(bookId, memberId) {
  return request(app).post('/loans').send({ bookId, memberId });
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

function getOverdue() {
  return request(app).get('/loans/overdue');
}

describe('Loan due dates and GET /loans/overdue', () => {
  beforeEach(() => {
    bookRepository.reset();
    memberRepository.reset();
    loanRepository.reset();
  });

  it('sets dueDate exactly 14 days after borrowedAt on a new loan', async () => {
    const book = await seedBook();
    const member = await seedMember();

    const res = await borrow(book.id, member.id);
    expect(res.status).toBe(201);

    const stored = loanRepository.findById(res.body.id);
    expect(stored).toBeDefined();
    expect(stored.dueDate).toBe(
      new Date(Date.parse(stored.borrowedAt) + LOAN_PERIOD_MS).toISOString(),
    );
  });

  it('keeps the POST /loans response free of dueDate', async () => {
    const book = await seedBook();
    const member = await seedMember();

    const res = await borrow(book.id, member.id);

    expect(res.status).toBe(201);
    expect(res.body.dueDate).toBeUndefined();
    expect(Object.keys(res.body).sort()).toEqual(LOAN_KEYS);
  });

  it('returns an empty array when no loan is overdue', async () => {
    const book = await seedBook();
    const member = await seedMember();

    const loan = await borrow(book.id, member.id);
    expect(loan.status).toBe(201);

    const res = await getOverdue();

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toEqual([]);
  });

  it('lists an unreturned loan whose dueDate has passed, with the overdue key set', async () => {
    const book = await seedBook();
    const member = await seedMember();

    const loan = await borrow(book.id, member.id);
    expect(loan.status).toBe(201);

    const pastDueDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    backdateDueDate(loan.body.id, pastDueDate);

    const res = await getOverdue();

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);

    const [overdueLoan] = res.body;

    expect(overdueLoan).toEqual({
      id: loan.body.id,
      bookId: book.id,
      memberId: member.id,
      borrowedAt: loan.body.borrowedAt,
      returnedAt: null,
      dueDate: pastDueDate,
    });
    expect(Object.keys(overdueLoan).sort()).toEqual(OVERDUE_LOAN_KEYS);
  });

  it('only lists a loan once its stored dueDate moves into the past', async () => {
    const book = await seedBook();
    const member = await seedMember();

    const loan = await borrow(book.id, member.id);
    expect(loan.status).toBe(201);

    const notYetDue = await getOverdue();

    expect(notYetDue.status).toBe(200);
    expect(notYetDue.body).toEqual([]);

    const pastDueDate = new Date(Date.now() - 60 * 1000).toISOString();
    backdateDueDate(loan.body.id, pastDueDate);

    const nowDue = await getOverdue();

    expect(nowDue.status).toBe(200);
    expect(nowDue.body).toHaveLength(1);
    expect(nowDue.body[0].id).toBe(loan.body.id);
    expect(nowDue.body[0].returnedAt).toBeNull();
    expect(nowDue.body[0].dueDate).toBe(pastDueDate);
  });

  it('never lists a returned loan as overdue, even with a past dueDate', async () => {
    const book = await seedBook();
    const member = await seedMember();

    const loan = await borrow(book.id, member.id);
    expect(loan.status).toBe(201);

    const pastDueDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    backdateDueDate(loan.body.id, pastDueDate);

    const returned = await request(app).post(`/loans/${loan.body.id}/return`);
    expect(returned.status).toBe(200);
    expect(returned.body.dueDate).toBeUndefined();
    expect(Object.keys(returned.body).sort()).toEqual(LOAN_KEYS);

    const res = await getOverdue();

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
