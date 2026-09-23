const request = require('supertest');
const app = require('../src/app');
const { getBookById } = require('../src/services/bookService');

describe('Books API', () => {
  describe('POST /books', () => {
    it('creates a book with availableCopies === totalCopies', async () => {
      const res = await request(app).post('/books').send({
        title: 'Test Book',
        author: 'Test Author',
        isbn: 'TESTISBN',
        totalCopies: 5,
      });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Test Book');
      expect(res.body.author).toBe('Test Author');
      expect(res.body.isbn).toBe('TESTISBN');
      expect(res.body.totalCopies).toBe(5);
      expect(res.body.availableCopies).toBe(5);
    });

    it('rejects missing/invalid title/author/isbn/totalCopies with 400', async () => {
      const res1 = await request(app).post('/books').send({
        author: 'A',
        isbn: 'ISBN',
        totalCopies: 1,
      });
      expect(res1.status).toBe(400);

      const res2 = await request(app).post('/books').send({
        title: 'T',
        isbn: 'ISBN',
        totalCopies: 1,
      });
      expect(res2.status).toBe(400);

      const res3 = await request(app).post('/books').send({
        title: 'T',
        author: 'A',
        totalCopies: 1,
      });
      expect(res3.status).toBe(400);

      const res4 = await request(app).post('/books').send({
        title: 'T',
        author: 'A',
        isbn: 'ISBN',
        totalCopies: 0,
      });
      expect(res4.status).toBe(400);
    });

    it('rejects duplicate isbn values with 409', async () => {
      const first = await request(app).post('/books').send({
        title: 'First',
        author: 'A',
        isbn: 'DUPISBN',
        totalCopies: 2,
      });
      expect(first.status).toBe(201);

      const second = await request(app).post('/books').send({
        title: 'Second',
        author: 'B',
        isbn: 'DUPISBN',
        totalCopies: 3,
      });
      expect(second.status).toBe(409);
    });
  });

  describe('GET /books', () => {
    it('lists all books', async () => {
      await request(app).post('/books').send({
        title: 'List1',
        author: 'L1',
        isbn: 'LISTISBN1',
        totalCopies: 1,
      });

      const res = await request(app).get('/books');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /books/:id', () => {
    it('returns a book for an existing id and 404 for unknown id', async () => {
      const created = await request(app).post('/books').send({
        title: 'GetMe',
        author: 'G',
        isbn: 'GETISBN',
        totalCopies: 2,
      });
      expect(created.status).toBe(201);

      const getRes = await request(app).get(`/books/${created.body.id}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.id).toBe(created.body.id);

      const missingRes = await request(app).get('/books/unknown');
      expect(missingRes.status).toBe(404);
    });
  });

  describe('PATCH /books/:id', () => {
    it('updates title/author/totalCopies', async () => {
      const created = await request(app).post('/books').send({
        title: 'PatchMe',
        author: 'P',
        isbn: 'PATCHISBN',
        totalCopies: 4,
      });

      const res = await request(app).patch(`/books/${created.body.id}`).send({
        title: 'Patched Title',
        author: 'Patched Author',
        totalCopies: 3,
      });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Patched Title');
      expect(res.body.author).toBe('Patched Author');
      expect(res.body.totalCopies).toBe(3);
      expect(res.body.availableCopies).toBe(3);
    });

    it('rejects an update that would make availableCopies negative (400)', async () => {
      const created = await request(app).post('/books').send({
        title: 'Negative',
        author: 'N',
        isbn: 'NEGISBN',
        totalCopies: 2,
      });

      // Force an on-loan scenario by mutating the in-memory book.
      const live = getBookById(created.body.id);
      expect(live.availableCopies).toBe(2);
      live.availableCopies = 0; // all copies on loan

      const res = await request(app).patch(`/books/${created.body.id}`).send({
        totalCopies: 1,
      });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /books/:id', () => {
    it('returns 204 when no copies are on loan and 404 when missing', async () => {
      const created = await request(app).post('/books').send({
        title: 'Delete Success',
        author: 'Del',
        isbn: 'DELISBN',
        totalCopies: 2,
      });
      expect(created.status).toBe(201);

      const delRes = await request(app).delete(`/books/${created.body.id}`);
      expect(delRes.status).toBe(204);

      const getRes = await request(app).get(`/books/${created.body.id}`);
      expect(getRes.status).toBe(404);

      const missingRes = await request(app).delete('/books/unknown');
      expect(missingRes.status).toBe(404);
    });

    it('rejects deletion when copies are on loan (409) by simulating via direct mutation', async () => {
      const created = await request(app).post('/books').send({
        title: 'OnLoan',
        author: 'O',
        isbn: 'ONLOANISBN',
        totalCopies: 2,
      });
      expect(created.status).toBe(201);

      const live = getBookById(created.body.id);
      live.availableCopies = 1;

      const delRes = await request(app).delete(`/books/${created.body.id}`);
      expect(delRes.status).toBe(409);
    });
  });
});
