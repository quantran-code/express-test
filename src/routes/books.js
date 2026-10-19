const express = require('express');
const bookService = require('../services/bookService');
const { requireLibrarian } = require('../middleware/authorize');

const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json(bookService.listBooks());
});

router.get('/search', (req, res) => {
  res.status(200).json(bookService.searchBooks(req.query));
});

router.get('/:id', (req, res) => {
  res.status(200).json(bookService.getBook(req.params.id));
});

router.post('/', requireLibrarian, (req, res) => {
  res.status(201).json(bookService.createBook(req.body));
});

router.patch('/:id', requireLibrarian, (req, res) => {
  res.status(200).json(bookService.updateBook(req.params.id, req.body));
});

router.delete('/:id', requireLibrarian, (req, res) => {
  bookService.deleteBook(req.params.id);
  res.status(204).end();
});

module.exports = router;
