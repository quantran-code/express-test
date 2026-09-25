const express = require('express');
const bookService = require('../services/bookService');

const router = express.Router();

router.post('/', (req, res, next) => {
  try {
    const book = bookService.createBook(req.body);
    res.status(201).json(book);
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const books = bookService.listBooks();
    res.status(200).json(books);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const book = bookService.getBook(Number(req.params.id));
    res.status(200).json(book);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', (req, res, next) => {
  try {
    const book = bookService.updateBook(Number(req.params.id), req.body);
    res.status(200).json(book);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    bookService.deleteBook(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
