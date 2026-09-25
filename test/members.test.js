const request = require('supertest');
const app = require('../src/app');
const memberService = require('../src/services/memberService');

const DEFAULT_PASSWORD = 'TestPass123';

async function seedLibrarian(email) {
  const member = await memberService.createMember({
    name: 'Librarian',
    email,
    role: 'librarian',
    password: DEFAULT_PASSWORD,
  });
  const loginRes = await request(app).post('/auth/login').send({ email, password: DEFAULT_PASSWORD });
  return { member, token: loginRes.body.token };
}

async function seedMember(email) {
  const member = await memberService.createMember({
    name: 'Regular Member',
    email,
    password: DEFAULT_PASSWORD,
  });
  const loginRes = await request(app).post('/auth/login').send({ email, password: DEFAULT_PASSWORD });
  return { member, token: loginRes.body.token };
}

describe('POST /members', () => {
  it('creates a member with valid data as librarian, defaulting role to member', async () => {
    const librarian = await seedLibrarian('librarian-create@example.com');

    const res = await request(app)
      .post('/members')
      .set('Authorization', `Bearer ${librarian.token}`)
      .send({
        name: 'New Member',
        email: 'new-member@example.com',
        password: DEFAULT_PASSWORD,
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'New Member',
      email: 'new-member@example.com',
      role: 'member',
    });
    expect(typeof res.body.id).toBe('number');
  });

  it('rejects creation when unauthenticated (401)', async () => {
    const res = await request(app).post('/members').send({
      name: 'Nope',
      email: 'nope@example.com',
      password: DEFAULT_PASSWORD,
    });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects creation as a non-librarian (403)', async () => {
    const regular = await seedMember('regular-create@example.com');

    const res = await request(app)
      .post('/members')
      .set('Authorization', `Bearer ${regular.token}`)
      .send({
        name: 'Nope',
        email: 'nope2@example.com',
        password: DEFAULT_PASSWORD,
      });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects creation with duplicate email (400)', async () => {
    const librarian = await seedLibrarian('librarian-dup@example.com');

    const first = await request(app)
      .post('/members')
      .set('Authorization', `Bearer ${librarian.token}`)
      .send({
        name: 'Original',
        email: 'dup-member@example.com',
        password: DEFAULT_PASSWORD,
      });
    expect(first.status).toBe(201);

    const dup = await request(app)
      .post('/members')
      .set('Authorization', `Bearer ${librarian.token}`)
      .send({
        name: 'Duplicate',
        email: 'dup-member@example.com',
        password: DEFAULT_PASSWORD,
      });

    expect(dup.status).toBe(400);
    expect(dup.body).toHaveProperty('error');
  });

  it('rejects a non-librarian creating another librarian account (403)', async () => {
    const regular = await seedMember('regular-create-librarian@example.com');

    const res = await request(app)
      .post('/members')
      .set('Authorization', `Bearer ${regular.token}`)
      .send({
        name: 'Aspiring Librarian',
        email: 'aspiring-librarian@example.com',
        password: DEFAULT_PASSWORD,
        role: 'librarian',
      });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('allows a librarian to create another librarian account', async () => {
    const librarian = await seedLibrarian('librarian-create-librarian@example.com');

    const res = await request(app)
      .post('/members')
      .set('Authorization', `Bearer ${librarian.token}`)
      .send({
        name: 'New Librarian',
        email: 'new-librarian@example.com',
        password: DEFAULT_PASSWORD,
        role: 'librarian',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ role: 'librarian' });
  });
});

describe('GET /members', () => {
  it('returns the full list as librarian', async () => {
    const librarian = await seedLibrarian('librarian-list@example.com');

    const res = await request(app)
      .get('/members')
      .set('Authorization', `Bearer ${librarian.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((m) => m.id === librarian.member.id)).toBe(true);
  });

  it('rejects listing as a non-librarian (403)', async () => {
    const regular = await seedMember('regular-list@example.com');

    const res = await request(app)
      .get('/members')
      .set('Authorization', `Bearer ${regular.token}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects listing when unauthenticated (401)', async () => {
    const res = await request(app).get('/members');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /members/:id', () => {
  it('returns the member when requested by that same member', async () => {
    const regular = await seedMember('regular-self@example.com');

    const res = await request(app)
      .get(`/members/${regular.member.id}`)
      .set('Authorization', `Bearer ${regular.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: regular.member.id,
      name: 'Regular Member',
      email: 'regular-self@example.com',
      role: 'member',
    });
  });

  it('rejects a different non-librarian requesting another member (403)', async () => {
    const regular = await seedMember('regular-other@example.com');
    const otherRegular = await seedMember('regular-otherlooker@example.com');

    const res = await request(app)
      .get(`/members/${regular.member.id}`)
      .set('Authorization', `Bearer ${otherRegular.token}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('returns the member for any id when requested by a librarian', async () => {
    const librarian = await seedLibrarian('librarian-anyid@example.com');
    const regular = await seedMember('regular-anyid@example.com');

    const res = await request(app)
      .get(`/members/${regular.member.id}`)
      .set('Authorization', `Bearer ${librarian.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: regular.member.id });
  });

  it('returns 404 for an unknown id when requested by a librarian', async () => {
    const librarian = await seedLibrarian('librarian-unknown@example.com');

    const res = await request(app)
      .get('/members/does-not-exist')
      .set('Authorization', `Bearer ${librarian.token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('PATCH /members/:id', () => {
  it('updates a member as librarian', async () => {
    const librarian = await seedLibrarian('librarian-patch@example.com');
    const regular = await seedMember('regular-patch@example.com');

    const res = await request(app)
      .patch(`/members/${regular.member.id}`)
      .set('Authorization', `Bearer ${librarian.token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: regular.member.id,
      name: 'Updated Name',
    });
  });

  it('allows a member to update their own profile', async () => {
    const regular = await seedMember('regular-patch-self@example.com');

    const res = await request(app)
      .patch(`/members/${regular.member.id}`)
      .set('Authorization', `Bearer ${regular.token}`)
      .send({ name: 'Self Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: regular.member.id,
      name: 'Self Updated Name',
    });
  });

  it('rejects update of another member by a non-librarian (403)', async () => {
    const regular = await seedMember('regular-patch-other-self@example.com');
    const otherRegular = await seedMember('regular-patch-other-target@example.com');

    const res = await request(app)
      .patch(`/members/${otherRegular.member.id}`)
      .set('Authorization', `Bearer ${regular.token}`)
      .send({ name: 'Should Not Update' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 404 for an unknown id when requested by a librarian', async () => {
    const librarian = await seedLibrarian('librarian-patch-unknown@example.com');

    const res = await request(app)
      .patch('/members/does-not-exist')
      .set('Authorization', `Bearer ${librarian.token}`)
      .send({ name: 'Whatever' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('DELETE /members/:id', () => {
  it('deletes a member as librarian', async () => {
    const librarian = await seedLibrarian('librarian-delete@example.com');
    const regular = await seedMember('regular-delete@example.com');

    const res = await request(app)
      .delete(`/members/${regular.member.id}`)
      .set('Authorization', `Bearer ${librarian.token}`);

    expect(res.status).toBe(204);

    const getRes = await request(app)
      .get(`/members/${regular.member.id}`)
      .set('Authorization', `Bearer ${librarian.token}`);
    expect(getRes.status).toBe(404);
  });

  it('allows a member to delete their own account', async () => {
    const regular = await seedMember('regular-delete-self@example.com');

    const res = await request(app)
      .delete(`/members/${regular.member.id}`)
      .set('Authorization', `Bearer ${regular.token}`);

    expect(res.status).toBe(204);
  });

  it('rejects deletion of another member by a non-librarian (403)', async () => {
    const regular = await seedMember('regular-delete-other-self@example.com');
    const otherRegular = await seedMember('regular-delete-other-target@example.com');

    const res = await request(app)
      .delete(`/members/${otherRegular.member.id}`)
      .set('Authorization', `Bearer ${regular.token}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 404 for an unknown id when requested by a librarian', async () => {
    const librarian = await seedLibrarian('librarian-delete-unknown@example.com');

    const res = await request(app)
      .delete('/members/does-not-exist')
      .set('Authorization', `Bearer ${librarian.token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});
