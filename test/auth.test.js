const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const bookRepository = require('../src/repositories/bookRepository');
const memberRepository = require('../src/repositories/memberRepository');
const loanRepository = require('../src/repositories/loanRepository');
const userRepository = require('../src/repositories/userRepository');
const { signAccessToken } = require('../src/services/tokenService');
const {
  LIBRARIAN_EMAIL,
  LIBRARIAN_PASSWORD,
  authedRequest,
  signInLibrarian,
} = require('./helpers/auth');

const NEW_MEMBER = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'Secret123!',
};

const NEW_LIBRARIAN = {
  name: 'Grace Hopper',
  email: 'grace@example.com',
  password: 'Librarian456!',
};

// Every protected resource route, one entry per exposed method.
const PROTECTED_ENDPOINTS = [
  { method: 'get', path: '/books' },
  { method: 'post', path: '/books' },
  { method: 'get', path: '/books/1' },
  { method: 'patch', path: '/books/1' },
  { method: 'delete', path: '/books/1' },
  { method: 'get', path: '/books/search' },
  { method: 'get', path: '/members' },
  { method: 'post', path: '/members' },
  { method: 'get', path: '/members/1' },
  { method: 'get', path: '/members/1/loans' },
  { method: 'post', path: '/loans' },
  { method: 'get', path: '/loans/overdue' },
  { method: 'post', path: '/loans/1/return' },
];

let librarianToken;

/**
 * @param {{ method: string, path: string }} endpoint
 * @param {string} [authorization]
 * @returns {import('supertest').Test}
 */
function send(endpoint, authorization) {
  const test = request(app)[endpoint.method](endpoint.path);

  if (authorization !== undefined) {
    test.set('Authorization', authorization);
  }

  return test;
}

/**
 * @param {string} token
 * @returns {string}
 */
function tamperSignature(token) {
  const segments = token.split('.');
  const [header, payload, signature] = segments;
  const flipped = signature.charAt(0) === 'A' ? 'B' : 'A';

  return `${header}.${payload}.${flipped}${signature.slice(1)}`;
}

/**
 * @param {{ method: string, path: string }} endpoint
 * @returns {string}
 */
function label(endpoint) {
  return `${endpoint.method.toUpperCase()} ${endpoint.path}`;
}

function register(payload) {
  return request(app).post('/auth/register').send(payload);
}

function login(payload) {
  return request(app).post('/auth/login').send(payload);
}

beforeAll(async () => {
  librarianToken = await signInLibrarian(app);
});

describe('POST /auth/register', () => {
  beforeEach(() => {
    bookRepository.reset();
    memberRepository.reset();
    loanRepository.reset();
    userRepository.reset();
  });

  it('registers a member account with the member role (AC1)', async () => {
    const res = await register(NEW_MEMBER);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      memberId: expect.any(Number),
      name: NEW_MEMBER.name,
      email: NEW_MEMBER.email,
      role: 'member',
    });
    expect(res.body.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(NEW_MEMBER.password);

    const stored = userRepository.findByEmail(NEW_MEMBER.email);
    expect(stored).toBeDefined();
    expect(stored.role).toBe('member');
    expect(stored.memberId).toBe(res.body.memberId);
    expect(stored.passwordHash).not.toBe(NEW_MEMBER.password);
    expect(await bcrypt.compare(NEW_MEMBER.password, stored.passwordHash)).toBe(
      true,
    );

    const members = await authedRequest(app).get('/members');
    expect(members.status).toBe(200);

    const member = members.body.find((entry) => entry.id === res.body.memberId);
    expect(member).toBeDefined();
    expect(member.name).toBe(NEW_MEMBER.name);
    expect(member.email).toBe(NEW_MEMBER.email);
  });

  it('rejects an email already used by a user with 409 and stores nothing (AC2)', async () => {
    const first = await register(NEW_MEMBER);
    expect(first.status).toBe(201);

    const duplicate = await register({
      ...NEW_LIBRARIAN,
      email: NEW_MEMBER.email.toUpperCase(),
    });

    expect(duplicate.status).toBe(409);
    expect(typeof duplicate.body.error).toBe('string');
    expect(duplicate.body.error.length).toBeGreaterThan(0);

    expect(userRepository.findAll()).toHaveLength(2);
    expect(userRepository.findByEmail(NEW_LIBRARIAN.email)).toBeUndefined();
    expect(memberRepository.findAll()).toHaveLength(1);
  });

  it('rejects an email already used by a member with 409 and stores nothing (AC2)', async () => {
    const member = await authedRequest(app).post('/members').send({
      name: 'Existing Member',
      email: 'existing@example.com',
    });
    expect(member.status).toBe(201);

    const res = await register({ ...NEW_MEMBER, email: 'existing@example.com' });

    expect(res.status).toBe(409);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);

    expect(userRepository.findAll()).toHaveLength(1);
    expect(userRepository.findByEmail('existing@example.com')).toBeUndefined();
    expect(memberRepository.findAll()).toHaveLength(1);
  });

  it('rejects a missing password with 400 and stores nothing (AC2)', async () => {
    const res = await register({
      name: NEW_MEMBER.name,
      email: NEW_MEMBER.email,
    });

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);

    expect(userRepository.findAll()).toHaveLength(1);
    expect(memberRepository.findAll()).toEqual([]);
  });

  it('rejects a too short password with 400 and stores nothing (AC2)', async () => {
    const missing = await register({
      name: NEW_MEMBER.name,
      email: NEW_MEMBER.email,
    });
    expect(missing.status).toBe(400);

    const res = await register({
      ...NEW_MEMBER,
      password: 'short12',
    });

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
    expect(res.body.error).not.toBe(missing.body.error);

    expect(userRepository.findAll()).toHaveLength(1);
    expect(memberRepository.findAll()).toEqual([]);
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => {
    bookRepository.reset();
    memberRepository.reset();
    loanRepository.reset();
    userRepository.reset();
  });

  it('returns an access token for the seeded librarian (AC3)', async () => {
    const res = await login({
      email: LIBRARIAN_EMAIL,
      password: LIBRARIAN_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.accessToken.length).toBeGreaterThan(0);
    expect(res.body.tokenType).toBe('Bearer');
    expect(res.body.role).toBe('librarian');
    expect(res.body.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(LIBRARIAN_PASSWORD);
  });

  it('returns the same generic invalid credentials error for a wrong password and an unknown email (AC3)', async () => {
    const wrongPassword = await login({
      email: LIBRARIAN_EMAIL,
      password: 'NotThePassword1!',
    });

    expect(wrongPassword.status).toBe(401);
    expect(typeof wrongPassword.body.error).toBe('string');

    const unknownEmail = await login({
      email: 'nobody@library.test',
      password: LIBRARIAN_PASSWORD,
    });

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(unknownEmail.body.error).toBe('Invalid credentials');
  });

  it('lets a registered member log in with the member role', async () => {
    const created = await register(NEW_MEMBER);
    expect(created.status).toBe(201);

    const res = await login({
      email: NEW_MEMBER.email,
      password: NEW_MEMBER.password,
    });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.accessToken.length).toBeGreaterThan(0);
    expect(res.body.role).toBe('member');
    expect(res.body.passwordHash).toBeUndefined();
  });
});

describe('protected endpoints', () => {
  beforeEach(() => {
    bookRepository.reset();
    memberRepository.reset();
    loanRepository.reset();
    userRepository.reset();
  });

  for (const endpoint of PROTECTED_ENDPOINTS) {
    it(`rejects ${label(endpoint)} with 401 when no Authorization header is sent (AC4)`, async () => {
      const res = await send(endpoint);

      expect(res.status).toBe(401);
      expect(typeof res.body.error).toBe('string');
    });
  }

  for (const endpoint of PROTECTED_ENDPOINTS) {
    it(`rejects ${label(endpoint)} with 401 when the token is malformed (AC4)`, async () => {
      const res = await send(endpoint, 'Bearer not-a-token');

      expect(res.status).toBe(401);
      expect(typeof res.body.error).toBe('string');
    });
  }

  for (const endpoint of PROTECTED_ENDPOINTS) {
    it(`rejects ${label(endpoint)} with 401 when the signature was tampered with (AC4)`, async () => {
      const res = await send(endpoint, `Bearer ${tamperSignature(librarianToken)}`);

      expect(res.status).toBe(401);
      expect(typeof res.body.error).toBe('string');
    });
  }

  for (const endpoint of PROTECTED_ENDPOINTS) {
    it(`rejects ${label(endpoint)} with 401 when the token has expired (AC4)`, async () => {
      const expiredToken = signAccessToken(
        { sub: 1, role: 'librarian' },
        { expiresInSeconds: -1 },
      );

      const res = await send(endpoint, `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(typeof res.body.error).toBe('string');
    });
  }

  it('lets a valid librarian token through to the handler', async () => {
    const books = await authedRequest(app).get('/books');
    expect(books.status).toBe(200);
    expect(Array.isArray(books.body)).toBe(true);

    const members = await authedRequest(app).get('/members');
    expect(members.status).toBe(200);
    expect(Array.isArray(members.body)).toBe(true);
  });
});

describe('public endpoints', () => {
  beforeEach(() => {
    bookRepository.reset();
    memberRepository.reset();
    loanRepository.reset();
    userRepository.reset();
  });

  it('serves GET /health with no Authorization header (AC4)', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('serves POST /auth/register with no Authorization header (AC4)', async () => {
    const res = await register(NEW_MEMBER);

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('member');
  });

  it('serves POST /auth/login with no Authorization header (AC4)', async () => {
    const res = await login({
      email: LIBRARIAN_EMAIL,
      password: LIBRARIAN_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.accessToken.length).toBeGreaterThan(0);
  });

  it('still returns 404 for an unknown path with no token, not 401', async () => {
    const res = await request(app).get('/does-not-exist');

    expect(res.status).toBe(404);
  });
});

describe('librarian creation', () => {
  beforeEach(() => {
    bookRepository.reset();
    memberRepository.reset();
    loanRepository.reset();
    userRepository.reset();
  });

  /**
   * @returns {Promise<{ accessToken: string, account: object }>}
   */
  async function registerAndSignInMember() {
    const created = await register(NEW_MEMBER);
    expect(created.status).toBe(201);

    const session = await login({
      email: NEW_MEMBER.email,
      password: NEW_MEMBER.password,
    });
    expect(session.status).toBe(200);

    return { accessToken: session.body.accessToken, account: created.body };
  }

  it('rejects role librarian without a token with 403 (AC5)', async () => {
    const res = await register({ ...NEW_LIBRARIAN, role: 'librarian' });

    expect(res.status).toBe(403);
    expect(typeof res.body.error).toBe('string');

    expect(userRepository.findByEmail(NEW_LIBRARIAN.email)).toBeUndefined();
    expect(memberRepository.findAll()).toEqual([]);
  });

  it('rejects role librarian with a member token with 403 (AC5)', async () => {
    const member = await registerAndSignInMember();

    const res = await request(app)
      .post('/auth/register')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ ...NEW_LIBRARIAN, role: 'librarian' });

    expect(res.status).toBe(403);
    expect(typeof res.body.error).toBe('string');

    expect(userRepository.findByEmail(NEW_LIBRARIAN.email)).toBeUndefined();
  });

  it('lets a librarian create another librarian account that can log in (AC5)', async () => {
    const res = await authedRequest(app)
      .post('/auth/register')
      .send({ ...NEW_LIBRARIAN, role: 'librarian' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      memberId: expect.any(Number),
      name: NEW_LIBRARIAN.name,
      email: NEW_LIBRARIAN.email,
      role: 'librarian',
    });
    expect(res.body.passwordHash).toBeUndefined();

    const stored = userRepository.findByEmail(NEW_LIBRARIAN.email);
    expect(stored).toBeDefined();
    expect(stored.role).toBe('librarian');
    expect(stored.passwordHash).not.toBe(NEW_LIBRARIAN.password);

    const session = await login({
      email: NEW_LIBRARIAN.email,
      password: NEW_LIBRARIAN.password,
    });

    expect(session.status).toBe(200);
    expect(session.body.role).toBe('librarian');
    expect(typeof session.body.accessToken).toBe('string');

    const books = await request(app)
      .get('/books')
      .set('Authorization', `Bearer ${session.body.accessToken}`);

    expect(books.status).toBe(200);
  });

  it('keeps the seeded librarian available after a user store reset (AC5)', async () => {
    userRepository.reset();

    const users = userRepository.findAll();
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe(LIBRARIAN_EMAIL);
    expect(users[0].role).toBe('librarian');

    const res = await login({
      email: LIBRARIAN_EMAIL,
      password: LIBRARIAN_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('librarian');
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.accessToken.length).toBeGreaterThan(0);
  });
});
