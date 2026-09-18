const request = require('supertest');
const app = require('../src/app');
const memberService = require('../src/services/memberService');
const bookService = require('../src/services/bookService');
const loanService = require('../src/services/loanService');

function validMemberPayload(overrides = {}) {
  return {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    ...overrides,
  };
}

function validBookPayload(overrides = {}) {
  return {
    title: 'Clean Code',
    author: 'Robert C. Martin',
    isbn: '9780132350884',
    totalCopies: 5,
    ...overrides,
  };
}

describe('POST /loans', () => {
  beforeEach(() => {
    memberService.resetMembers();
    bookService.resetBooks();
    loanService.resetLoans();
  });

  it('creates an active loan', async () => {
    const memberRes = await request(app).post('/members').send(validMemberPayload({ email: 'm1@example.com' }));
    const bookRes = await request(app).post('/books').send(validBookPayload({ isbn: 'b1' }));

    const res = await request(app)
      .post('/loans')
      .send({ memberId: memberRes.body.id, bookId: bookRes.body.id });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('active');
    expect(res.body.borrowedAt).toBeDefined();
    expect(res.body.returnedAt).toBeNull();
  });

  it('returns 404 when memberId is unknown', async () => {
    const bookRes = await request(app).post('/books').send(validBookPayload({ isbn: 'b1' }));

    const res = await request(app)
      .post('/loans')
      .send({ memberId: 'missing', bookId: bookRes.body.id });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });

  it('returns 404 when bookId is unknown', async () => {
    const memberRes = await request(app).post('/members').send(validMemberPayload({ email: 'm1@example.com' }));

    const res = await request(app)
      .post('/loans')
      .send({ memberId: memberRes.body.id, bookId: 'missing-book' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });

  it('returns 409 BOOK_ALREADY_BORROWED when book already has active loan', async () => {
    const m1 = await request(app).post('/members').send(validMemberPayload({ email: 'm1@example.com' }));
    const m2 = await request(app).post('/members').send(validMemberPayload({ email: 'm2@example.com' }));
    const b1 = await request(app).post('/books').send(validBookPayload({ isbn: 'b1' }));

    const first = await request(app).post('/loans').send({ memberId: m1.body.id, bookId: b1.body.id });
    expect(first.status).toBe(201);

    const second = await request(app).post('/loans').send({ memberId: m2.body.id, bookId: b1.body.id });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('Conflict');
    expect(second.body.message).toBe('BOOK_ALREADY_BORROWED');
  });

  it('returns 409 MEMBER_LOAN_LIMIT_REACHED when active-loan cap reached', async () => {
    const member = await request(app).post('/members').send(validMemberPayload({ email: 'm1@example.com' }));

    const b1 = await request(app).post('/books').send(validBookPayload({ isbn: 'b1' }));
    const b2 = await request(app).post('/books').send(validBookPayload({ isbn: 'b2' }));
    const b3 = await request(app).post('/books').send(validBookPayload({ isbn: 'b3' }));
    const b4 = await request(app).post('/books').send(validBookPayload({ isbn: 'b4' }));

    await request(app).post('/loans').send({ memberId: member.body.id, bookId: b1.body.id });
    await request(app).post('/loans').send({ memberId: member.body.id, bookId: b2.body.id });
    await request(app).post('/loans').send({ memberId: member.body.id, bookId: b3.body.id });

    const res = await request(app).post('/loans').send({ memberId: member.body.id, bookId: b4.body.id });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
    expect(res.body.message).toBe('MEMBER_LOAN_LIMIT_REACHED');
  });
});

describe('PATCH /loans/:id/return', () => {
  beforeEach(() => {
    memberService.resetMembers();
    bookService.resetBooks();
    loanService.resetLoans();
  });

  it('is idempotent', async () => {
    const member = await request(app).post('/members').send(validMemberPayload({ email: 'm1@example.com' }));
    const book = await request(app).post('/books').send(validBookPayload({ isbn: 'b1' }));

    const createdLoan = await request(app).post('/loans').send({ memberId: member.body.id, bookId: book.body.id });
    const id = createdLoan.body.id;

    const first = await request(app).patch(`/loans/${id}/return`).send({});
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('returned');
    expect(first.body.returnedAt).toBeDefined();

    const second = await request(app).patch(`/loans/${id}/return`).send({});
    expect(second.status).toBe(200);
    expect(second.body.returnedAt).toBe(first.body.returnedAt);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).patch('/loans/does-not-exist/return').send({});
    expect(res.status).toBe(404);
  });
});
