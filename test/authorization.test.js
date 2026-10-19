const app = require('../src/app');
const bookRepository = require('../src/repositories/bookRepository');
const memberRepository = require('../src/repositories/memberRepository');
const loanRepository = require('../src/repositories/loanRepository');
const userRepository = require('../src/repositories/userRepository');
const {
  authedRequest,
  requestAs,
  registerAndSignInMember,
  signInLibrarian,
} = require('./helpers/auth');

beforeAll(async () => {
  await signInLibrarian(app);
});

let bookCounter = 0;
let memberCounter = 0;
let accountCounter = 0;

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

async function seedMember(overrides = {}) {
  memberCounter += 1;

  const res = await authedRequest(app)
    .post('/members')
    .send({
      name: `Seeded Member ${memberCounter}`,
      email: `member${memberCounter}@example.com`,
      ...overrides,
    });

  return res.body;
}

/**
 * Registers a fresh member account (which also creates its member record) and
 * returns the session plus an authorized request helper for it.
 *
 * @returns {Promise<{ accessToken: string, account: object, as: object }>}
 */
async function signUpMember(overrides = {}) {
  accountCounter += 1;

  const session = await registerAndSignInMember(app, {
    name: `Member Account ${accountCounter}`,
    email: `account${accountCounter}@example.com`,
    ...overrides,
  });

  return {
    accessToken: session.accessToken,
    account: session.account,
    as: requestAs(app, session.accessToken),
  };
}

function getBookAsLibrarian(id) {
  return authedRequest(app).get(`/books/${id}`);
}

function getMemberAsLibrarian(id) {
  return authedRequest(app).get(`/members/${id}`);
}

describe('authorization', () => {
  beforeEach(() => {
    bookRepository.reset();
    memberRepository.reset();
    loanRepository.reset();
    userRepository.reset();
  });

  describe('AC1: a member only reaches their own profile and loans', () => {
    it('lets a member view their own profile', async () => {
      const member = await signUpMember();

      const res = await member.as.get(`/members/${member.account.memberId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(member.account.memberId);
      expect(res.body.email).toBe(member.account.email);
    });

    it("forbids a member from viewing another member's profile", async () => {
      const other = await seedMember();
      const member = await signUpMember();

      const res = await member.as.get(`/members/${other.id}`);

      expect(res.status).toBe(403);
      expect(typeof res.body.error).toBe('string');
      expect(res.body.id).toBeUndefined();
      expect(res.body.email).toBeUndefined();
    });

    it('lets a member view their own loans', async () => {
      const member = await signUpMember();

      const res = await member.as.get(`/members/${member.account.memberId}/loans`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toEqual([]);
    });

    it("forbids a member from viewing another member's loans", async () => {
      const other = await seedMember();
      const book = await seedBook();
      const borrowed = await authedRequest(app)
        .post('/loans')
        .send({ bookId: book.id, memberId: other.id });
      expect(borrowed.status).toBe(201);

      const member = await signUpMember();

      const res = await member.as.get(`/members/${other.id}/loans`);

      expect(res.status).toBe(403);
      expect(typeof res.body.error).toBe('string');
      expect(Array.isArray(res.body)).toBe(false);
    });
  });

  describe('AC4: catalog management is librarian-only, catalog reads stay open', () => {
    it('lets a member list, search and get books', async () => {
      const book = await seedBook({ title: 'The Hobbit', author: 'J.R.R. Tolkien' });
      const member = await signUpMember();

      const list = await member.as.get('/books');
      expect(list.status).toBe(200);
      expect(list.body.map((entry) => entry.id)).toEqual([book.id]);

      const search = await member.as.get('/books/search').query({ q: 'hobb' });
      expect(search.status).toBe(200);
      expect(search.body.total).toBe(1);
      expect(search.body.data.map((entry) => entry.id)).toEqual([book.id]);

      const single = await member.as.get(`/books/${book.id}`);
      expect(single.status).toBe(200);
      expect(single.body.id).toBe(book.id);
    });

    it('forbids a member from creating a book and creates nothing', async () => {
      const member = await signUpMember();

      const res = await member.as.post('/books').send({
        title: 'Ghost Book',
        author: 'Nobody',
        isbn: '9781111111111',
        totalCopies: 1,
      });

      expect(res.status).toBe(403);
      expect(typeof res.body.error).toBe('string');
      expect(bookRepository.findAll()).toEqual([]);
    });

    it("forbids a member from updating a book and leaves it unchanged", async () => {
      const book = await seedBook();
      const member = await signUpMember();

      const res = await member.as
        .patch(`/books/${book.id}`)
        .send({ title: 'Tampered Title' });

      expect(res.status).toBe(403);
      expect(typeof res.body.error).toBe('string');

      const stored = await getBookAsLibrarian(book.id);
      expect(stored.status).toBe(200);
      expect(stored.body.title).toBe(book.title);
    });

    it('forbids a member from deleting a book and leaves it in the catalog', async () => {
      const book = await seedBook();
      const member = await signUpMember();

      const res = await member.as.delete(`/books/${book.id}`);

      expect(res.status).toBe(403);
      expect(typeof res.body.error).toBe('string');

      const stored = await getBookAsLibrarian(book.id);
      expect(stored.status).toBe(200);
    });

    it('forbids a member from listing all members', async () => {
      await seedMember();
      const member = await signUpMember();

      const res = await member.as.get('/members');

      expect(res.status).toBe(403);
      expect(typeof res.body.error).toBe('string');
      expect(Array.isArray(res.body)).toBe(false);
    });

    it('forbids a member from creating a member and creates nothing', async () => {
      const member = await signUpMember();
      const before = memberRepository.findAll().length;

      const res = await member.as
        .post('/members')
        .send({ name: 'Ghost Member', email: 'ghost@example.com' });

      expect(res.status).toBe(403);
      expect(typeof res.body.error).toBe('string');
      expect(memberRepository.findAll()).toHaveLength(before);
      expect(memberRepository.findByEmail('ghost@example.com')).toBeUndefined();
    });

    it("forbids a member from updating another member's account", async () => {
      const other = await seedMember();
      const member = await signUpMember();

      const res = await member.as
        .patch(`/members/${other.id}`)
        .send({ name: 'Hijacked' });

      expect(res.status).toBe(403);
      expect(typeof res.body.error).toBe('string');

      const stored = await getMemberAsLibrarian(other.id);
      expect(stored.status).toBe(200);
      expect(stored.body.name).toBe(other.name);
      expect(stored.body.email).toBe(other.email);
    });

    it("forbids a member from deleting another member's account", async () => {
      const other = await seedMember();
      const member = await signUpMember();

      const res = await member.as.delete(`/members/${other.id}`);

      expect(res.status).toBe(403);
      expect(typeof res.body.error).toBe('string');

      const stored = await getMemberAsLibrarian(other.id);
      expect(stored.status).toBe(200);
    });

    it('lets a member update and delete their own account', async () => {
      const member = await signUpMember();

      const patched = await member.as
        .patch(`/members/${member.account.memberId}`)
        .send({ name: 'Renamed Self' });

      expect(patched.status).toBe(200);
      expect(patched.body.name).toBe('Renamed Self');
      expect(patched.body.id).toBe(member.account.memberId);

      const removed = await member.as.delete(
        `/members/${member.account.memberId}`,
      );

      expect(removed.status).toBe(204);

      const gone = await getMemberAsLibrarian(member.account.memberId);
      expect(gone.status).toBe(404);
    });

    it('keeps the librarian book mutations working', async () => {
      const created = await authedRequest(app).post('/books').send({
        title: 'Librarian Book',
        author: 'Librarian Author',
        isbn: '9782222222222',
        totalCopies: 2,
      });

      expect(created.status).toBe(201);

      const patched = await authedRequest(app)
        .patch(`/books/${created.body.id}`)
        .send({ title: 'Librarian Book, Revised' });
      expect(patched.status).toBe(200);
      expect(patched.body.title).toBe('Librarian Book, Revised');

      const removed = await authedRequest(app).delete(`/books/${created.body.id}`);
      expect(removed.status).toBe(204);
    });
  });

  describe('AC2: borrow and return always use the token identity', () => {
    it('borrows for the caller when no memberId is supplied', async () => {
      const book = await seedBook();
      const member = await signUpMember();

      const res = await member.as.post('/loans').send({ bookId: book.id });

      expect(res.status).toBe(201);
      expect(res.body.memberId).toBe(member.account.memberId);
      expect(res.body.bookId).toBe(book.id);
    });

    it("ignores another member's memberId instead of honouring or rejecting it", async () => {
      const other = await seedMember();
      const book = await seedBook();
      const member = await signUpMember();

      const res = await member.as
        .post('/loans')
        .send({ bookId: book.id, memberId: other.id });

      expect(res.status).toBe(201);
      expect(res.body.memberId).toBe(member.account.memberId);
      expect(loanRepository.findActiveByMemberId(other.id)).toEqual([]);
    });

    it('ignores a nonexistent memberId instead of rejecting it', async () => {
      const book = await seedBook();
      const member = await signUpMember();

      const res = await member.as
        .post('/loans')
        .send({ bookId: book.id, memberId: 999 });

      expect(res.status).toBe(201);
      expect(res.body.memberId).toBe(member.account.memberId);
    });

    it("forbids a member from returning another member's loan", async () => {
      const other = await seedMember();
      const book = await seedBook();
      const borrowed = await authedRequest(app)
        .post('/loans')
        .send({ bookId: book.id, memberId: other.id });
      expect(borrowed.status).toBe(201);

      const member = await signUpMember();

      const res = await member.as.post(`/loans/${borrowed.body.id}/return`);

      expect(res.status).toBe(403);
      expect(typeof res.body.error).toBe('string');

      const storedLoan = loanRepository.findById(borrowed.body.id);
      expect(storedLoan.returnedAt).toBeNull();

      const storedBook = await getBookAsLibrarian(book.id);
      expect(storedBook.body.availableCopies).toBe(0);
    });

    it('lets a member return their own loan', async () => {
      const book = await seedBook();
      const member = await signUpMember();

      const borrowed = await member.as.post('/loans').send({ bookId: book.id });
      expect(borrowed.status).toBe(201);

      const res = await member.as.post(`/loans/${borrowed.body.id}/return`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(borrowed.body.id);
      expect(typeof res.body.returnedAt).toBe('string');
      expect(res.body.memberId).toBe(member.account.memberId);

      const storedBook = await getBookAsLibrarian(book.id);
      expect(storedBook.body.availableCopies).toBe(1);
    });
  });

  describe('AC3: a librarian acts on behalf of an explicit member', () => {
    it('checks a book out and in for a member named in the request body', async () => {
      const member = await seedMember();
      const book = await seedBook();

      const borrowed = await authedRequest(app)
        .post('/loans')
        .send({ bookId: book.id, memberId: member.id });

      expect(borrowed.status).toBe(201);
      expect(borrowed.body.memberId).toBe(member.id);

      const returned = await authedRequest(app).post(
        `/loans/${borrowed.body.id}/return`,
      );

      expect(returned.status).toBe(200);
      expect(typeof returned.body.returnedAt).toBe('string');

      const storedBook = await getBookAsLibrarian(book.id);
      expect(storedBook.body.availableCopies).toBe(1);
    });

    it('keeps the existing errors when a librarian omits or names an unknown member', async () => {
      const book = await seedBook();

      const missing = await authedRequest(app)
        .post('/loans')
        .send({ bookId: book.id });

      expect(missing.status).toBe(400);
      expect(typeof missing.body.error).toBe('string');

      const unknown = await authedRequest(app)
        .post('/loans')
        .send({ bookId: book.id, memberId: 999 });

      expect(unknown.status).toBe(404);
      expect(typeof unknown.body.error).toBe('string');

      expect(loanRepository.findAll()).toEqual([]);
    });
  });

  describe('AC5: system-wide reporting is librarian-only', () => {
    it('forbids a member from reading the overdue list', async () => {
      const member = await signUpMember();

      const res = await member.as.get('/loans/overdue');

      expect(res.status).toBe(403);
      expect(typeof res.body.error).toBe('string');
      expect(Array.isArray(res.body)).toBe(false);
    });

    it('lets a librarian read the overdue list', async () => {
      const res = await authedRequest(app).get('/loans/overdue');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});
