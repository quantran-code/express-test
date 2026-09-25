const request = require('supertest');
const app = require('../src/app');

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

async function makeMember() {
  const email = `overdue-member-${Date.now()}-${Math.random()}@example.com`;
  const registerRes = await request(app).post('/auth/register').send({
    name: 'Overdue Member',
    email,
    password: DEFAULT_PASSWORD,
  });
  const loginRes = await request(app).post('/auth/login').send({ email, password: DEFAULT_PASSWORD });
  return { id: registerRes.body.id, token: loginRes.body.token };
}

describe('GET /loans/overdue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns only active loans past dueDate; returned loans disappear', async () => {
    // Obtain tokens under the real clock first, since JWTs expire based on real
    // elapsed time and this test later advances the fake clock by 14 days.
    const librarianToken = await loginLibrarian();
    const member = await makeMember();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    const book = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Overdue Book',
        author: 'Author',
        isbn: 'ISBN-OVERDUE-1',
        totalCopies: 1,
      });
    expect(book.status).toBe(201);

    const loan = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ memberId: member.id, bookId: book.body.id });
    expect(loan.status).toBe(201);
    expect(loan.body).toHaveProperty('dueDate');

    // Just created -> not overdue yet
    const before = await request(app)
      .get('/loans/overdue')
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(before.status).toBe(200);
    expect(before.body.some((l) => l.id === loan.body.id)).toBe(false);

    // Advance past dueDate (14 days)
    const dueDateMs = new Date(loan.body.dueDate).getTime();
    vi.setSystemTime(new Date(dueDateMs + 1));

    const overdue = await request(app)
      .get('/loans/overdue')
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(overdue.status).toBe(200);
    expect(overdue.body.some((l) => l.id === loan.body.id)).toBe(true);
    const overdueLoan = overdue.body.find((l) => l.id === loan.body.id);
    expect(overdueLoan.dueDate).toBe(loan.body.dueDate);

    // Return the loan -> no longer overdue
    const returned = await request(app)
      .patch(`/loans/${loan.body.id}/return`)
      .set('Authorization', `Bearer ${member.token}`);
    expect(returned.status).toBe(200);

    const afterReturn = await request(app)
      .get('/loans/overdue')
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(afterReturn.status).toBe(200);
    expect(afterReturn.body.some((l) => l.id === loan.body.id)).toBe(false);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/loans/overdue');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 403 for a member token', async () => {
    const member = await makeMember();

    const res = await request(app)
      .get('/loans/overdue')
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });
});
