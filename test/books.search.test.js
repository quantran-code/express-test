const app = require('../src/app');
const bookRepository = require('../src/repositories/bookRepository');
const { authedRequest, signInLibrarian } = require('./helpers/auth');

beforeAll(async () => {
  await signInLibrarian(app);
});

let bookCounter = 0;

async function seedBook(overrides = {}) {
  bookCounter += 1;

  const res = await authedRequest(app)
    .post('/books')
    .send({
      title: `Seeded Book ${bookCounter}`,
      author: 'Seeded Author',
      isbn: `978000000${String(bookCounter).padStart(4, '0')}`,
      totalCopies: 1,
      ...overrides,
    });

  return res.body;
}

function search(query) {
  return authedRequest(app).get('/books/search').query(query);
}

describe('GET /books/search', () => {
  beforeEach(() => {
    bookRepository.reset();
  });

  it('matches a book by a partial title', async () => {
    const hobbit = await seedBook({ title: 'The Hobbit', author: 'J.R.R. Tolkien' });
    await seedBook({ title: 'Dune', author: 'Frank Herbert' });

    const res = await search({ q: 'hobb' });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data.map((book) => book.id)).toEqual([hobbit.id]);
  });

  it('matches a book by a partial author', async () => {
    const hobbit = await seedBook({ title: 'The Hobbit', author: 'J.R.R. Tolkien' });
    await seedBook({ title: 'Dune', author: 'Frank Herbert' });

    const res = await search({ q: 'tolk' });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data.map((book) => book.id)).toEqual([hobbit.id]);
  });

  it('matches title or author case-insensitively and excludes non-matches', async () => {
    const upperTitle = await seedBook({ title: 'THE HOBBIT', author: 'Someone Else' });
    const upperAuthor = await seedBook({ title: 'Unrelated Title', author: 'Hob Bespoke' });
    const neither = await seedBook({ title: 'Dune', author: 'Frank Herbert' });

    const res = await search({ q: 'hob' });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);

    const ids = res.body.data.map((book) => book.id);
    expect(ids).toContain(upperTitle.id);
    expect(ids).toContain(upperAuthor.id);
    expect(ids).not.toContain(neither.id);

    for (const book of res.body.data) {
      const haystack = `${book.title} ${book.author}`.toLowerCase();
      expect(haystack).toContain('hob');
    }
  });

  it('reports the total number of matches while data holds one page', async () => {
    for (let index = 0; index < 12; index += 1) {
      await seedBook({ title: `Match ${index}`, author: 'Common Author' });
    }

    const res = await search({ q: 'match', pageSize: 10 });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(12);
    expect(res.body.data).toHaveLength(10);
  });

  it('returns the remaining matches on page 2', async () => {
    const seeded = [];

    for (let index = 0; index < 12; index += 1) {
      seeded.push(await seedBook({ title: `Match ${index}`, author: 'Common Author' }));
    }

    const firstPage = await search({ q: 'match', page: 1, pageSize: 10 });
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data).toHaveLength(10);

    const secondPage = await search({ q: 'match', page: 2, pageSize: 10 });

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.total).toBe(12);
    expect(secondPage.body.data.map((book) => book.id)).toEqual(
      seeded.slice(10).map((book) => book.id),
    );

    const firstPageIds = firstPage.body.data.map((book) => book.id);

    for (const book of secondPage.body.data) {
      expect(firstPageIds).not.toContain(book.id);
    }
  });

  it('combines q with page and pageSize in one request', async () => {
    const seeded = [];

    for (let index = 0; index < 12; index += 1) {
      seeded.push(await seedBook({ title: `The Saga ${index}`, author: 'Chronicler' }));
    }

    await seedBook({ title: 'Dune', author: 'Frank Herbert' });

    const res = await search({ q: 'the', page: 2, pageSize: 5 });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(12);
    expect(res.body.data.map((book) => book.id)).toEqual(
      seeded.slice(5, 10).map((book) => book.id),
    );
  });

  it('returns every book paginated when q is missing', async () => {
    for (let index = 0; index < 12; index += 1) {
      await seedBook({ title: `Catalog Book ${index}` });
    }

    const firstPage = await search({});

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.total).toBe(12);
    expect(firstPage.body.data).toHaveLength(10);

    const secondPage = await search({ page: 2 });

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.total).toBe(12);
    expect(secondPage.body.data).toHaveLength(2);
  });

  it('treats a blank q as matching every book', async () => {
    await seedBook({ title: 'The Hobbit', author: 'J.R.R. Tolkien' });
    await seedBook({ title: 'Dune', author: 'Frank Herbert' });

    const res = await search({ q: '   ' });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
  });

  const invalidPagination = [
    ['page of 0', { page: 0 }],
    ['negative page', { page: -1 }],
    ['pageSize of 0', { pageSize: 0 }],
    ['pageSize of 101', { pageSize: 101 }],
    ['non-numeric page', { page: 'abc' }],
    ['non-numeric pageSize', { pageSize: 'abc' }],
    ['non-integer page', { page: '1.5' }],
    ['non-integer pageSize', { pageSize: '2.5' }],
  ];

  for (const [label, query] of invalidPagination) {
    it(`rejects a ${label} with 400`, async () => {
      await seedBook();

      const res = await search(query);

      expect(res.status).toBe(400);
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error.length).toBeGreaterThan(0);
      expect(res.body.data).toBeUndefined();
    });
  }
});

describe('GET /books', () => {
  beforeEach(() => {
    bookRepository.reset();
  });

  it('still returns a bare array of all books', async () => {
    const first = await seedBook({ title: 'The Hobbit' });
    const second = await seedBook({ title: 'Dune' });

    const res = await authedRequest(app).get('/books');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map((book) => book.id)).toEqual([first.id, second.id]);
  });
});
