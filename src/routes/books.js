const express = require('express');
const bookService = require('../services/bookService');

const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json(bookService.listBooks());
});

router.get('/:id', (req, res) => {
  res.status(200).json(bookService.getBook(req.params.id));
});

router.post('/', (req, res) => {
  res.status(201).json(bookService.createBook(req.body));
});

router.patch('/:id', (req, res) => {
  res.status(200).json(bookService.updateBook(req.params.id, req.body));
});

router.delete('/:id', (req, res) => {
  bookService.deleteBook(req.params.id);
  res.status(204).end();
});

module.exports = router;
