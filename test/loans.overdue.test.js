const request = require('supertest');
const app = require('../src/app');
const memberService = require('../src/services/memberService');

function makeMember(overrides = {}) {
  return memberService.createMember({
    name: 'Overdue Member',
    email: `overdue-member-${Date.now()}-${Math.random()}@example.com`,
    role: 'member',
    ...overrides,
  });
}

describe('GET /loans/overdue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns only active loans past dueDate; returned loans disappear', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    const member = makeMember();

    const book = await request(app).post('/books').send({
      title: 'Overdue Book',
      author: 'Author',
      isbn: 'ISBN-OVERDUE-1',
      totalCopies: 1,
    });
    expect(book.status).toBe(201);

    const loan = await request(app)
      .post('/loans')
      .set('x-member-id', String(member.id))
      .send({ memberId: member.id, bookId: book.body.id });
    expect(loan.status).toBe(201);
    expect(loan.body).toHaveProperty('dueDate');

    // Just created -> not overdue yet
    const before = await request(app)
      .get('/loans/overdue')
      .set('x-member-id', String(member.id));
    expect(before.status).toBe(200);
    expect(before.body.some((l) => l.id === loan.body.id)).toBe(false);

    // Advance past dueDate (14 days)
    const dueDateMs = new Date(loan.body.dueDate).getTime();
    vi.setSystemTime(new Date(dueDateMs + 1));

    const overdue = await request(app)
      .get('/loans/overdue')
      .set('x-member-id', String(member.id));
    expect(overdue.status).toBe(200);
    expect(overdue.body.some((l) => l.id === loan.body.id)).toBe(true);
    const overdueLoan = overdue.body.find((l) => l.id === loan.body.id);
    expect(overdueLoan.dueDate).toBe(loan.body.dueDate);

    // Return the loan -> no longer overdue
    const returned = await request(app)
      .patch(`/loans/${loan.body.id}/return`)
      .set('x-member-id', String(member.id));
    expect(returned.status).toBe(200);

    const afterReturn = await request(app)
      .get('/loans/overdue')
      .set('x-member-id', String(member.id));
    expect(afterReturn.status).toBe(200);
    expect(afterReturn.body.some((l) => l.id === loan.body.id)).toBe(false);
  });

  it('returns 401 when the x-member-id header is missing', async () => {
    const res = await request(app).get('/loans/overdue');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});
