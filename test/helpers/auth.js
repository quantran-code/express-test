const request = require('supertest');

// Matches the account seeded at module load of the user store.
const LIBRARIAN_EMAIL = 'librarian@library.test';
const LIBRARIAN_PASSWORD = 'Librarian123!';

let cachedToken = null;

/**
 * Logs the seeded librarian in and caches the access token for this test file.
 *
 * @param {import('express').Express} app
 * @returns {Promise<string>}
 */
async function signInLibrarian(app) {
  if (cachedToken) {
    return cachedToken;
  }

  const res = await request(app)
    .post('/auth/login')
    .send({ email: LIBRARIAN_EMAIL, password: LIBRARIAN_PASSWORD });

  if (
    res.status !== 200 ||
    typeof res.body.accessToken !== 'string' ||
    res.body.accessToken === ''
  ) {
    throw new Error(
      `Could not sign in as the seeded librarian (status ${res.status})`,
    );
  }

  cachedToken = res.body.accessToken;

  return cachedToken;
}

/**
 * @returns {string}
 */
function requireToken() {
  if (!cachedToken) {
    throw new Error(
      'Call signInLibrarian(app) in a beforeAll before using authedRequest(app)',
    );
  }

  return cachedToken;
}

/**
 * Same call sites as supertest's request(app), but every request carries the
 * cached librarian bearer token.
 *
 * @param {import('express').Express} app
 * @returns {{ get: Function, post: Function, patch: Function, put: Function, delete: Function }}
 */
function authedRequest(app) {
  /**
   * @param {import('supertest').Test} test
   * @returns {import('supertest').Test}
   */
  function authorize(test) {
    return test.set('Authorization', `Bearer ${requireToken()}`);
  }

  return {
    get: (url) => authorize(request(app).get(url)),
    post: (url) => authorize(request(app).post(url)),
    patch: (url) => authorize(request(app).patch(url)),
    put: (url) => authorize(request(app).put(url)),
    delete: (url) => authorize(request(app).delete(url)),
  };
}

module.exports = {
  LIBRARIAN_EMAIL,
  LIBRARIAN_PASSWORD,
  signInLibrarian,
  authedRequest,
};
