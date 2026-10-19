const request = require('supertest');
const app = require('../src/app');
const bookRepository = require('../src/repositories/bookRepository');
const memberRepository = require('../src/repositories/memberRepository');
const loanRepository = require('../src/repositories/loanRepository');

const sampleMember = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
};

const otherMember = {
  name: 'Grace Hopper',
  email: 'grace@example.com',
};

const sampleBook = {
  title: 'The Hobbit',
  author: 'J.R.R. Tolkien',
  isbn: '9780261102217',
  totalCopies: 1,
};

function createMember(payload = sampleMember) {
  return request(app).post('/members').send(payload);
}

function createBook(payload = sampleBook) {
  return request(app).post('/books').send(payload);
}

describe('Members CRUD', () => {
  beforeEach(() => {
    bookRepository.reset();
    memberRepository.reset();
    loanRepository.reset();
  });

  describe('POST /members', () => {
    it('creates a member with a generated id', async () => {
      const res = await createMember();

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(Number),
        name: sampleMember.name,
        email: sampleMember.email,
      });
    });

    it('trims and lowercases the email before storing it', async () => {
      const res = await createMember({ name: 'Ada', email: '  ADA@Example.COM  ' });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe('ada@example.com');
      expect(res.body.name).toBe('Ada');
    });

    it('rejects an email already in use, differing only in case, with 409', async () => {
      const first = await createMember();
      expect(first.status).toBe(201);

      const duplicate = await createMember({
        ...otherMember,
        email: 'ADA@Example.COM',
      });

      expect(duplicate.status).toBe(409);
      expect(typeof duplicate.body.error).toBe('string');

      const list = await request(app).get('/members');
      expect(list.body).toHaveLength(1);
      expect(list.body[0].email).toBe(sampleMember.email);
    });

    const invalidPayloads = [
      ['a missing name', { email: sampleMember.email }],
      ['a blank name', { ...sampleMember, name: '   ' }],
      ['a missing email', { name: sampleMember.name }],
      ['a blank email', { ...sampleMember, email: '   ' }],
      ['an email without an @', { ...sampleMember, email: 'adaexample.com' }],
      [
        'an email with more than one @',
        { ...sampleMember, email: 'ada@@example.com' },
      ],
      ['an email with no local part', { ...sampleMember, email: '@example.com' }],
      ['an email whose domain has no dot', { ...sampleMember, email: 'ada@example' }],
    ];

    for (const [label, payload] of invalidPayloads) {
      it(`rejects ${label} with 400 and stores nothing`, async () => {
        const res = await createMember(payload);

        expect(res.status).toBe(400);
        expect(typeof res.body.error).toBe('string');

        const list = await request(app).get('/members');
        expect(list.body).toEqual([]);
      });
    }
  });

  describe('GET /members', () => {
    it('returns 200 with the created members', async () => {
      const first = await createMember();
      const second = await createMember(otherMember);

      const res = await request(app).get('/members');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((member) => member.name)).toEqual([
        first.body.name,
        second.body.name,
      ]);
      expect(res.body.map((member) => member.email)).toEqual([
        first.body.email,
        second.body.email,
      ]);
    });

    it('returns an empty list when no members exist', async () => {
      const res = await request(app).get('/members');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /members/:id', () => {
    it('returns 200 with the matching member', async () => {
      const created = await createMember();

      const res = await request(app).get(`/members/${created.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(created.body);
    });

    it('returns 404 with an error body for an unknown id', async () => {
      await createMember();

      const res = await request(app).get('/members/999');

      expect(res.status).toBe(404);
      expect(typeof res.body.error).toBe('string');
    });
  });

  describe('PATCH /members/:id', () => {
    it('updates the supplied fields', async () => {
      const created = await createMember();

      const renamed = await request(app)
        .patch(`/members/${created.body.id}`)
        .send({ name: 'Ada King' });

      expect(renamed.status).toBe(200);
      expect(renamed.body.name).toBe('Ada King');
      expect(renamed.body.email).toBe(created.body.email);

      const reEmailed = await request(app)
        .patch(`/members/${created.body.id}`)
        .send({ email: '  ADA.King@Example.COM  ' });

      expect(reEmailed.status).toBe(200);
      expect(reEmailed.body.email).toBe('ada.king@example.com');
      expect(reEmailed.body.name).toBe('Ada King');

      const stored = await request(app).get(`/members/${created.body.id}`);
      expect(stored.body.name).toBe('Ada King');
      expect(stored.body.email).toBe('ada.king@example.com');
    });

    it('rejects an email used by another member with 409 and leaves the record unchanged', async () => {
      const first = await createMember();
      const second = await createMember(otherMember);

      const res = await request(app)
        .patch(`/members/${second.body.id}`)
        .send({ email: 'ADA@Example.COM' });

      expect(res.status).toBe(409);
      expect(typeof res.body.error).toBe('string');

      const unchanged = await request(app).get(`/members/${second.body.id}`);
      expect(unchanged.body.email).toBe(otherMember.email);
      expect(unchanged.body.name).toBe(otherMember.name);

      const firstUnchanged = await request(app).get(`/members/${first.body.id}`);
      expect(firstUnchanged.body.email).toBe(sampleMember.email);
    });

    it('returns 404 for an unknown id', async () => {
      await createMember();

      const res = await request(app).patch('/members/999').send({ name: 'Nope' });

      expect(res.status).toBe(404);
      expect(typeof res.body.error).toBe('string');
    });

    it('rejects an invalid email with 400 and leaves the record unchanged', async () => {
      const created = await createMember();

      const res = await request(app)
        .patch(`/members/${created.body.id}`)
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(typeof res.body.error).toBe('string');

      const unchanged = await request(app).get(`/members/${created.body.id}`);
      expect(unchanged.body.email).toBe(sampleMember.email);
    });
  });

  describe('DELETE /members/:id', () => {
    it('returns 204 and removes the member when they have no active loans', async () => {
      const created = await createMember();

      const res = await request(app).delete(`/members/${created.body.id}`);

      expect(res.status).toBe(204);

      const removed = await request(app).get(`/members/${created.body.id}`);
      expect(removed.status).toBe(404);

      const list = await request(app).get('/members');
      expect(list.body).toEqual([]);
    });

    it('returns 409 and keeps the member while they have an unreturned loan', async () => {
      const member = await createMember();
      const book = await createBook();

      const loan = await request(app).post('/loans').send({
        bookId: book.body.id,
        memberId: member.body.id,
      });
      expect(loan.status).toBe(201);

      const res = await request(app).delete(`/members/${member.body.id}`);

      expect(res.status).toBe(409);
      expect(typeof res.body.error).toBe('string');

      const stillThere = await request(app).get(`/members/${member.body.id}`);
      expect(stillThere.status).toBe(200);
      expect(stillThere.body.email).toBe(sampleMember.email);

      const list = await request(app).get('/members');
      expect(list.body.map((entry) => entry.id)).toContain(member.body.id);
    });

    it('returns 204 once the member has returned every loan', async () => {
      const member = await createMember();
      const book = await createBook();

      const loan = await request(app).post('/loans').send({
        bookId: book.body.id,
        memberId: member.body.id,
      });
      expect(loan.status).toBe(201);

      const returned = await request(app).post(`/loans/${loan.body.id}/return`);
      expect(returned.status).toBe(200);

      const res = await request(app).delete(`/members/${member.body.id}`);

      expect(res.status).toBe(204);

      const list = await request(app).get('/members');
      expect(list.body).toEqual([]);
    });

    it('returns 404 for an unknown id', async () => {
      await createMember();

      const res = await request(app).delete('/members/999');

      expect(res.status).toBe(404);
      expect(typeof res.body.error).toBe('string');
    });
  });
});
