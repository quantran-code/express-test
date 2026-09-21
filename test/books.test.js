const request = require('supertest');
const app = require('../src/app');

describe('Book catalog API', () => {
  describe('POST /books', () => {
    it('creates a book with availableCopies === totalCopies (201)', async () => {
      const res = await request(app).post('/books').send({
        title: 'A Title',
        author: 'An Author',
        isbn: 'ISBN-1',
        totalCopies: 3,
      });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('A Title');
      expect(res.body.author).toBe('An Author');
      expect(res.body.isbn).toBe('ISBN-1');
      expect(res.body.totalCopies).toBe(3);
      expect(res.body.availableCopies).toBe(3);
    });

    it('rejects missing/empty title (400)', async () => {
      const res = await request(app).post('/books').send({
        author: 'An Author',
        isbn: 'ISBN-TITLE',
        totalCopies: 2,
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'title, author, and isbn are required non-empty strings' });

      const res2 = await request(app).post('/books').send({
        title: '   ',
        author: 'An Author',
        isbn: 'ISBN-TITLE2',
        totalCopies: 2,
      });
      expect(res2.status).toBe(400);
      expect(res2.body).toEqual({ error: 'title, author, and isbn are required non-empty strings' });
    });

    it('rejects missing/empty author (400)', async () => {
      const res = await request(app).post('/books').send({
        title: 'A Title',
        isbn: 'ISBN-AUTH',
        totalCopies: 2,
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'title, author, and isbn are required non-empty strings' });

      const res2 = await request(app).post('/books').send({
        title: 'A Title',
        author: '   ',
        isbn: 'ISBN-AUTH2',
        totalCopies: 2,
      });
      expect(res2.status).toBe(400);
      expect(res2.body).toEqual({ error: 'title, author, and isbn are required non-empty strings' });
    });

    it('rejects missing/empty isbn (400)', async () => {
      const res = await request(app).post('/books').send({
        title: 'A Title',
        author: 'An Author',
        totalCopies: 2,
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'title, author, and isbn are required non-empty strings' });

      const res2 = await request(app).post('/books').send({
        title: 'A Title',
        author: 'An Author',
        isbn: '   ',
        totalCopies: 2,
      });
      expect(res2.status).toBe(400);
      expect(res2.body).toEqual({ error: 'title, author, and isbn are required non-empty strings' });
    });

    it('rejects missing totalCopies (400)', async () => {
      const res = await request(app).post('/books').send({
        title: 'A Title',
        author: 'An Author',
        isbn: 'ISBN-TC1',
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'totalCopies is required and must be an integer greater than 0' });
    });

    it('rejects totalCopies=0, negative, non-integer, and numeric string (400)', async () => {
      const base = {
        title: 'A Title',
        author: 'An Author',
        isbn: 'ISBN-TC',
      };

      const res0 = await request(app).post('/books').send({ ...base, isbn: 'ISBN-TC0', totalCopies: 0 });
      expect(res0.status).toBe(400);
      expect(res0.body).toEqual({ error: 'totalCopies is required and must be an integer greater than 0' });

      const resNeg = await request(app).post('/books').send({ ...base, isbn: 'ISBN-TCNEG', totalCopies: -1 });
      expect(resNeg.status).toBe(400);
      expect(resNeg.body).toEqual({ error: 'totalCopies is required and must be an integer greater than 0' });

      const resFloat = await request(app).post('/books').send({ ...base, isbn: 'ISBN-TCFLOAT', totalCopies: 1.5 });
      expect(resFloat.status).toBe(400);
      expect(resFloat.body).toEqual({ error: 'totalCopies is required and must be an integer greater than 0' });

      const resNumericString = await request(app).post('/books').send({
        ...base,
        isbn: 'ISBN-TCNSTR',
        totalCopies: '3',
      });
      expect(resNumericString.status).toBe(400);
      expect(resNumericString.body).toEqual({ error: 'totalCopies is required and must be an integer greater than 0' });
    });

    it('rejects duplicate isbn (409)', async () => {
      const res1 = await request(app).post('/books').send({
        title: 'Book D',
        author: 'Author D',
        isbn: 'DUPISBN',
        totalCopies: 2,
      });
      expect(res1.status).toBe(201);

      const res2 = await request(app).post('/books').send({
        title: 'Book E',
        author: 'Author E',
        isbn: 'DUPISBN',
        totalCopies: 2,
      });
      expect(res2.status).toBe(409);
      expect(res2.body).toEqual({ error: 'A book with isbn "DUPISBN" already exists' });
    });
  });

  describe('GET /books', () => {
    it('returns 200 with an array (including [] when empty)', async () => {
      const res = await request(app).get('/books');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /books/:id', () => {
    it('returns 200 for existing id and 404 for unknown id', async () => {
      const created = await request(app).post('/books').send({
        title: 'Id Book',
        author: 'Id Author',
        isbn: 'IDISBN',
        totalCopies: 3,
      });
      expect(created.status).toBe(201);

      const res1 = await request(app).get(`/books/${created.body.id}`);
      expect(res1.status).toBe(200);
      expect(res1.body.id).toBe(created.body.id);

      const res2 = await request(app).get('/books/does-not-exist');
      expect(res2.status).toBe(404);
      expect(res2.body).toEqual({ error: 'Book not found' });
    });
  });

  describe('PATCH /books/:id', () => {
    it('updates title/author/totalCopies and recomputes availableCopies (200)', async () => {
      const created = await request(app).post('/books').send({
        title: 'Update Book',
        author: 'Update Author',
        isbn: 'UPDISBN',
        totalCopies: 4,
      });
      expect(created.status).toBe(201);

      const res1 = await request(app).patch(`/books/${created.body.id}`).send({ title: 'Updated Title' });
      expect(res1.status).toBe(200);
      expect(res1.body.title).toBe('Updated Title');

      // With no loan flow, onLoan starts at 0, so reducing totalCopies reduces availableCopies equivalently.
      const res2 = await request(app).patch(`/books/${created.body.id}`).send({ totalCopies: 2 });
      expect(res2.status).toBe(200);
      expect(res2.body.totalCopies).toBe(2);
      expect(res2.body.availableCopies).toBe(2);
    });

    it('ignores availableCopies field in request (does not let the client set it)', async () => {
      const created = await request(app).post('/books').send({
        title: 'Ignore',
        author: 'Copies',
        isbn: 'IGNORISBN',
        totalCopies: 5,
      });
      expect(created.status).toBe(201);

      const res = await request(app)
        .patch(`/books/${created.body.id}`)
        .send({ totalCopies: 3, availableCopies: 999 });

      expect(res.status).toBe(200);
      expect(res.body.totalCopies).toBe(3);
      expect(res.body.availableCopies).toBe(3); // recomputed, not client-provided
    });

    it('rejects unknown id with 404 (Book not found)', async () => {
      const res = await request(app).patch('/books/unknown').send({ title: 'X' });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Book not found' });
    });

    it('rejects invalid fields (400)', async () => {
      const created = await request(app).post('/books').send({
        title: 'Valid',
        author: 'Valid',
        isbn: 'VALIDISBN',
        totalCopies: 2,
      });
      expect(created.status).toBe(201);

      const res1 = await request(app).patch(`/books/${created.body.id}`).send({ title: '  ' });
      expect(res1.status).toBe(400);
      expect(res1.body).toEqual({ error: 'title must be a non-empty string' });

      const res2 = await request(app).patch(`/books/${created.body.id}`).send({ author: '' });
      expect(res2.status).toBe(400);
      expect(res2.body).toEqual({ error: 'author must be a non-empty string' });

      const res3 = await request(app).patch(`/books/${created.body.id}`).send({ totalCopies: '3' });
      expect(res3.status).toBe(400);
      expect(res3.body).toEqual({ error: 'totalCopies must be an integer greater than 0' });
    });
  });

  describe('DELETE /books/:id', () => {
    it('returns 204 when no copies are on loan and 404 otherwise', async () => {
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
      expect(getRes.body).toEqual({ error: 'Book not found' });
    });

    it('DELETE /books/:id returns 404 for unknown id', async () => {
      const deleteRes = await request(app).delete('/books/unknown');
      expect(deleteRes.status).toBe(404);
      expect(deleteRes.body).toEqual({ error: 'Book not found' });
    });
  });
});
