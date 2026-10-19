const app = require('../src/app');
const bookRepository = require('../src/repositories/bookRepository');
const { authedRequest, signInLibrarian } = require('./helpers/auth');

beforeAll(async () => {
  await signInLibrarian(app);
});

const sampleBook = {
  title: 'The Hobbit',
  author: 'J.R.R. Tolkien',
  isbn: '9780261102217',
  totalCopies: 3,
};

const otherBook = {
  title: 'Dune',
  author: 'Frank Herbert',
  isbn: '9780441013593',
  totalCopies: 2,
};

function createBook(payload = sampleBook) {
  return authedRequest(app).post('/books').send(payload);
}

describe('Books CRUD', () => {
  beforeEach(() => {
    bookRepository.reset();
  });

  describe('POST /books', () => {
    it('creates a book and sets availableCopies to totalCopies', async () => {
      const res = await createBook();

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(Number),
        title: sampleBook.title,
        author: sampleBook.author,
        isbn: sampleBook.isbn,
        totalCopies: sampleBook.totalCopies,
        availableCopies: sampleBook.totalCopies,
      });
    });

    it('ignores availableCopies supplied in the payload', async () => {
      const res = await createBook({ ...sampleBook, availableCopies: 99 });

      expect(res.status).toBe(201);
      expect(res.body.totalCopies).toBe(sampleBook.totalCopies);
      expect(res.body.availableCopies).toBe(sampleBook.totalCopies);

      const stored = await authedRequest(app).get(`/books/${res.body.id}`);
      expect(stored.status).toBe(200);
      expect(stored.body.availableCopies).toBe(sampleBook.totalCopies);
    });

    it('rejects a duplicate isbn with 409', async () => {
      const first = await createBook();
      expect(first.status).toBe(201);

      const duplicate = await createBook({ ...otherBook, isbn: first.body.isbn });

      expect(duplicate.status).toBe(409);
      expect(typeof duplicate.body.error).toBe('string');

      const list = await authedRequest(app).get('/books');
      expect(list.body).toHaveLength(1);
    });

    const invalidPayloads = [
      [
        'a missing title',
        { author: sampleBook.author, isbn: sampleBook.isbn, totalCopies: 3 },
      ],
      ['a blank title', { ...sampleBook, title: '   ' }],
      [
        'a missing author',
        { title: sampleBook.title, isbn: sampleBook.isbn, totalCopies: 3 },
      ],
      ['a blank author', { ...sampleBook, author: '' }],
      [
        'a missing isbn',
        { title: sampleBook.title, author: sampleBook.author, totalCopies: 3 },
      ],
      ['a blank isbn', { ...sampleBook, isbn: '  ' }],
      ['a totalCopies of 0', { ...sampleBook, totalCopies: 0 }],
      ['a negative totalCopies', { ...sampleBook, totalCopies: -2 }],
      ['a non-integer totalCopies', { ...sampleBook, totalCopies: 2.5 }],
    ];

    for (const [label, payload] of invalidPayloads) {
      it(`rejects ${label} with 400 and stores nothing`, async () => {
        const res = await createBook(payload);

        expect(res.status).toBe(400);
        expect(typeof res.body.error).toBe('string');

        const list = await authedRequest(app).get('/books');
        expect(list.body).toEqual([]);
      });
    }
  });

  describe('GET /books', () => {
    it('returns 200 with the created books', async () => {
      const first = await createBook();
      const second = await createBook(otherBook);

      const res = await authedRequest(app).get('/books');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((book) => book.title)).toEqual([
        first.body.title,
        second.body.title,
      ]);
      expect(res.body.map((book) => book.isbn)).toEqual([
        first.body.isbn,
        second.body.isbn,
      ]);
    });
  });

  describe('GET /books/:id', () => {
    it('returns 200 with the matching book', async () => {
      const created = await createBook();

      const res = await authedRequest(app).get(`/books/${created.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(created.body);
    });

    it('returns 404 with an error body for an unknown id', async () => {
      await createBook();

      const res = await authedRequest(app).get('/books/999');

      expect(res.status).toBe(404);
      expect(typeof res.body.error).toBe('string');
    });
  });

  describe('PATCH /books/:id', () => {
    it('updates only the supplied fields', async () => {
      const created = await createBook();

      const res = await authedRequest(app)
        .patch(`/books/${created.body.id}`)
        .send({ title: 'The Hobbit, Revised' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('The Hobbit, Revised');
      expect(res.body.author).toBe(created.body.author);
      expect(res.body.isbn).toBe(created.body.isbn);
      expect(res.body.totalCopies).toBe(created.body.totalCopies);
      expect(res.body.availableCopies).toBe(created.body.availableCopies);
    });

    it('returns 404 for an unknown id', async () => {
      await createBook();

      const res = await authedRequest(app).patch('/books/999').send({ title: 'Nope' });

      expect(res.status).toBe(404);
      expect(typeof res.body.error).toBe('string');
    });

    it('leaves availableCopies unchanged when the payload supplies it', async () => {
      const created = await createBook();

      const res = await authedRequest(app)
        .patch(`/books/${created.body.id}`)
        .send({ availableCopies: 0, author: 'Tolkien' });

      expect(res.status).toBe(200);
      expect(res.body.author).toBe('Tolkien');
      expect(res.body.availableCopies).toBe(created.body.availableCopies);

      const stored = await authedRequest(app).get(`/books/${created.body.id}`);
      expect(stored.body.availableCopies).toBe(created.body.availableCopies);
    });

    it('rejects an isbn already used by another book with 409', async () => {
      const first = await createBook();
      const second = await createBook(otherBook);

      const res = await authedRequest(app)
        .patch(`/books/${second.body.id}`)
        .send({ isbn: first.body.isbn });

      expect(res.status).toBe(409);
      expect(typeof res.body.error).toBe('string');

      const unchanged = await authedRequest(app).get(`/books/${second.body.id}`);
      expect(unchanged.body.isbn).toBe(otherBook.isbn);
    });

    it('raises availableCopies when totalCopies is raised and lowers it when totalCopies is lowered', async () => {
      const created = await createBook({ ...sampleBook, totalCopies: 4 });
      expect(created.body.availableCopies).toBe(4);

      const raised = await authedRequest(app)
        .patch(`/books/${created.body.id}`)
        .send({ totalCopies: 6 });

      expect(raised.status).toBe(200);
      expect(raised.body.totalCopies).toBe(6);
      expect(raised.body.availableCopies).toBe(6);

      const lowered = await authedRequest(app)
        .patch(`/books/${created.body.id}`)
        .send({ totalCopies: 2 });

      expect(lowered.status).toBe(200);
      expect(lowered.body.totalCopies).toBe(2);
      expect(lowered.body.availableCopies).toBe(2);
    });

    it('rejects a totalCopies change that would make availableCopies negative with 409 and leaves the record unchanged', async () => {
      const created = await createBook({ ...sampleBook, totalCopies: 5 });

      // Simulate three copies on loan: copies on loan = totalCopies - availableCopies.
      bookRepository.update(created.body.id, { availableCopies: 2 });

      const loaned = await authedRequest(app).get(`/books/${created.body.id}`);
      expect(loaned.body.availableCopies).toBe(2);

      const res = await authedRequest(app)
        .patch(`/books/${created.body.id}`)
        .send({ totalCopies: 2 });

      expect(res.status).toBe(409);
      expect(typeof res.body.error).toBe('string');

      const unchanged = await authedRequest(app).get(`/books/${created.body.id}`);
      expect(unchanged.status).toBe(200);
      expect(unchanged.body.totalCopies).toBe(5);
      expect(unchanged.body.availableCopies).toBe(2);
    });

    it('rejects a blank title with 400 and leaves the record unchanged', async () => {
      const created = await createBook();

      const res = await authedRequest(app)
        .patch(`/books/${created.body.id}`)
        .send({ title: '   ', author: 'Somebody Else' });

      expect(res.status).toBe(400);
      expect(typeof res.body.error).toBe('string');

      const unchanged = await authedRequest(app).get(`/books/${created.body.id}`);
      expect(unchanged.body.title).toBe(sampleBook.title);
      expect(unchanged.body.author).toBe(sampleBook.author);
    });

    it('rejects a totalCopies of 0 with 400 and leaves the record unchanged', async () => {
      const created = await createBook();

      const res = await authedRequest(app)
        .patch(`/books/${created.body.id}`)
        .send({ totalCopies: 0 });

      expect(res.status).toBe(400);
      expect(typeof res.body.error).toBe('string');

      const unchanged = await authedRequest(app).get(`/books/${created.body.id}`);
      expect(unchanged.body.totalCopies).toBe(sampleBook.totalCopies);
      expect(unchanged.body.availableCopies).toBe(sampleBook.totalCopies);
    });
  });

  describe('DELETE /books/:id', () => {
    it('returns 204 and removes the book when no copies are on loan', async () => {
      const created = await createBook();

      const res = await authedRequest(app).delete(`/books/${created.body.id}`);

      expect(res.status).toBe(204);

      const removed = await authedRequest(app).get(`/books/${created.body.id}`);
      expect(removed.status).toBe(404);

      const list = await authedRequest(app).get('/books');
      expect(list.body).toEqual([]);
    });

    it('returns 409 and keeps the book when copies are on loan', async () => {
      const created = await createBook({ ...sampleBook, totalCopies: 3 });

      // Simulate one copy on loan: copies on loan = totalCopies - availableCopies.
      bookRepository.update(created.body.id, { availableCopies: 1 });

      const loaned = await authedRequest(app).get(`/books/${created.body.id}`);
      expect(loaned.body.availableCopies).toBe(1);

      const res = await authedRequest(app).delete(`/books/${created.body.id}`);

      expect(res.status).toBe(409);
      expect(typeof res.body.error).toBe('string');

      const stillThere = await authedRequest(app).get(`/books/${created.body.id}`);
      expect(stillThere.status).toBe(200);
      expect(stillThere.body.totalCopies).toBe(3);
      expect(stillThere.body.availableCopies).toBe(1);
    });

    it('returns 404 for an unknown id', async () => {
      await createBook();

      const res = await authedRequest(app).delete('/books/999');

      expect(res.status).toBe(404);
      expect(typeof res.body.error).toBe('string');
    });
  });
});
