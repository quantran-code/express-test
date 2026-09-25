const request = require('supertest');
const app = require('../src/app');
const bookService = require('../src/services/bookService');

describe('POST /books', () => {
  it('creates a book with valid data and sets availableCopies to totalCopies', async () => {
    const res = await request(app).post('/books').send({
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn: 'ISBN-CC-001',
      totalCopies: 5,
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn: 'ISBN-CC-001',
      totalCopies: 5,
      availableCopies: 5,
    });
    expect(typeof res.body.id).toBe('number');
  });

  it('rejects creation with missing title (400)', async () => {
    const res = await request(app).post('/books').send({
      author: 'Author Only',
      isbn: 'ISBN-MISSING-TITLE',
      totalCopies: 2,
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects creation with missing author (400)', async () => {
    const res = await request(app).post('/books').send({
      title: 'Title Only',
      isbn: 'ISBN-MISSING-AUTHOR',
      totalCopies: 2,
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects creation with missing isbn (400)', async () => {
    const res = await request(app).post('/books').send({
      title: 'Title',
      author: 'Author',
      totalCopies: 2,
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects creation with non-positive totalCopies (400)', async () => {
    const res = await request(app).post('/books').send({
      title: 'Title',
      author: 'Author',
      isbn: 'ISBN-NONPOSITIVE',
      totalCopies: 0,
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects creation with non-integer totalCopies (400)', async () => {
    const res = await request(app).post('/books').send({
      title: 'Title',
      author: 'Author',
      isbn: 'ISBN-NONINTEGER',
      totalCopies: 2.5,
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects creation with duplicate isbn (400)', async () => {
    const first = await request(app).post('/books').send({
      title: 'Original',
      author: 'Author',
      isbn: 'ISBN-DUPLICATE',
      totalCopies: 3,
    });
    expect(first.status).toBe(201);

    const dup = await request(app).post('/books').send({
      title: 'Duplicate',
      author: 'Author',
      isbn: 'ISBN-DUPLICATE',
      totalCopies: 1,
    });
    expect(dup.status).toBe(400);
    expect(dup.body).toHaveProperty('error');
  });
});

describe('GET /books', () => {
  it('returns all books in insertion order', async () => {
    const first = await request(app).post('/books').send({
      title: 'First Book',
      author: 'Author A',
      isbn: 'ISBN-ORDER-1',
      totalCopies: 1,
    });
    const second = await request(app).post('/books').send({
      title: 'Second Book',
      author: 'Author B',
      isbn: 'ISBN-ORDER-2',
      totalCopies: 1,
    });

    const res = await request(app).get('/books');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const firstIndex = res.body.findIndex((b) => b.id === first.body.id);
    const secondIndex = res.body.findIndex((b) => b.id === second.body.id);
    expect(firstIndex).toBeGreaterThanOrEqual(0);
    expect(secondIndex).toBeGreaterThan(firstIndex);
  });
});

describe('GET /books/:id', () => {
  it('returns the matching book when found', async () => {
    const created = await request(app).post('/books').send({
      title: 'Findable',
      author: 'Author',
      isbn: 'ISBN-FIND-1',
      totalCopies: 4,
    });
    expect(created.status).toBe(201);

    const res = await request(app).get(`/books/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.body.id,
      title: 'Findable',
      author: 'Author',
      isbn: 'ISBN-FIND-1',
      totalCopies: 4,
      availableCopies: 4,
    });
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/books/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('PATCH /books/:id', () => {
  it('updates title, author, and totalCopies', async () => {
    const created = await request(app).post('/books').send({
      title: 'Old Title',
      author: 'Old Author',
      isbn: 'ISBN-PATCH-1',
      totalCopies: 5,
    });
    expect(created.status).toBe(201);

    const res = await request(app).patch(`/books/${created.body.id}`).send({
      title: 'New Title',
      author: 'New Author',
      totalCopies: 8,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.body.id,
      title: 'New Title',
      author: 'New Author',
      totalCopies: 8,
      availableCopies: 8,
    });
  });

  it('ignores a user-supplied availableCopies value', async () => {
    const created = await request(app).post('/books').send({
      title: 'Ignore AC',
      author: 'Author',
      isbn: 'ISBN-PATCH-IGNORE-AC',
      totalCopies: 6,
    });
    expect(created.status).toBe(201);

    const res = await request(app).patch(`/books/${created.body.id}`).send({
      availableCopies: 999,
    });

    expect(res.status).toBe(200);
    expect(res.body.availableCopies).toBe(6);
    expect(res.body.availableCopies).not.toBe(999);
  });

  it('leaves fields unchanged when not present in the payload', async () => {
    const created = await request(app).post('/books').send({
      title: 'Partial Update',
      author: 'Author',
      isbn: 'ISBN-PATCH-PARTIAL',
      totalCopies: 3,
    });
    expect(created.status).toBe(201);

    const res = await request(app).patch(`/books/${created.body.id}`).send({
      title: 'Only Title Changed',
    });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Only Title Changed');
    expect(res.body.author).toBe('Author');
    expect(res.body.totalCopies).toBe(3);
  });

  it('rejects an empty title (400)', async () => {
    const created = await request(app).post('/books').send({
      title: 'Valid Title',
      author: 'Author',
      isbn: 'ISBN-PATCH-EMPTY-TITLE',
      totalCopies: 3,
    });
    expect(created.status).toBe(201);

    const res = await request(app).patch(`/books/${created.body.id}`).send({
      title: '',
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects a non-positive totalCopies (400)', async () => {
    const created = await request(app).post('/books').send({
      title: 'Valid Title',
      author: 'Author',
      isbn: 'ISBN-PATCH-NONPOSITIVE',
      totalCopies: 3,
    });
    expect(created.status).toBe(201);

    const res = await request(app).patch(`/books/${created.body.id}`).send({
      totalCopies: 0,
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects an update that would make availableCopies negative', async () => {
    const created = await request(app).post('/books').send({
      title: 'Loan Setup',
      author: 'Author',
      isbn: 'ISBN-PATCH-NEGATIVE',
      totalCopies: 5,
    });
    expect(created.status).toBe(201);

    // Simulate 3 copies on loan by reducing availableCopies directly on the stored
    // record (there is no borrow/return flow yet to produce this state through the API).
    const stored = bookService.getBookById(created.body.id);
    stored.availableCopies = 2; // onLoan = totalCopies(5) - availableCopies(2) = 3

    const res = await request(app).patch(`/books/${created.body.id}`).send({
      totalCopies: 2, // newAvailable = 2 - 3 = -1, must be rejected
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).patch('/books/does-not-exist').send({
      title: 'Whatever',
    });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('DELETE /books/:id', () => {
  it('deletes a book with no copies on loan (204)', async () => {
    const created = await request(app).post('/books').send({
      title: 'Deletable',
      author: 'Author',
      isbn: 'ISBN-DELETE-1',
      totalCopies: 2,
    });
    expect(created.status).toBe(201);

    const res = await request(app).delete(`/books/${created.body.id}`);
    expect(res.status).toBe(204);

    const getRes = await request(app).get(`/books/${created.body.id}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/books/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects deletion when copies are on loan (409)', async () => {
    const created = await request(app).post('/books').send({
      title: 'On Loan',
      author: 'Author',
      isbn: 'ISBN-DELETE-ONLOAN',
      totalCopies: 4,
    });
    expect(created.status).toBe(201);

    // Simulate 2 copies on loan (no borrow/return flow exists yet to produce this via the API).
    const stored = bookService.getBookById(created.body.id);
    stored.availableCopies = 2;

    const res = await request(app).delete(`/books/${created.body.id}`);
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });
});
