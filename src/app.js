const express = require('express');
const routes = require('./routes');

const app = express();

app.use(express.json());
app.use('/', routes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;

  if (status === 400) {
    return res.status(400).json({ error: 'Bad Request', message: err.message });
  }

  if (status === 404) {
    return res.status(404).json({ error: 'Not Found' });
  }

  if (status === 409) {
    return res.status(409).json({ error: 'Conflict', message: err.message });
  }

  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
