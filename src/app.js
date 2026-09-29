const express = require('express');
const routes = require('./routes');

const auth = require('./middleware/auth');

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  const openPaths = new Set(['/auth/register', '/auth/login']);
  if (openPaths.has(req.path)) {
    return next();
  }

  return auth.requireAuth(req, res, next);
});

app.use('/', routes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
