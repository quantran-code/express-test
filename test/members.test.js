const request = require('supertest');
const app = require('../src/app');
const memberService = require('../src/services/memberService');

function validMemberPayload(overrides = {}) {
  return {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    ...overrides,
  };
}

describe('POST /members', () => {
  it('creates a member', async () => {
    const res = await request(app).post('/members').send(validMemberPayload());
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Ada Lovelace');
    expect(res.body.email).toBe('ada@example.com');
    expect(typeof res.body.createdAt).toBe('string');
    expect(typeof res.body.updatedAt).toBe('string');
  });

  it('rejects a missing name with 400 and a Bad Request body', async () => {
    const payload = validMemberPayload();
    delete payload.name;
    const res = await request(app).post('/members').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bad Request');
    expect(typeof res.body.message).toBe('string');
  });

  it('rejects a missing email with 400 and a Bad Request body', async () => {
    const payload = validMemberPayload();
    delete payload.email;
    const res = await request(app).post('/members').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bad Request');
    expect(typeof res.body.message).toBe('string');
  });

  it('rejects a duplicate email with 409 and a Conflict body', async () => {
    const payload = validMemberPayload({ email: 'dup@example.com' });
    const first = await request(app).post('/members').send(payload);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/members')
      .send(validMemberPayload({ email: 'dup@example.com' }));
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('Conflict');
  });
});

describe('GET /members', () => {
  it('returns 200 with an array', async () => {
    await request(app).post('/members').send(validMemberPayload({ email: 'm1@example.com' }));
    await request(app).post('/members').send(validMemberPayload({ email: 'm2@example.com' }));

    const res = await request(app).get('/members');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /members/:id', () => {
  it('returns 200 for an existing id', async () => {
    const created = await request(app).post('/members').send(validMemberPayload({ email: 'get@example.com' }));
    const res = await request(app).get(`/members/${created.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  it('returns 404 with {error: "Not Found"} for a missing id', async () => {
    const res = await request(app).get('/members/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});

describe('PATCH /members/:id', () => {
  it('updates only the fields provided', async () => {
    const created = await request(app).post('/members').send(validMemberPayload({ email: 'patch@example.com' }));
    const id = created.body.id;

    const res = await request(app).patch(`/members/${id}`).send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.email).toBe(created.body.email);
  });

  it('returns 404 with {error: "Not Found"} for a missing id', async () => {
    const res = await request(app).patch('/members/does-not-exist').send({ name: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});

describe('DELETE /members/:id', () => {
  it('returns 204 and removes the member', async () => {
    const created = await request(app).post('/members').send(validMemberPayload({ email: 'delete@example.com' }));
    const id = created.body.id;

    const res = await request(app).delete(`/members/${id}`);
    expect(res.status).toBe(204);

    const getRes = await request(app).get(`/members/${id}`);
    expect(getRes.status).toBe(404);
  });
});

// keep existing tests isolation approach aligned with book tests
beforeEach(() => {
  memberService.resetMembers();
});
