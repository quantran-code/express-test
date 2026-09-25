const request = require('supertest');
const app = require('../src/app');
const memberService = require('../src/services/memberService');

function seedLibrarian(email) {
  return memberService.createMember({
    name: 'Librarian',
    email,
    role: 'librarian',
  });
}

function seedMember(email) {
  return memberService.createMember({
    name: 'Regular Member',
    email,
  });
}

describe('POST /members', () => {
  it('creates a member with valid data as librarian, defaulting role to member', async () => {
    const librarian = seedLibrarian('librarian-create@example.com');

    const res = await request(app)
      .post('/members')
      .set('x-member-id', String(librarian.id))
      .send({
        name: 'New Member',
        email: 'new-member@example.com',
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
    });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects creation as a non-librarian (403)', async () => {
    const regular = seedMember('regular-create@example.com');

    const res = await request(app)
      .post('/members')
      .set('x-member-id', String(regular.id))
      .send({
        name: 'Nope',
        email: 'nope2@example.com',
      });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects creation with duplicate email (400)', async () => {
    const librarian = seedLibrarian('librarian-dup@example.com');

    const first = await request(app)
      .post('/members')
      .set('x-member-id', String(librarian.id))
      .send({
        name: 'Original',
        email: 'dup-member@example.com',
      });
    expect(first.status).toBe(201);

    const dup = await request(app)
      .post('/members')
      .set('x-member-id', String(librarian.id))
      .send({
        name: 'Duplicate',
        email: 'dup-member@example.com',
      });

    expect(dup.status).toBe(400);
    expect(dup.body).toHaveProperty('error');
  });
});

describe('GET /members', () => {
  it('returns the full list as librarian', async () => {
    const librarian = seedLibrarian('librarian-list@example.com');

    const res = await request(app)
      .get('/members')
      .set('x-member-id', String(librarian.id));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((m) => m.id === librarian.id)).toBe(true);
  });

  it('rejects listing as a non-librarian (403)', async () => {
    const regular = seedMember('regular-list@example.com');

    const res = await request(app)
      .get('/members')
      .set('x-member-id', String(regular.id));

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /members/:id', () => {
  it('returns the member when requested by that same member', async () => {
    const regular = seedMember('regular-self@example.com');

    const res = await request(app)
      .get(`/members/${regular.id}`)
      .set('x-member-id', String(regular.id));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: regular.id,
      name: 'Regular Member',
      email: 'regular-self@example.com',
      role: 'member',
    });
  });

  it('rejects a different non-librarian requesting another member (403)', async () => {
    const regular = seedMember('regular-other@example.com');
    const otherRegular = seedMember('regular-otherlooker@example.com');

    const res = await request(app)
      .get(`/members/${regular.id}`)
      .set('x-member-id', String(otherRegular.id));

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('returns the member for any id when requested by a librarian', async () => {
    const librarian = seedLibrarian('librarian-anyid@example.com');
    const regular = seedMember('regular-anyid@example.com');

    const res = await request(app)
      .get(`/members/${regular.id}`)
      .set('x-member-id', String(librarian.id));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: regular.id });
  });

  it('returns 404 for an unknown id when requested by a librarian', async () => {
    const librarian = seedLibrarian('librarian-unknown@example.com');

    const res = await request(app)
      .get('/members/does-not-exist')
      .set('x-member-id', String(librarian.id));

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('PATCH /members/:id', () => {
  it('updates a member as librarian', async () => {
    const librarian = seedLibrarian('librarian-patch@example.com');
    const regular = seedMember('regular-patch@example.com');

    const res = await request(app)
      .patch(`/members/${regular.id}`)
      .set('x-member-id', String(librarian.id))
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: regular.id,
      name: 'Updated Name',
    });
  });

  it('rejects update by a non-librarian, even on their own record (403)', async () => {
    const regular = seedMember('regular-patch-self@example.com');

    const res = await request(app)
      .patch(`/members/${regular.id}`)
      .set('x-member-id', String(regular.id))
      .send({ name: 'Should Not Update' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 404 for an unknown id when requested by a librarian', async () => {
    const librarian = seedLibrarian('librarian-patch-unknown@example.com');

    const res = await request(app)
      .patch('/members/does-not-exist')
      .set('x-member-id', String(librarian.id))
      .send({ name: 'Whatever' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('DELETE /members/:id', () => {
  it('deletes a member as librarian', async () => {
    const librarian = seedLibrarian('librarian-delete@example.com');
    const regular = seedMember('regular-delete@example.com');

    const res = await request(app)
      .delete(`/members/${regular.id}`)
      .set('x-member-id', String(librarian.id));

    expect(res.status).toBe(204);

    const getRes = await request(app)
      .get(`/members/${regular.id}`)
      .set('x-member-id', String(librarian.id));
    expect(getRes.status).toBe(404);
  });

  it('rejects deletion by a non-librarian, even on their own record (403)', async () => {
    const regular = seedMember('regular-delete-self@example.com');

    const res = await request(app)
      .delete(`/members/${regular.id}`)
      .set('x-member-id', String(regular.id));

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 404 for an unknown id when requested by a librarian', async () => {
    const librarian = seedLibrarian('librarian-delete-unknown@example.com');

    const res = await request(app)
      .delete('/members/does-not-exist')
      .set('x-member-id', String(librarian.id));

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});
