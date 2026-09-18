const request = require('supertest');
const app = require('../src/app');
const { resetStore } = require('../src/services/bookService');

function validBookPayload(overrides = {}) {
  return {
    title: 'Clean Code',
    author: 'Robert C. Martin',
    isbn: '9780132350884',
    totalCopies: 5,
    ...overrides,
  };
}

describe('Book routes', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('POST /books', () => {
    it('creates a book and sets availableCopies to totalCopies', async () => {
      const res = await request(app).post('/books').send(validBookPayload());

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '9780132350884',
        totalCopies: 5,
        availableCopies: 5,
      });
      expect(res.body.id).toBeTruthy();
    });

    it('rejects missing required fields with 400', async () => {
      const res = await request(app)
        .post('/books')
        .send(validBookPayload({ title: undefined }));

      expect(res.status).toBe(400);
    });

    it('rejects an invalid totalCopies with 400', async () => {
      const res = await request(app)
        .post('/books')
        .send(validBookPayload({ totalCopies: 0 }));

      expect(res.status).toBe(400);
    });

    it('rejects a duplicate isbn with 409', async () => {
      await request(app).post('/books').send(validBookPayload());

      const res = await request(app)
        .post('/books')
        .send(validBookPayload({ title: 'Different Title' }));

      expect(res.status).toBe(409);
    });
  });

  describe('GET /books', () => {
    it('returns all created books', async () => {
      await request(app).post('/books').send(validBookPayload({ isbn: 'isbn-1' }));
      await request(app)
        .post('/books')
        .send(validBookPayload({ isbn: 'isbn-2', title: 'Second Book' }));

      const res = await request(app).get('/books');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('GET /books/:id', () => {
    it('returns the book when it exists', async () => {
      const created = await request(app).post('/books').send(validBookPayload());

      const res = await request(app).get(`/books/${created.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: created.body.id, title: 'Clean Code' });
    });

    it('returns 404 when the book does not exist', async () => {
      const res = await request(app).get('/books/does-not-exist');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /books/:id', () => {
    it('updates title, author, and totalCopies', async () => {
      const created = await request(app).post('/books').send(validBookPayload());

      const res = await request(app).patch(`/books/${created.body.id}`).send({
        title: 'Updated Title',
        author: 'Updated Author',
        totalCopies: 8,
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: created.body.id,
        title: 'Updated Title',
        author: 'Updated Author',
        totalCopies: 8,
        availableCopies: 8,
      });
    });

    it('returns 404 when updating a book that does not exist', async () => {
      const res = await request(app).patch('/books/does-not-exist').send({ title: 'X' });
      expect(res.status).toBe(404);
    });

    it('returns 400 when totalCopies is invalid', async () => {
      const created = await request(app).post('/books').send(validBookPayload());

      const res = await request(app)
        .patch(`/books/${created.body.id}`)
        .send({ totalCopies: -1 });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /books/:id', () => {
    it('deletes a book when no copies are on loan', async () => {
      const created = await request(app).post('/books').send(validBookPayload());

      const res = await request(app).delete(`/books/${created.body.id}`);
      expect(res.status).toBe(204);

      const getRes = await request(app).get(`/books/${created.body.id}`);
      expect(getRes.status).toBe(404);
    });

    it('returns 404 when deleting a book that does not exist', async () => {
      const res = await request(app).delete('/books/does-not-exist');
      expect(res.status).toBe(404);
    });
  });
});
