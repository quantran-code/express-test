const request = require('supertest');
const app = require('../src/app');
const bookService = require('../src/services/bookService');

function validBookPayload(overrides = {}) {
  return {
    title: 'Clean Code',
    author: 'Robert C. Martin',
    isbn: '9780132350884',
    totalCopies: 5,
    ...overrides,
  };
}

describe('POST /books', () => {
  it('creates a book with availableCopies === totalCopies', async () => {
    const res = await request(app).post('/books').send(validBookPayload());
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe('Clean Code');
    expect(res.body.author).toBe('Robert C. Martin');
    expect(res.body.isbn).toBe('9780132350884');
    expect(res.body.totalCopies).toBe(5);
    expect(res.body.availableCopies).toBe(5);
  });

  it('rejects a missing title with 400 and a Bad Request body', async () => {
    const payload = validBookPayload();
    delete payload.title;
    const res = await request(app).post('/books').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bad Request');
    expect(typeof res.body.message).toBe('string');
  });

  it('rejects a missing author with 400 and a Bad Request body', async () => {
    const payload = validBookPayload();
    delete payload.author;
    const res = await request(app).post('/books').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bad Request');
    expect(typeof res.body.message).toBe('string');
  });

  it('rejects a missing isbn with 400 and a Bad Request body', async () => {
    const payload = validBookPayload();
    delete payload.isbn;
    const res = await request(app).post('/books').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bad Request');
  });

  it('rejects a non-positive totalCopies with 400', async () => {
    const res = await request(app).post('/books').send(validBookPayload({ totalCopies: 0 }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bad Request');
  });

  it('rejects a duplicate isbn with 409 and a Conflict body', async () => {
    const payload = validBookPayload({ isbn: 'dup-isbn-1' });
    const first = await request(app).post('/books').send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post('/books').send(validBookPayload({ isbn: 'dup-isbn-1' }));
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('Conflict');
  });
});

describe('GET /books', () => {
  it('returns 200 with an array', async () => {
    await request(app).post('/books').send(validBookPayload({ isbn: 'list-isbn-1' }));
    const res = await request(app).get('/books');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /books/:id', () => {
  it('returns 200 for an existing id', async () => {
    const created = await request(app).post('/books').send(validBookPayload({ isbn: 'get-isbn-1' }));
    const res = await request(app).get(`/books/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  it('returns 404 with {error: "Not Found"} for a missing id', async () => {
    const res = await request(app).get('/books/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});

describe('PATCH /books/:id', () => {
  it('updates only the fields provided and recomputes availableCopies correctly', async () => {
    const created = await request(app).post('/books').send(validBookPayload({ isbn: 'patch-isbn-1', totalCopies: 5 }));
    const id = created.body.id;

    const res = await request(app).patch(`/books/${id}`).send({ totalCopies: 8 });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe(created.body.title);
    expect(res.body.author).toBe(created.body.author);
    expect(res.body.totalCopies).toBe(8);
    expect(res.body.availableCopies).toBe(8);
  });

  it('leaves availableCopies unchanged when totalCopies is omitted', async () => {
    const created = await request(app).post('/books').send(validBookPayload({ isbn: 'patch-isbn-2' }));
    const id = created.body.id;

    const res = await request(app).patch(`/books/${id}`).send({ title: 'New Title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Title');
    expect(res.body.availableCopies).toBe(created.body.availableCopies);
  });

  it('returns 404 with {error: "Not Found"} for a missing id', async () => {
    const res = await request(app).patch('/books/does-not-exist').send({ title: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });

  it('rejects a totalCopies update that would make availableCopies negative with 400', async () => {
    const created = await request(app).post('/books').send(validBookPayload({ isbn: 'patch-isbn-3', totalCopies: 5 }));
    const id = created.body.id;

    // simulate 4 copies on loan (availableCopies = 1) so that reducing totalCopies to 2
    // would require -2 availableCopies, which must be rejected.
    const book = bookService.getBookById(id);
    book.availableCopies = 1;

    const res = await request(app).patch(`/books/${id}`).send({ totalCopies: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bad Request');
  });
});

describe('DELETE /books/:id', () => {
  it('returns 204 when no copies are on loan', async () => {
    const created = await request(app).post('/books').send(validBookPayload({ isbn: 'delete-isbn-1' }));
    const id = created.body.id;

    const res = await request(app).delete(`/books/${id}`);
    expect(res.status).toBe(204);

    const getRes = await request(app).get(`/books/${id}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 409 with {error: "Conflict"} when copies are on loan', async () => {
    const created = await request(app).post('/books').send(validBookPayload({ isbn: 'delete-isbn-2' }));
    const id = created.body.id;

    const book = bookService.getBookById(id);
    book.availableCopies = created.body.totalCopies - 1;

    const res = await request(app).delete(`/books/${id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
  });

  it('returns 404 with {error: "Not Found"} for a missing id', async () => {
    const res = await request(app).delete('/books/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});
