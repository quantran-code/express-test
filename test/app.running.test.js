const app = require('../src/app');
const bookRepository = require('../src/repositories/bookRepository');

let server;
let baseUrl;

beforeAll(async () => {
  bookRepository.reset();

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (!server) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));

    // Drop keep-alive sockets opened by fetch so close() can finish.
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
  });
});

describe('running server', () => {
  const payload = {
    title: 'The Hobbit',
    author: 'J.R.R. Tolkien',
    isbn: '9780261102217',
    totalCopies: 3,
  };

  it('serves GET /health over a real socket', async () => {
    const res = await fetch(`${baseUrl}/health`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('walks POST, GET list, GET by id, PATCH and DELETE /books end to end', async () => {
    const createRes = await fetch(`${baseUrl}/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(createRes.status).toBe(201);

    const created = await createRes.json();
    expect(created).toEqual({
      id: expect.any(Number),
      title: payload.title,
      author: payload.author,
      isbn: payload.isbn,
      totalCopies: payload.totalCopies,
      availableCopies: payload.totalCopies,
    });

    const listRes = await fetch(`${baseUrl}/books`);
    expect(listRes.status).toBe(200);

    const list = await listRes.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.map((book) => book.id)).toContain(created.id);

    const getRes = await fetch(`${baseUrl}/books/${created.id}`);
    expect(getRes.status).toBe(200);
    expect(await getRes.json()).toEqual(created);

    const patchRes = await fetch(`${baseUrl}/books/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'The Hobbit, Revised' }),
    });

    expect(patchRes.status).toBe(200);

    const patched = await patchRes.json();
    expect(patched.title).toBe('The Hobbit, Revised');
    expect(patched.isbn).toBe(created.isbn);
    expect(patched.availableCopies).toBe(created.availableCopies);

    const deleteRes = await fetch(`${baseUrl}/books/${created.id}`, {
      method: 'DELETE',
    });

    expect(deleteRes.status).toBe(204);

    const afterDeleteRes = await fetch(`${baseUrl}/books/${created.id}`);
    expect(afterDeleteRes.status).toBe(404);
  });
});
