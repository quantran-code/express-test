const request = require('supertest');
const app = require('../src/app');
const bookService = require('../src/services/bookService');
const memberService = require('../src/services/memberService');
const loanService = require('../src/services/loanService');

function makeMember(overrides = {}) {
  return memberService.createMember({
    name: 'Test Member',
    email: `member-${Date.now()}-${Math.random()}@example.com`,
    role: 'member',
    ...overrides,
  });
}

function makeLibrarian(overrides = {}) {
  return makeMember({ role: 'librarian', ...overrides });
}

describe('POST /loans', () => {
  it('creates an active loan and decrements availableCopies, returning the id and dueDate', async () => {
    const member = makeMember();
    const book = await request(app).post('/books').send({
      title: 'Loanable Book',
      author: 'Author',
      isbn: 'ISBN-LOAN-1',
      totalCopies: 3,
    });
    expect(book.status).toBe(201);

    const res = await request(app)
      .post('/loans')
      .set('x-member-id', String(member.id))
      .send({ memberId: member.id, bookId: book.body.id });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(['dueDate', 'id']);
    expect(typeof res.body.id).toBe('number');

    const updatedBook = bookService.getBookById(book.body.id);
    expect(updatedBook.availableCopies).toBe(2);
  });

  it('sets dueDate to exactly 14 days after borrowedAt', async () => {
    const member = makeMember();
    const book = await request(app).post('/books').send({
      title: 'Due Date Book',
      author: 'Author',
      isbn: 'ISBN-LOAN-DUEDATE',
      totalCopies: 1,
    });
    expect(book.status).toBe(201);

    const res = await request(app)
      .post('/loans')
      .set('x-member-id', String(member.id))
      .send({ memberId: member.id, bookId: book.body.id });
    expect(res.status).toBe(201);

    const storedLoan = loanService.getLoanById(res.body.id);
    expect(storedLoan).toBeDefined();
    expect(storedLoan.dueDate).toBe(res.body.dueDate);

    const borrowedAtMs = new Date(storedLoan.borrowedAt).getTime();
    const dueDateMs = new Date(storedLoan.dueDate).getTime();
    expect(dueDateMs - borrowedAtMs).toBe(14 * 24 * 60 * 60 * 1000);
  });

  it('rejects borrowing when no copies are available (400)', async () => {
    const member = makeMember();
    const book = await request(app).post('/books').send({
      title: 'No Copies Book',
      author: 'Author',
      isbn: 'ISBN-LOAN-NOCOPIES',
      totalCopies: 1,
    });
    expect(book.status).toBe(201);

    const stored = bookService.getBookById(book.body.id);
    stored.availableCopies = 0;

    const res = await request(app)
      .post('/loans')
      .set('x-member-id', String(member.id))
      .send({ memberId: member.id, bookId: book.body.id });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects a second active loan for the same member and book', async () => {
    const member = makeMember();
    const book = await request(app).post('/books').send({
      title: 'Duplicate Loan Book',
      author: 'Author',
      isbn: 'ISBN-LOAN-DUP',
      totalCopies: 5,
    });
    expect(book.status).toBe(201);

    const first = await request(app)
      .post('/loans')
      .set('x-member-id', String(member.id))
      .send({ memberId: member.id, bookId: book.body.id });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/loans')
      .set('x-member-id', String(member.id))
      .send({ memberId: member.id, bookId: book.body.id });

    expect(second.status).toBe(409);
    expect(second.body).toHaveProperty('error');
  });

  it('returns 404 for an unknown memberId', async () => {
    const member = makeMember();
    const book = await request(app).post('/books').send({
      title: 'Unknown Member Book',
      author: 'Author',
      isbn: 'ISBN-LOAN-NOMEMBER',
      totalCopies: 2,
    });
    expect(book.status).toBe(201);

    const res = await request(app)
      .post('/loans')
      .set('x-member-id', String(member.id))
      .send({ memberId: 'does-not-exist', bookId: book.body.id });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 404 for an unknown bookId', async () => {
    const member = makeMember();

    const res = await request(app)
      .post('/loans')
      .set('x-member-id', String(member.id))
      .send({ memberId: member.id, bookId: 'does-not-exist' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 when the x-member-id header is missing', async () => {
    const book = await request(app).post('/books').send({
      title: 'Unauthenticated Book',
      author: 'Author',
      isbn: 'ISBN-LOAN-UNAUTH',
      totalCopies: 1,
    });
    expect(book.status).toBe(201);

    const res = await request(app).post('/loans').send({ memberId: 1, bookId: book.body.id });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});

describe('PATCH /loans/:id/return', () => {
  it('returns an active loan, sets it to returned, and increments availableCopies', async () => {
    const member = makeMember();
    const book = await request(app).post('/books').send({
      title: 'Returnable Book',
      author: 'Author',
      isbn: 'ISBN-RETURN-1',
      totalCopies: 4,
    });
    expect(book.status).toBe(201);

    const loan = await request(app)
      .post('/loans')
      .set('x-member-id', String(member.id))
      .send({ memberId: member.id, bookId: book.body.id });
    expect(loan.status).toBe(201);

    const beforeReturn = bookService.getBookById(book.body.id);
    expect(beforeReturn.availableCopies).toBe(3);

    const res = await request(app)
      .patch(`/loans/${loan.body.id}/return`)
      .set('x-member-id', String(member.id));

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['id']);
    expect(res.body.id).toBe(loan.body.id);

    const afterReturn = bookService.getBookById(book.body.id);
    expect(afterReturn.availableCopies).toBe(4);
  });

  it('is idempotent for an already-returned loan (does not double-increment)', async () => {
    const member = makeMember();
    const book = await request(app).post('/books').send({
      title: 'Idempotent Return Book',
      author: 'Author',
      isbn: 'ISBN-RETURN-IDEMPOTENT',
      totalCopies: 2,
    });
    expect(book.status).toBe(201);

    const loan = await request(app)
      .post('/loans')
      .set('x-member-id', String(member.id))
      .send({ memberId: member.id, bookId: book.body.id });
    expect(loan.status).toBe(201);

    const firstReturn = await request(app)
      .patch(`/loans/${loan.body.id}/return`)
      .set('x-member-id', String(member.id));
    expect(firstReturn.status).toBe(200);

    const afterFirstReturn = bookService.getBookById(book.body.id);
    expect(afterFirstReturn.availableCopies).toBe(2);

    const secondReturn = await request(app)
      .patch(`/loans/${loan.body.id}/return`)
      .set('x-member-id', String(member.id));

    expect(secondReturn.status).toBe(200);
    expect(secondReturn.body.id).toBe(loan.body.id);

    const afterSecondReturn = bookService.getBookById(book.body.id);
    expect(afterSecondReturn.availableCopies).toBe(2);
  });

  it('returns 404 for an unknown loan id', async () => {
    const member = makeMember();

    const res = await request(app)
      .patch('/loans/does-not-exist/return')
      .set('x-member-id', String(member.id));

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /members/:id/loans', () => {
  it('returns the loans for the same member', async () => {
    const member = makeMember();
    const book = await request(app).post('/books').send({
      title: 'Member Loans Book',
      author: 'Author',
      isbn: 'ISBN-MEMBER-LOANS-1',
      totalCopies: 2,
    });
    expect(book.status).toBe(201);

    const loan = await request(app)
      .post('/loans')
      .set('x-member-id', String(member.id))
      .send({ memberId: member.id, bookId: book.body.id });
    expect(loan.status).toBe(201);

    const res = await request(app)
      .get(`/members/${member.id}/loans`)
      .set('x-member-id', String(member.id));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((l) => l.id === loan.body.id)).toBe(true);
  });

  it('allows a librarian to view any member\'s loans', async () => {
    const member = makeMember();
    const librarian = makeLibrarian();
    const book = await request(app).post('/books').send({
      title: 'Librarian View Book',
      author: 'Author',
      isbn: 'ISBN-MEMBER-LOANS-2',
      totalCopies: 2,
    });
    expect(book.status).toBe(201);

    const loan = await request(app)
      .post('/loans')
      .set('x-member-id', String(member.id))
      .send({ memberId: member.id, bookId: book.body.id });
    expect(loan.status).toBe(201);

    const res = await request(app)
      .get(`/members/${member.id}/loans`)
      .set('x-member-id', String(librarian.id));

    expect(res.status).toBe(200);
    expect(res.body.some((l) => l.id === loan.body.id)).toBe(true);
  });

  it('rejects a different non-librarian member with 403', async () => {
    const member = makeMember();
    const otherMember = makeMember();

    const res = await request(app)
      .get(`/members/${member.id}/loans`)
      .set('x-member-id', String(otherMember.id));

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });
});
