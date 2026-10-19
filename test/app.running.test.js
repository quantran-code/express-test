const app = require('../src/app');
const bookRepository = require('../src/repositories/bookRepository');
const { LIBRARIAN_EMAIL, LIBRARIAN_PASSWORD } = require('./helpers/auth');

let server;
let baseUrl;
let accessToken;

function authHeaders(extra) {
  return { Authorization: `Bearer ${accessToken}`, ...extra };
}

beforeAll(async () => {
  bookRepository.reset();

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: LIBRARIAN_EMAIL,
      password: LIBRARIAN_PASSWORD,
    }),
  });

  const login = await loginRes.json();

  if (loginRes.status !== 200 || typeof login.accessToken !== 'string') {
    throw new Error(
      `Could not sign in as the seeded librarian (status ${loginRes.status})`,
    );
  }

  accessToken = login.accessToken;
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
      headers: authHeaders({ 'Content-Type': 'application/json' }),
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

    const listRes = await fetch(`${baseUrl}/books`, {
      headers: authHeaders(),
    });
    expect(listRes.status).toBe(200);

    const list = await listRes.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.map((book) => book.id)).toContain(created.id);

    const getRes = await fetch(`${baseUrl}/books/${created.id}`, {
      headers: authHeaders(),
    });
    expect(getRes.status).toBe(200);
    expect(await getRes.json()).toEqual(created);

    const patchRes = await fetch(`${baseUrl}/books/${created.id}`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ title: 'The Hobbit, Revised' }),
    });

    expect(patchRes.status).toBe(200);

    const patched = await patchRes.json();
    expect(patched.title).toBe('The Hobbit, Revised');
    expect(patched.isbn).toBe(created.isbn);
    expect(patched.availableCopies).toBe(created.availableCopies);

    const deleteRes = await fetch(`${baseUrl}/books/${created.id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });

    expect(deleteRes.status).toBe(204);

    const afterDeleteRes = await fetch(`${baseUrl}/books/${created.id}`, {
      headers: authHeaders(),
    });
    expect(afterDeleteRes.status).toBe(404);
  });
});
