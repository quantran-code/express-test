const request = require('supertest');
const app = require('../src/app');
const bookService = require('../src/services/bookService');

const LIBRARIAN_EMAIL = 'librarian@example.com';
const LIBRARIAN_PASSWORD = 'LibrarianPass123';

let librarianToken;
let memberToken;

async function loginLibrarian() {
  const res = await request(app).post('/auth/login').send({
    email: LIBRARIAN_EMAIL,
    password: LIBRARIAN_PASSWORD,
  });
  return res.body.token;
}

async function registerAndLoginMember(email) {
  const password = 'MemberPass123';
  await request(app).post('/auth/register').send({
    name: 'Test Member',
    email,
    password,
  });
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token;
}

beforeAll(async () => {
  librarianToken = await loginLibrarian();
  memberToken = await registerAndLoginMember(`books-member-${Date.now()}-${Math.random()}@example.com`);
});

describe('POST /books', () => {
  it('creates a book with valid data and sets availableCopies to totalCopies', async () => {
    const res = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
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
    const res = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        author: 'Author Only',
        isbn: 'ISBN-MISSING-TITLE',
        totalCopies: 2,
      });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects creation with missing author (400)', async () => {
    const res = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Title Only',
        isbn: 'ISBN-MISSING-AUTHOR',
        totalCopies: 2,
      });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects creation with missing isbn (400)', async () => {
    const res = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Title',
        author: 'Author',
        totalCopies: 2,
      });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects creation with non-positive totalCopies (400)', async () => {
    const res = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Title',
        author: 'Author',
        isbn: 'ISBN-NONPOSITIVE',
        totalCopies: 0,
      });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects creation with non-integer totalCopies (400)', async () => {
    const res = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Title',
        author: 'Author',
        isbn: 'ISBN-NONINTEGER',
        totalCopies: 2.5,
      });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects creation with duplicate isbn (400)', async () => {
    const first = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Original',
        author: 'Author',
        isbn: 'ISBN-DUPLICATE',
        totalCopies: 3,
      });
    expect(first.status).toBe(201);

    const dup = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Duplicate',
        author: 'Author',
        isbn: 'ISBN-DUPLICATE',
        totalCopies: 1,
      });
    expect(dup.status).toBe(400);
    expect(dup.body).toHaveProperty('error');
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).post('/books').send({
      title: 'No Auth',
      author: 'Author',
      isbn: 'ISBN-NOAUTH',
      totalCopies: 1,
    });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 403 for an authenticated member (non-librarian)', async () => {
    const res = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Member Attempt',
        author: 'Author',
        isbn: 'ISBN-MEMBER-ATTEMPT',
        totalCopies: 1,
      });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /books', () => {
  it('returns all books in insertion order', async () => {
    const first = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'First Book',
        author: 'Author A',
        isbn: 'ISBN-ORDER-1',
        totalCopies: 1,
      });
    const second = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Second Book',
        author: 'Author B',
        isbn: 'ISBN-ORDER-2',
        totalCopies: 1,
      });

    const res = await request(app)
      .get('/books')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toMatchObject({ page: 1, pageSize: 10 });
    expect(typeof res.body.total).toBe('number');

    const firstIndex = res.body.data.findIndex((b) => b.id === first.body.id);
    const secondIndex = res.body.data.findIndex((b) => b.id === second.body.id);
    expect(firstIndex).toBeGreaterThanOrEqual(0);
    expect(secondIndex).toBeGreaterThan(firstIndex);
  });

  it('searches books by title case-insensitively', async () => {
    const created = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: 'ISBN-SEARCH-TITLE',
        totalCopies: 2,
      });
    expect(created.status).toBe(201);

    const res = await request(app)
      .get('/books')
      .set('Authorization', `Bearer ${memberToken}`)
      .query({ q: 'clean' });
    expect(res.status).toBe(200);
    expect(res.body.data.some((b) => b.id === created.body.id)).toBe(true);
  });

  it('searches books by author case-insensitively', async () => {
    const created = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Some Title',
        author: 'Martin Fowler',
        isbn: 'ISBN-SEARCH-AUTHOR',
        totalCopies: 2,
      });
    expect(created.status).toBe(201);

    const res = await request(app)
      .get('/books')
      .set('Authorization', `Bearer ${memberToken}`)
      .query({ q: 'fowler' });
    expect(res.status).toBe(200);
    expect(res.body.data.some((b) => b.id === created.body.id)).toBe(true);
  });

  it('paginates results and reports the correct total', async () => {
    const isbnPrefix = `ISBN-PAGINATE-${Date.now()}`;
    const created = [];
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app)
        .post('/books')
        .set('Authorization', `Bearer ${librarianToken}`)
        .send({
          title: `Paginate Book ${i}`,
          author: 'Paginate Author',
          isbn: `${isbnPrefix}-${i}`,
          totalCopies: 1,
        });
      created.push(res.body);
    }

    const res = await request(app)
      .get('/books')
      .set('Authorization', `Bearer ${memberToken}`)
      .query({ q: 'Paginate Book', page: 2, pageSize: 1 });

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(1);
    expect(res.body.total).toBe(3);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(created[1].id);
  });

  it('rejects page < 1 (400)', async () => {
    const res = await request(app)
      .get('/books')
      .set('Authorization', `Bearer ${memberToken}`)
      .query({ page: 0 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid pagination' });
  });

  it('rejects pageSize exceeding the maximum (400)', async () => {
    const res = await request(app)
      .get('/books')
      .set('Authorization', `Bearer ${memberToken}`)
      .query({ pageSize: 51 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid pagination' });
  });

  it('rejects a non-numeric page value (400)', async () => {
    const res = await request(app)
      .get('/books')
      .set('Authorization', `Bearer ${memberToken}`)
      .query({ page: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid pagination' });
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/books');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /books/:id', () => {
  it('returns the matching book when found', async () => {
    const created = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Findable',
        author: 'Author',
        isbn: 'ISBN-FIND-1',
        totalCopies: 4,
      });
    expect(created.status).toBe(201);

    const res = await request(app)
      .get(`/books/${created.body.id}`)
      .set('Authorization', `Bearer ${memberToken}`);
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
    const res = await request(app)
      .get('/books/does-not-exist')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('PATCH /books/:id', () => {
  it('updates title, author, and totalCopies', async () => {
    const created = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Old Title',
        author: 'Old Author',
        isbn: 'ISBN-PATCH-1',
        totalCopies: 5,
      });
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/books/${created.body.id}`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
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
    const created = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Ignore AC',
        author: 'Author',
        isbn: 'ISBN-PATCH-IGNORE-AC',
        totalCopies: 6,
      });
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/books/${created.body.id}`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        availableCopies: 999,
      });

    expect(res.status).toBe(200);
    expect(res.body.availableCopies).toBe(6);
    expect(res.body.availableCopies).not.toBe(999);
  });

  it('leaves fields unchanged when not present in the payload', async () => {
    const created = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Partial Update',
        author: 'Author',
        isbn: 'ISBN-PATCH-PARTIAL',
        totalCopies: 3,
      });
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/books/${created.body.id}`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Only Title Changed',
      });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Only Title Changed');
    expect(res.body.author).toBe('Author');
    expect(res.body.totalCopies).toBe(3);
  });

  it('rejects an empty title (400)', async () => {
    const created = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Valid Title',
        author: 'Author',
        isbn: 'ISBN-PATCH-EMPTY-TITLE',
        totalCopies: 3,
      });
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/books/${created.body.id}`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: '',
      });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects a non-positive totalCopies (400)', async () => {
    const created = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Valid Title',
        author: 'Author',
        isbn: 'ISBN-PATCH-NONPOSITIVE',
        totalCopies: 3,
      });
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/books/${created.body.id}`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        totalCopies: 0,
      });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects an update that would make availableCopies negative', async () => {
    const created = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
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

    const res = await request(app)
      .patch(`/books/${created.body.id}`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        totalCopies: 2, // newAvailable = 2 - 3 = -1, must be rejected
      });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .patch('/books/does-not-exist')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Whatever',
      });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 403 for an authenticated member (non-librarian)', async () => {
    const created = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Member Patch Attempt',
        author: 'Author',
        isbn: 'ISBN-PATCH-MEMBER-ATTEMPT',
        totalCopies: 2,
      });
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/books/${created.body.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Should Not Update' });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });
});

describe('DELETE /books/:id', () => {
  it('deletes a book with no copies on loan (204)', async () => {
    const created = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Deletable',
        author: 'Author',
        isbn: 'ISBN-DELETE-1',
        totalCopies: 2,
      });
    expect(created.status).toBe(201);

    const res = await request(app)
      .delete(`/books/${created.body.id}`)
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(res.status).toBe(204);

    const getRes = await request(app)
      .get(`/books/${created.body.id}`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .delete('/books/does-not-exist')
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects deletion when copies are on loan (409)', async () => {
    const created = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'On Loan',
        author: 'Author',
        isbn: 'ISBN-DELETE-ONLOAN',
        totalCopies: 4,
      });
    expect(created.status).toBe(201);

    // Simulate 2 copies on loan (no borrow/return flow exists yet to produce this via the API).
    const stored = bookService.getBookById(created.body.id);
    stored.availableCopies = 2;

    const res = await request(app)
      .delete(`/books/${created.body.id}`)
      .set('Authorization', `Bearer ${librarianToken}`);
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 403 for an authenticated member (non-librarian)', async () => {
    const created = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: 'Member Delete Attempt',
        author: 'Author',
        isbn: 'ISBN-DELETE-MEMBER-ATTEMPT',
        totalCopies: 2,
      });
    expect(created.status).toBe(201);

    const res = await request(app)
      .delete(`/books/${created.body.id}`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });
});
