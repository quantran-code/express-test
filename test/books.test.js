const request = require('supertest');
const app = require('../src/app');

const { getBookById } = require('../src/services/bookService');

describe('POST /books', () => {
  it('creates a book (201) and sets availableCopies = totalCopies', async () => {
    const res = await request(app).post('/books').send({
      title: 'My Book',
      author: 'Author',
      isbn: 'ISBN-1',
      totalCopies: 3,
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: res.body.id,
      title: 'My Book',
      author: 'Author',
      isbn: 'ISBN-1',
      totalCopies: 3,
      availableCopies: 3,
      createdAt: res.body.createdAt,
      updatedAt: res.body.updatedAt,
    });
  });

  it('rejects invalid title/author/isbn/totalCopies (400)', async () => {
    const res = await request(app).post('/books').send({
      title: '',
      author: 'Author',
      isbn: 'ISBN-2',
      totalCopies: 3,
    });
    expect(res.status).toBe(400);

    const res2 = await request(app).post('/books').send({
      title: 'Title',
      author: '  ',
      isbn: 'ISBN-3',
      totalCopies: 3,
    });
    expect(res2.status).toBe(400);

    const res3 = await request(app).post('/books').send({
      title: 'Title',
      author: 'Author',
      isbn: ' ',
      totalCopies: 3,
    });
    expect(res3.status).toBe(400);

    const res4 = await request(app).post('/books').send({
      title: 'Title',
      author: 'Author',
      isbn: 'ISBN-4',
      totalCopies: 0,
    });
    expect(res4.status).toBe(400);
  });

  it('rejects duplicate isbn (409 { error: "Duplicate isbn" })', async () => {
    await request(app).post('/books').send({
      title: 'A',
      author: 'B',
      isbn: 'DUPLICATE',
      totalCopies: 1,
    });

    const res = await request(app).post('/books').send({
      title: 'C',
      author: 'D',
      isbn: 'DUPLICATE',
      totalCopies: 1,
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Duplicate isbn' });
  });

  it('smoke: POST /books responds', async () => {
    const res = await request(app).post('/books').send({
      title: 'Smoke',
      author: 'Smoke',
      isbn: 'SMOKE-POST',
      totalCopies: 1,
    });
    expect([201, 409, 400]).toContain(res.status);
  });
});

describe('GET /books', () => {
  it('lists all books (200)', async () => {
    const res = await request(app).get('/books');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('smoke: GET /books responds', async () => {
    const res = await request(app).get('/books');
    expect(res.status).toBe(200);
  });
});

describe('GET /books/:id', () => {
  it('returns 200 for existing id and 404 { error: "Book not found" } for unknown id', async () => {
    const created = await request(app).post('/books').send({
      title: 'Fetch',
      author: 'Me',
      isbn: 'FETCH-1',
      totalCopies: 2,
    });
    expect(created.status).toBe(201);

    const getRes = await request(app).get(`/books/${created.body.id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(created.body.id);

    const missingRes = await request(app).get('/books/unknown');
    expect(missingRes.status).toBe(404);
    expect(missingRes.body).toEqual({ error: 'Book not found' });
  });

  it('smoke: GET /books/:id responds', async () => {
    const created = await request(app).post('/books').send({
      title: 'SmokeId',
      author: 'Smoke',
      isbn: 'SMOKE-ID',
      totalCopies: 1,
    });
    const res = await request(app).get(`/books/${created.body.id}`);
    expect(res.status).toBe(200);
  });
});

describe('PATCH /books/:id', () => {
  it('allows partial updates of title/author/totalCopies (200)', async () => {
    const created = await request(app).post('/books').send({
      title: 'Patch',
      author: 'Author',
      isbn: 'PATCH-1',
      totalCopies: 5,
    });
    expect(created.status).toBe(201);

    const res1 = await request(app).patch(`/books/${created.body.id}`).send({ title: 'New Title' });
    expect(res1.status).toBe(200);
    expect(res1.body.title).toBe('New Title');

    const res2 = await request(app).patch(`/books/${created.body.id}`).send({ author: 'New Author' });
    expect(res2.status).toBe(200);
    expect(res2.body.author).toBe('New Author');

    const res3 = await request(app).patch(`/books/${created.body.id}`).send({ totalCopies: 3 });
    expect(res3.status).toBe(200);
    expect(res3.body.totalCopies).toBe(3);
    expect(res3.body.availableCopies).toBe(3);
  });

  it('rejects invalid fields (400)', async () => {
    const created = await request(app).post('/books').send({
      title: 'Invalid',
      author: 'Author',
      isbn: 'PATCH-INV',
      totalCopies: 2,
    });

    const res = await request(app).patch(`/books/${created.body.id}`).send({ title: '' });
    expect(res.status).toBe(400);

    const res2 = await request(app).patch(`/books/${created.body.id}`).send({ totalCopies: 0 });
    expect(res2.status).toBe(400);
  });

  it('rejects totalCopies that would make availableCopies negative (400 with exact message)', async () => {
    const created = await request(app).post('/books').send({
      title: 'OnLoanState',
      author: 'Author',
      isbn: 'PATCH-ONLOAN',
      totalCopies: 5,
    });

    // Drive on-loan state by mutating the live in-memory book object.
    const live = getBookById(created.body.id);
    live.availableCopies = 2; // onLoan = 5 - 2 = 3

    const res = await request(app).patch(`/books/${created.body.id}`).send({ totalCopies: 2 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'totalCopies cannot be less than the number of copies currently on loan',
    });
  });

  it('smoke: PATCH /books/:id responds', async () => {
    const created = await request(app).post('/books').send({
      title: 'SmokePatch',
      author: 'Smoke',
      isbn: 'SMOKE-PATCH',
      totalCopies: 1,
    });

    const res = await request(app).patch(`/books/${created.body.id}`).send({ title: 'x' });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /books/:id', () => {
  it('returns 204 when no copies are on loan and 404 when missing', async () => {
    const created = await request(app).post('/books').send({
      title: 'Delete',
      author: 'Del',
      isbn: 'DEL-1',
      totalCopies: 2,
    });
    expect(created.status).toBe(201);

    const delRes = await request(app).delete(`/books/${created.body.id}`);
    expect(delRes.status).toBe(204);
    expect(delRes.text).toBe('');

    const getRes = await request(app).get(`/books/${created.body.id}`);
    expect(getRes.status).toBe(404);
    expect(getRes.body).toEqual({ error: 'Book not found' });

    const missingRes = await request(app).delete('/books/unknown');
    expect(missingRes.status).toBe(404);
    expect(missingRes.body).toEqual({ error: 'Book not found' });
  });

  it('rejects deletion when copies are on loan (409 { error: "Cannot delete a book while copies are on loan" })', async () => {
    const created = await request(app).post('/books').send({
      title: 'OnLoanDelete',
      author: 'O',
      isbn: 'DEL-ONLOAN',
      totalCopies: 2,
    });

    const live = getBookById(created.body.id);
    live.availableCopies = 1; // onLoan > 0

    const delRes = await request(app).delete(`/books/${created.body.id}`);
    expect(delRes.status).toBe(409);
    expect(delRes.body).toEqual({ error: 'Cannot delete a book while copies are on loan' });
  });

  it('smoke: DELETE /books/:id responds', async () => {
    const created = await request(app).post('/books').send({
      title: 'SmokeDelete',
      author: 'Smoke',
      isbn: 'SMOKE-DELETE',
      totalCopies: 1,
    });

    const res = await request(app).delete(`/books/${created.body.id}`);
    expect(res.status).toBe(204);
  });
});
