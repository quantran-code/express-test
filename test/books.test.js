const request = require('supertest');
const app = require('../src/app');
const {
  createBook,
  getBookById,
  deleteBook,
} = require('../src/services/bookService');

describe('Book CRUD', () => {
  describe('POST /books', () => {
    it('creates a book (201) and sets availableCopies === totalCopies', async () => {
      const res = await request(app).post('/books').send({
        title: 'Test Title',
        author: 'Test Author',
        isbn: 'ISBN1',
        totalCopies: 3,
      });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: res.body.id,
        title: 'Test Title',
        author: 'Test Author',
        isbn: 'ISBN1',
        totalCopies: 3,
        availableCopies: 3,
        createdAt: res.body.createdAt,
        updatedAt: res.body.updatedAt,
      });

      expect(typeof res.body.id).toBe('string');
    });

    it('rejects missing/invalid title (400)', async () => {
      const res = await request(app).post('/books').send({
        author: 'Author',
        isbn: 'ISBN2',
        totalCopies: 1,
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: expect.any(String) });
    });

    it('rejects missing/invalid author (400)', async () => {
      const res = await request(app).post('/books').send({
        title: 'Title',
        isbn: 'ISBN3',
        totalCopies: 1,
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: expect.any(String) });
    });

    it('rejects missing/invalid isbn (400)', async () => {
      const res = await request(app).post('/books').send({
        title: 'Title',
        author: 'Author',
        totalCopies: 1,
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: expect.any(String) });
    });

    it('rejects missing/invalid totalCopies (400)', async () => {
      const res = await request(app).post('/books').send({
        title: 'Title',
        author: 'Author',
        isbn: 'ISBN4',
        totalCopies: 0,
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: expect.any(String) });
    });

    it('rejects duplicate isbn (409)', async () => {
      await request(app).post('/books').send({
        title: 'First',
        author: 'Author',
        isbn: 'DUPISBN',
        totalCopies: 2,
      });

      const res = await request(app).post('/books').send({
        title: 'Second',
        author: 'Author2',
        isbn: 'DUPISBN',
        totalCopies: 2,
      });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'isbn must be unique' });
    });
  });

  describe('GET /books', () => {
    it('lists all books (200)', async () => {
      await request(app).post('/books').send({
        title: 'List 1',
        author: 'Author 1',
        isbn: 'LIST1',
        totalCopies: 1,
      });
      await request(app).post('/books').send({
        title: 'List 2',
        author: 'Author 2',
        isbn: 'LIST2',
        totalCopies: 2,
      });

      const res = await request(app).get('/books');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /books/:id', () => {
    it('returns book by id (200)', async () => {
      const created = await request(app).post('/books').send({
        title: 'Single',
        author: 'Author',
        isbn: 'SINGLE1',
        totalCopies: 4,
      });
      expect(created.status).toBe(201);

      const res = await request(app).get(`/books/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);
      expect(res.body.title).toBe('Single');
      expect(res.body.availableCopies).toBe(4);
    });

    it('returns 404 with { error } when id is unknown', async () => {
      const res = await request(app).get('/books/does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Book not found' });
    });
  });

  describe('PATCH /books/:id', () => {
    it('supports partial updates and resets availableCopies when totalCopies changes (200)', async () => {
      const created = await request(app).post('/books').send({
        title: 'Patch Title',
        author: 'Patch Author',
        isbn: 'PATCH1',
        totalCopies: 5,
      });
      expect(created.status).toBe(201);

      const res1 = await request(app)
        .patch(`/books/${created.body.id}`)
        .send({ title: 'New Title' });
      expect(res1.status).toBe(200);
      expect(res1.body.title).toBe('New Title');
      expect(res1.body.author).toBe('Patch Author');
      expect(res1.body.availableCopies).toBe(5);

      const res2 = await request(app)
        .patch(`/books/${created.body.id}`)
        .send({ totalCopies: 2 });
      expect(res2.status).toBe(200);
      expect(res2.body.totalCopies).toBe(2);
      expect(res2.body.availableCopies).toBe(2);
    });

    it('rejects attempts to change isbn (400)', async () => {
      const created = await request(app).post('/books').send({
        title: 'Immutable ISBN',
        author: 'Author',
        isbn: 'IMMUTABLE1',
        totalCopies: 1,
      });

      const res = await request(app)
        .patch(`/books/${created.body.id}`)
        .send({ isbn: 'NEWISBN' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'isbn is immutable' });
    });

    it('rejects invalid title/author/totalCopies (400)', async () => {
      const created = await request(app).post('/books').send({
        title: 'Valid',
        author: 'Valid',
        isbn: 'PATCH2',
        totalCopies: 2,
      });

      const badTitle = await request(app)
        .patch(`/books/${created.body.id}`)
        .send({ title: '' });
      expect(badTitle.status).toBe(400);

      const badAuthor = await request(app)
        .patch(`/books/${created.body.id}`)
        .send({ author: '   ' });
      expect(badAuthor.status).toBe(400);

      const badCopies = await request(app)
        .patch(`/books/${created.body.id}`)
        .send({ totalCopies: -1 });
      expect(badCopies.status).toBe(400);
    });

    it('returns 404 with { error } when patching unknown id', async () => {
      const res = await request(app)
        .patch('/books/unknown')
        .send({ title: 'X' });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Book not found' });
    });
  });

  describe('DELETE /books/:id', () => {
    it('deletes (204) when no copies are on loan and returns 404 afterwards', async () => {
      const created = await request(app).post('/books').send({
        title: 'Delete OK',
        author: 'Author',
        isbn: 'DELOK1',
        totalCopies: 2,
      });

      const delRes = await request(app).delete(`/books/${created.body.id}`);
      expect(delRes.status).toBe(204);

      const getRes = await request(app).get(`/books/${created.body.id}`);
      expect(getRes.status).toBe(404);
      expect(getRes.body).toEqual({ error: 'Book not found' });
    });

    it('returns 404 with { error } when deleting unknown id', async () => {
      const res = await request(app).delete('/books/unknown');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Book not found' });
    });

    it('returns 409 when copies are on loan (guard verified via service-level mutation)', () => {
      const book = createBook({
        title: 'On Loan',
        author: 'Author',
        isbn: `ONLOAN-${Date.now()}`,
        totalCopies: 3,
      });

      // getBookById returns the live reference from the in-memory store
      const live = getBookById(book.id);
      expect(live.availableCopies).toBe(live.totalCopies);

      // Simulate loan state by making availableCopies < totalCopies
      live.availableCopies = 1;

      expect(() => deleteBook(book.id)).toThrow(/./);
      try {
        deleteBook(book.id);
      } catch (err) {
        expect(err.status).toBe(409);
        expect(err.message).toBe('Cannot delete a book while copies are on loan');
      }
    });
  });
});
