const request = require('supertest');
const { vi } = require('vitest');
const app = require('../src/app');

describe('Members and borrow/return flow', () => {
  describe('POST /members', () => {
    it('rejects missing required name', async () => {
      const res = await request(app).post('/members').send({ name: '' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: expect.any(String) });
    });

    it('creates a member', async () => {
      const name = `Member-${Date.now()}`;
      const res = await request(app).post('/members').send({ name });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: res.body.id, name });
    });
  });

  describe('GET /members', () => {
    it('lists created members', async () => {
      const name1 = `ListMember-${Date.now()}-1`;
      const name2 = `ListMember-${Date.now()}-2`;

      const m1 = await request(app).post('/members').send({ name: name1 });
      expect(m1.status).toBe(201);
      const m2 = await request(app).post('/members').send({ name: name2 });
      expect(m2.status).toBe(201);

      const res = await request(app).get('/members');
      expect(res.status).toBe(200);

      const names = res.body.map((m) => m.name);
      expect(names).toContain(name1);
      expect(names).toContain(name2);
    });
  });

  describe('GET /members/:id', () => {
    it('returns a member by id', async () => {
      const name = `SingleMember-${Date.now()}`;
      const create = await request(app).post('/members').send({ name });
      expect(create.status).toBe(201);

      const res = await request(app).get(`/members/${create.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(create.body);
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).get('/members/does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: expect.any(String) });
    });
  });

  describe('borrow/return flow', () => {
    it('happy path: borrow decrements book availableCopies and return increments', async () => {
      const bookCreate = await request(app).post('/books').send({
        title: 'Flow Book',
        author: 'Author',
        isbn: `flow-${Date.now()}-1`,
        totalCopies: 2,
      });
      expect(bookCreate.status).toBe(201);

      const memberCreate = await request(app).post('/members').send({
        name: `Flow Member-${Date.now()}`,
      });
      expect(memberCreate.status).toBe(201);

      const memberId = memberCreate.body.id;
      const bookId = bookCreate.body.id;

      const borrowRes = await request(app)
        .post(`/members/${memberId}/borrow`)
        .send({ bookId });
      expect(borrowRes.status).toBe(201);
      expect(borrowRes.body).toEqual({
        memberId,
        bookId,
        book: expect.objectContaining({
          id: bookId,
          title: 'Flow Book',
          totalCopies: 2,
          availableCopies: 1,
        }),
      });

      const afterBorrow = await request(app).get(`/books/${bookId}`);
      expect(afterBorrow.body.availableCopies).toBe(1);

      const returnRes = await request(app)
        .post(`/members/${memberId}/return`)
        .send({ bookId });
      expect(returnRes.status).toBe(200);
      expect(returnRes.body.book.availableCopies).toBe(2);

      const afterReturn = await request(app).get(`/books/${bookId}`);
      expect(afterReturn.body.availableCopies).toBe(2);
    });

    it('borrowing with insufficient copies returns 409', async () => {
      const bookCreate = await request(app).post('/books').send({
        title: 'No Copies Book',
        author: 'Author',
        isbn: `nocopies-${Date.now()}-1`,
        totalCopies: 1,
      });
      expect(bookCreate.status).toBe(201);

      const memberCreate = await request(app).post('/members').send({
        name: `No Copies Member-${Date.now()}`,
      });
      expect(memberCreate.status).toBe(201);

      const memberId = memberCreate.body.id;
      const bookId = bookCreate.body.id;

      // Borrow once (book now has 0 available)
      const firstBorrow = await request(app)
        .post(`/members/${memberId}/borrow`)
        .send({ bookId });
      expect(firstBorrow.status).toBe(201);

      // Borrow again via a different member to hit availableCopies guard
      const memberCreate2 = await request(app).post('/members').send({
        name: `No Copies Member2-${Date.now()}`,
      });
      expect(memberCreate2.status).toBe(201);

      const secondBorrow = await request(app)
        .post(`/members/${memberCreate2.body.id}/borrow`)
        .send({ bookId });

      expect(secondBorrow.status).toBe(409);
      expect(secondBorrow.body).toEqual({ error: expect.any(String) });
    });

    it('duplicate borrow by same member returns 409', async () => {
      const bookCreate = await request(app).post('/books').send({
        title: 'Dup Borrow Book',
        author: 'Author',
        isbn: `dupborrow-${Date.now()}-1`,
        totalCopies: 2,
      });
      expect(bookCreate.status).toBe(201);

      const memberCreate = await request(app).post('/members').send({
        name: `Dup Borrow Member-${Date.now()}`,
      });
      expect(memberCreate.status).toBe(201);

      const memberId = memberCreate.body.id;
      const bookId = bookCreate.body.id;

      const firstBorrow = await request(app)
        .post(`/members/${memberId}/borrow`)
        .send({ bookId });
      expect(firstBorrow.status).toBe(201);

      const secondBorrow = await request(app)
        .post(`/members/${memberId}/borrow`)
        .send({ bookId });

      expect(secondBorrow.status).toBe(409);
      expect(secondBorrow.body).toEqual({ error: expect.any(String) });
    });

    it('return without active loan returns 409', async () => {
      const bookCreate = await request(app).post('/books').send({
        title: 'Return Without Loan Book',
        author: 'Author',
        isbn: `returndelete-${Date.now()}-1`,
        totalCopies: 2,
      });
      expect(bookCreate.status).toBe(201);

      const memberCreate = await request(app).post('/members').send({
        name: `Return Member-${Date.now()}`,
      });
      expect(memberCreate.status).toBe(201);

      const res = await request(app)
        .post(`/members/${memberCreate.body.id}/return`)
        .send({ bookId: bookCreate.body.id });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: expect.any(String) });
    });

    it('double return returns 409', async () => {
      const bookCreate = await request(app).post('/books').send({
        title: 'Double Return Book',
        author: 'Author',
        isbn: `dreturn-${Date.now()}-1`,
        totalCopies: 1,
      });
      expect(bookCreate.status).toBe(201);

      const memberCreate = await request(app).post('/members').send({
        name: `Double Return Member-${Date.now()}`,
      });
      expect(memberCreate.status).toBe(201);

      const memberId = memberCreate.body.id;
      const bookId = bookCreate.body.id;

      const borrow = await request(app)
        .post(`/members/${memberId}/borrow`)
        .send({ bookId });
      expect(borrow.status).toBe(201);

      const ret1 = await request(app)
        .post(`/members/${memberId}/return`)
        .send({ bookId });
      expect(ret1.status).toBe(200);

      const ret2 = await request(app)
        .post(`/members/${memberId}/return`)
        .send({ bookId });
      expect(ret2.status).toBe(409);
      expect(ret2.body).toEqual({ error: expect.any(String) });
    });

    it('loan due dates are set to borrowedAt+14d and overdue is computed at request time', async () => {
      vi.useFakeTimers();
      const borrowedAt = new Date('2025-01-01T00:00:00.000Z');
      vi.setSystemTime(borrowedAt);

      const bookCreate = await request(app).post('/books').send({
        title: 'Due Date Book',
        author: 'Author',
        isbn: `duedate-${Date.now()}-1`,
        totalCopies: 1,
      });
      expect(bookCreate.status).toBe(201);

      const memberCreate = await request(app).post('/members').send({
        name: `Due Date Member-${Date.now()}`,
      });
      expect(memberCreate.status).toBe(201);

      const memberId = memberCreate.body.id;
      const bookId = bookCreate.body.id;

      const borrowRes = await request(app)
        .post(`/members/${memberId}/borrow`)
        .send({ bookId });
      expect(borrowRes.status).toBe(201);

      const loansRes1 = await request(app).get(`/members/${memberId}/loans`);
      expect(loansRes1.status).toBe(200);
      expect(loansRes1.body).toHaveLength(1);

      const loan = loansRes1.body[0];
      const expectedDue = new Date(borrowedAt.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
      expect(loan.borrowedAt).toBe(borrowedAt.toISOString());
      expect(loan.dueDate).toBe(expectedDue);

      vi.setSystemTime(new Date(expectedDue).getTime() - 1000);
      const overdueBefore = await request(app)
        .get(`/members/${memberId}/loans?overdue=true`);
      expect(overdueBefore.status).toBe(200);
      expect(overdueBefore.body).toEqual([]);

      vi.setSystemTime(new Date(expectedDue).getTime() + 1000);
      const overdueAfter = await request(app)
        .get(`/members/${memberId}/loans?overdue=true`);
      expect(overdueAfter.status).toBe(200);
      expect(overdueAfter.body).toHaveLength(1);
      expect(overdueAfter.body[0].bookId).toBe(bookId);

      vi.useRealTimers();
    });

    it('returned loans never appear in the loans listing or overdue listing', async () => {
      vi.useFakeTimers();
      const borrowedAt = new Date('2025-02-01T00:00:00.000Z');
      vi.setSystemTime(borrowedAt);

      const bookCreate = await request(app).post('/books').send({
        title: 'Returned Due Book',
        author: 'Author',
        isbn: `retduedate-${Date.now()}-1`,
        totalCopies: 1,
      });
      expect(bookCreate.status).toBe(201);

      const memberCreate = await request(app).post('/members').send({
        name: `Return Due Member-${Date.now()}`,
      });
      expect(memberCreate.status).toBe(201);

      const memberId = memberCreate.body.id;
      const bookId = bookCreate.body.id;

      await request(app)
        .post(`/members/${memberId}/borrow`)
        .send({ bookId });

      const returnRes = await request(app)
        .post(`/members/${memberId}/return`)
        .send({ bookId });
      expect(returnRes.status).toBe(200);

      const loansAfterReturn = await request(app).get(`/members/${memberId}/loans`);
      expect(loansAfterReturn.status).toBe(200);
      expect(loansAfterReturn.body).toEqual([]);

      const overdueAfterReturn = await request(app)
        .get(`/members/${memberId}/loans?overdue=true`);
      expect(overdueAfterReturn.status).toBe(200);
      expect(overdueAfterReturn.body).toEqual([]);

      vi.useRealTimers();
    });
  });
});
