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
  const email = `reports-member-${Date.now()}-${Math.random()}@example.com`;
  const registerRes = await request(app).post('/auth/register').send({
    name: 'Reports Member',
    email,
    password: DEFAULT_PASSWORD,
  });
  const loginRes = await request(app).post('/auth/login').send({ email, password: DEFAULT_PASSWORD });
  return { id: registerRes.body.id, token: loginRes.body.token };
}

describe('GET /reports/most-borrowed', () => {
  it('returns books ranked from most to least borrowed with total borrow counts', async () => {
    const librarianToken = await loginLibrarian();
    const member = await makeMember();

    const popularBook = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Popular Book',
        author: 'Author',
        isbn: 'ISBN-REPORT-POPULAR',
        totalCopies: 5,
      });
    expect(popularBook.status).toBe(201);

    const unpopularBook = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Unpopular Book',
        author: 'Author',
        isbn: 'ISBN-REPORT-UNPOPULAR',
        totalCopies: 5,
      });
    expect(unpopularBook.status).toBe(201);

    // Borrow and return the popular book twice to accumulate 2 total borrows.
    const loan1 = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ memberId: member.id, bookId: popularBook.body.id });
    expect(loan1.status).toBe(201);
    const return1 = await request(app)
      .patch(`/loans/${loan1.body.id}/return`)
      .set('Authorization', `Bearer ${member.token}`);
    expect(return1.status).toBe(200);

    const loan2 = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ memberId: member.id, bookId: popularBook.body.id });
    expect(loan2.status).toBe(201);

    const loan3 = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ memberId: member.id, bookId: unpopularBook.body.id });
    expect(loan3.status).toBe(201);

    const res = await request(app)
      .get('/reports/most-borrowed')
      .set('Authorization', `Bearer ${librarianToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const popularEntry = res.body.find((entry) => entry.bookId === popularBook.body.id);
    const unpopularEntry = res.body.find((entry) => entry.bookId === unpopularBook.body.id);
    expect(popularEntry).toBeDefined();
    expect(unpopularEntry).toBeDefined();
    expect(popularEntry.totalBorrowCount).toBe(2);
    expect(unpopularEntry.totalBorrowCount).toBe(1);

    const popularIndex = res.body.indexOf(popularEntry);
    const unpopularIndex = res.body.indexOf(unpopularEntry);
    expect(popularIndex).toBeLessThan(unpopularIndex);
  });

  it('returns 403 for a member token', async () => {
    const member = await makeMember();

    const res = await request(app)
      .get('/reports/most-borrowed')
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/reports/most-borrowed');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /reports/overdue-summary', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns per-member overdue counts for currently overdue loans', async () => {
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
        title: 'Overdue Summary Book',
        author: 'Author',
        isbn: 'ISBN-REPORT-OVERDUE',
        totalCopies: 1,
      });
    expect(book.status).toBe(201);

    const loan = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ memberId: member.id, bookId: book.body.id });
    expect(loan.status).toBe(201);

    const dueDateMs = new Date(loan.body.dueDate).getTime();
    vi.setSystemTime(new Date(dueDateMs + 1));

    const res = await request(app)
      .get('/reports/overdue-summary')
      .set('Authorization', `Bearer ${librarianToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const memberEntry = res.body.find((entry) => entry.memberId === member.id);
    expect(memberEntry).toBeDefined();
    expect(memberEntry.overdueCount).toBe(1);
  });

  it('returns 403 for a member token', async () => {
    const member = await makeMember();

    const res = await request(app)
      .get('/reports/overdue-summary')
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/reports/overdue-summary');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});
