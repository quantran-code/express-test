const request = require('supertest');
const app = require('../src/app');
const { getBookById } = require('../src/storage/books');

function validBookPayload(overrides = {}) {
  return {
    title: 'Clean Code',
    author: 'Robert C. Martin',
    isbn: `ISBN-${Math.random().toString(36).slice(2)}`,
    totalCopies: 3,
    ...overrides,
  };
}

describe('POST /books', () => {
  it('creates a book with valid data and sets availableCopies = totalCopies (201)', async () => {
    const payload = validBookPayload();
    const res = await request(app).post('/books').send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: payload.title,
      author: payload.author,
      isbn: payload.isbn,
      totalCopies: payload.totalCopies,
      availableCopies: payload.totalCopies,
    });
    expect(res.body.id).toBeDefined();
  });

  it('rejects missing title (400)', async () => {
    const payload = validBookPayload();
    delete payload.title;
    const res = await request(app).post('/books').send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects empty string author (400)', async () => {
    const payload = validBookPayload({ author: '   ' });
    const res = await request(app).post('/books').send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects missing isbn (400)', async () => {
    const payload = validBookPayload();
    delete payload.isbn;
    const res = await request(app).post('/books').send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects totalCopies provided as a string (400)', async () => {
    const payload = validBookPayload({ totalCopies: '3' });
    const res = await request(app).post('/books').send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects totalCopies of 0 (400)', async () => {
    const payload = validBookPayload({ totalCopies: 0 });
    const res = await request(app).post('/books').send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects negative totalCopies (400)', async () => {
    const payload = validBookPayload({ totalCopies: -2 });
    const res = await request(app).post('/books').send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects missing totalCopies (400)', async () => {
    const payload = validBookPayload();
    delete payload.totalCopies;
    const res = await request(app).post('/books').send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects duplicate isbn (409)', async () => {
    const payload = validBookPayload();
    const first = await request(app).post('/books').send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post('/books').send(validBookPayload({ isbn: payload.isbn }));
    expect(second.status).toBe(409);
    expect(second.body).toEqual({ error: 'ISBN already exists' });
  });
});

describe('GET /books', () => {
  it('returns 200 with an array of books', async () => {
    await request(app).post('/books').send(validBookPayload());

    const res = await request(app).get('/books');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('GET /books/:id', () => {
  it('returns 200 with the book for a known id', async () => {
    const created = await request(app).post('/books').send(validBookPayload());
    expect(created.status).toBe(201);

    const res = await request(app).get(`/books/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: created.body.id, title: created.body.title });
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/books/999999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Book not found' });
  });
});

describe('PATCH /books/:id', () => {
  it('updates title/author/totalCopies (200) and recomputes availableCopies', async () => {
    const created = await request(app).post('/books').send(validBookPayload({ totalCopies: 5 }));
    expect(created.status).toBe(201);

    const res = await request(app).patch(`/books/${created.body.id}`).send({
      title: 'Updated Title',
      author: 'Updated Author',
      totalCopies: 10,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.body.id,
      title: 'Updated Title',
      author: 'Updated Author',
      totalCopies: 10,
      availableCopies: 10,
    });
  });

  it('allows partial update of a single field', async () => {
    const created = await request(app).post('/books').send(validBookPayload());
    expect(created.status).toBe(201);

    const res = await request(app).patch(`/books/${created.body.id}`).send({ title: 'Only Title Changed' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Only Title Changed');
    expect(res.body.author).toBe(created.body.author);
  });

  it('ignores user-supplied availableCopies', async () => {
    const created = await request(app).post('/books').send(validBookPayload({ totalCopies: 4 }));
    expect(created.status).toBe(201);

    const res = await request(app).patch(`/books/${created.body.id}`).send({ availableCopies: 999 });
    expect(res.status).toBe(200);
    expect(res.body.availableCopies).toBe(4);
  });

  it('rejects invalid totalCopies type (400)', async () => {
    const created = await request(app).post('/books').send(validBookPayload());
    expect(created.status).toBe(201);

    const res = await request(app).patch(`/books/${created.body.id}`).send({ totalCopies: '5' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects totalCopies that would make availableCopies negative (400) when copies are on loan', async () => {
    const created = await request(app).post('/books').send(validBookPayload({ totalCopies: 5 }));
    expect(created.status).toBe(201);

    // Simulate 3 copies on loan by directly mutating the live stored record.
    const liveBook = getBookById(created.body.id);
    liveBook.availableCopies = 2; // onLoan = totalCopies(5) - availableCopies(2) = 3

    const res = await request(app).patch(`/books/${created.body.id}`).send({ totalCopies: 2 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects isbn collision with another existing book (409)', async () => {
    const first = await request(app).post('/books').send(validBookPayload());
    expect(first.status).toBe(201);
    const second = await request(app).post('/books').send(validBookPayload());
    expect(second.status).toBe(201);

    const res = await request(app).patch(`/books/${second.body.id}`).send({ isbn: first.body.isbn });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'ISBN already exists' });
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).patch('/books/999999').send({ title: 'X' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Book not found' });
  });
});

describe('DELETE /books/:id', () => {
  it('deletes a book with no copies on loan (204)', async () => {
    const created = await request(app).post('/books').send(validBookPayload());
    expect(created.status).toBe(201);

    const res = await request(app).delete(`/books/${created.body.id}`);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    const getRes = await request(app).get(`/books/${created.body.id}`);
    expect(getRes.status).toBe(404);
  });

  it('rejects deletion when copies are on loan (409)', async () => {
    const created = await request(app).post('/books').send(validBookPayload({ totalCopies: 3 }));
    expect(created.status).toBe(201);

    const liveBook = getBookById(created.body.id);
    liveBook.availableCopies = 1; // onLoan = 2

    const res = await request(app).delete(`/books/${created.body.id}`);
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/books/999999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Book not found' });
  });
});
