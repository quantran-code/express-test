const request = require('supertest');
const app = require('../src/app');
const bookService = require('../src/services/bookService');
const loanService = require('../src/services/loanService');

const LIBRARIAN_EMAIL = 'librarian@example.com';
const LIBRARIAN_PASSWORD = 'LibrarianPass123';
const DEFAULT_PASSWORD = 'MemberPass123';

async function loginLibrarian() {
  const res = await request(app).post('/auth/login').send({
    email: LIBRARIAN_EMAIL,
    password: LIBRARIAN_PASSWORD,
  });
  return res.body.token;
}

async function registerAndLoginMember(email) {
  const registerRes = await request(app).post('/auth/register').send({
    name: 'Test Member',
    email,
    password: DEFAULT_PASSWORD,
  });
  const loginRes = await request(app).post('/auth/login').send({ email, password: DEFAULT_PASSWORD });
  return { id: registerRes.body.id, token: loginRes.body.token };
}

async function makeMember() {
  return registerAndLoginMember(`member-${Date.now()}-${Math.random()}@example.com`);
}

let librarianToken;

async function createBookAsLibrarian(book) {
  return request(app).post('/books').set('Authorization', `Bearer ${librarianToken}`).send(book);
}

beforeAll(async () => {
  librarianToken = await loginLibrarian();
});

describe('POST /loans', () => {
  it('creates an active loan and decrements availableCopies, returning the id and dueDate', async () => {
    const member = await makeMember();
    const book = await createBookAsLibrarian({
      title: 'Loanable Book',
      author: 'Author',
      isbn: 'ISBN-LOAN-1',
      totalCopies: 3,
    });
    expect(book.status).toBe(201);

    const res = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ memberId: member.id, bookId: book.body.id });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(['dueDate', 'id']);
    expect(typeof res.body.id).toBe('number');

    const updatedBook = bookService.getBookById(book.body.id);
    expect(updatedBook.availableCopies).toBe(2);
  });

  it('sets dueDate to exactly 14 days after borrowedAt', async () => {
    const member = await makeMember();
    const book = await createBookAsLibrarian({
      title: 'Due Date Book',
      author: 'Author',
      isbn: 'ISBN-LOAN-DUEDATE',
      totalCopies: 1,
    });
    expect(book.status).toBe(201);

    const res = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${member.token}`)
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
    const member = await makeMember();
    const book = await createBookAsLibrarian({
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
      .set('Authorization', `Bearer ${member.token}`)
      .send({ memberId: member.id, bookId: book.body.id });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects a second active loan for the same member and book', async () => {
    const member = await makeMember();
    const book = await createBookAsLibrarian({
      title: 'Duplicate Loan Book',
      author: 'Author',
      isbn: 'ISBN-LOAN-DUP',
      totalCopies: 5,
    });
    expect(book.status).toBe(201);

    const first = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ memberId: member.id, bookId: book.body.id });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ memberId: member.id, bookId: book.body.id });

    expect(second.status).toBe(409);
    expect(second.body).toHaveProperty('error');
  });

  it('returns 404 for an unknown memberId when the caller is a librarian', async () => {
    const book = await createBookAsLibrarian({
      title: 'Unknown Member Book',
      author: 'Author',
      isbn: 'ISBN-LOAN-NOMEMBER',
      totalCopies: 2,
    });
    expect(book.status).toBe(201);

    const res = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ memberId: 'does-not-exist', bookId: book.body.id });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 404 for an unknown bookId', async () => {
    const member = await makeMember();

    const res = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ memberId: member.id, bookId: 'does-not-exist' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 when no token is provided', async () => {
    const book = await createBookAsLibrarian({
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

  it('rejects a member borrowing on behalf of a different memberId (403)', async () => {
    const member = await makeMember();
    const otherMember = await makeMember();
    const book = await createBookAsLibrarian({
      title: 'Impersonation Book',
      author: 'Author',
      isbn: 'ISBN-LOAN-IMPERSONATE',
      totalCopies: 2,
    });
    expect(book.status).toBe(201);

    const res = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ memberId: otherMember.id, bookId: book.body.id });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('allows a librarian to borrow a book on behalf of any member', async () => {
    const member = await makeMember();
    const book = await createBookAsLibrarian({
      title: 'Librarian Borrow Book',
      author: 'Author',
      isbn: 'ISBN-LOAN-LIBRARIAN',
      totalCopies: 2,
    });
    expect(book.status).toBe(201);

    const res = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ memberId: member.id, bookId: book.body.id });

    expect(res.status).toBe(201);
  });
});

describe('PATCH /loans/:id/return', () => {
  it('returns an active loan, sets it to returned, and increments availableCopies', async () => {
    const member = await makeMember();
    const book = await createBookAsLibrarian({
      title: 'Returnable Book',
      author: 'Author',
      isbn: 'ISBN-RETURN-1',
      totalCopies: 4,
    });
    expect(book.status).toBe(201);

    const loan = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ memberId: member.id, bookId: book.body.id });
    expect(loan.status).toBe(201);

    const beforeReturn = bookService.getBookById(book.body.id);
    expect(beforeReturn.availableCopies).toBe(3);

    const res = await request(app)
      .patch(`/loans/${loan.body.id}/return`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['id']);
    expect(res.body.id).toBe(loan.body.id);

    const afterReturn = bookService.getBookById(book.body.id);
    expect(afterReturn.availableCopies).toBe(4);
  });

  it('is idempotent for an already-returned loan (does not double-increment)', async () => {
    const member = await makeMember();
    const book = await createBookAsLibrarian({
      title: 'Idempotent Return Book',
      author: 'Author',
      isbn: 'ISBN-RETURN-IDEMPOTENT',
      totalCopies: 2,
    });
    expect(book.status).toBe(201);

    const loan = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ memberId: member.id, bookId: book.body.id });
    expect(loan.status).toBe(201);

    const firstReturn = await request(app)
      .patch(`/loans/${loan.body.id}/return`)
      .set('Authorization', `Bearer ${member.token}`);
    expect(firstReturn.status).toBe(200);

    const afterFirstReturn = bookService.getBookById(book.body.id);
    expect(afterFirstReturn.availableCopies).toBe(2);

    const secondReturn = await request(app)
      .patch(`/loans/${loan.body.id}/return`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(secondReturn.status).toBe(200);
    expect(secondReturn.body.id).toBe(loan.body.id);

    const afterSecondReturn = bookService.getBookById(book.body.id);
    expect(afterSecondReturn.availableCopies).toBe(2);
  });

  it('returns 404 for an unknown loan id', async () => {
    const member = await makeMember();

    const res = await request(app)
      .patch('/loans/does-not-exist/return')
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects a member returning another member\'s loan (403)', async () => {
    const member = await makeMember();
    const otherMember = await makeMember();
    const book = await createBookAsLibrarian({
      title: 'Return Impersonation Book',
      author: 'Author',
      isbn: 'ISBN-RETURN-IMPERSONATE',
      totalCopies: 2,
    });
    expect(book.status).toBe(201);

    const loan = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ memberId: member.id, bookId: book.body.id });
    expect(loan.status).toBe(201);

    const res = await request(app)
      .patch(`/loans/${loan.body.id}/return`)
      .set('Authorization', `Bearer ${otherMember.token}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('allows a librarian to return a loan on behalf of any member', async () => {
    const member = await makeMember();
    const book = await createBookAsLibrarian({
      title: 'Librarian Return Book',
      author: 'Author',
      isbn: 'ISBN-RETURN-LIBRARIAN',
      totalCopies: 2,
    });
    expect(book.status).toBe(201);

    const loan = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ memberId: member.id, bookId: book.body.id });
    expect(loan.status).toBe(201);

    const res = await request(app)
      .patch(`/loans/${loan.body.id}/return`)
      .set('Authorization', `Bearer ${librarianToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(loan.body.id);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).patch('/loans/1/return');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /members/:id/loans', () => {
  it('returns the loans for the same member', async () => {
    const member = await makeMember();
    const book = await createBookAsLibrarian({
      title: 'Member Loans Book',
      author: 'Author',
      isbn: 'ISBN-MEMBER-LOANS-1',
      totalCopies: 2,
    });
    expect(book.status).toBe(201);

    const loan = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ memberId: member.id, bookId: book.body.id });
    expect(loan.status).toBe(201);

    const res = await request(app)
      .get(`/members/${member.id}/loans`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((l) => l.id === loan.body.id)).toBe(true);
  });

  it('allows a librarian to view any member\'s loans', async () => {
    const member = await makeMember();
    const book = await createBookAsLibrarian({
      title: 'Librarian View Book',
      author: 'Author',
      isbn: 'ISBN-MEMBER-LOANS-2',
      totalCopies: 2,
    });
    expect(book.status).toBe(201);

    const loan = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ memberId: member.id, bookId: book.body.id });
    expect(loan.status).toBe(201);

    const res = await request(app)
      .get(`/members/${member.id}/loans`)
      .set('Authorization', `Bearer ${librarianToken}`);

    expect(res.status).toBe(200);
    expect(res.body.some((l) => l.id === loan.body.id)).toBe(true);
  });

  it('rejects a different non-librarian member with 403', async () => {
    const member = await makeMember();
    const otherMember = await makeMember();

    const res = await request(app)
      .get(`/members/${member.id}/loans`)
      .set('Authorization', `Bearer ${otherMember.token}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });
});
