const express = require('express');
const bookService = require('../services/bookService');

const router = express.Router();

router.get('/', (req, res, next) => {
  try {
    res.status(200).json(bookService.getAllBooks());
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const book = bookService.getBookById(req.params.id);
    if (!book) {
      const err = new Error('Book not found');
      err.status = 404;
      throw err;
    }
    res.status(200).json(book);
  } catch (err) {
    next(err);
  }
});

router.post('/', (req, res, next) => {
  try {
    const { availableCopies, ...data } = req.body || {};
    const created = bookService.createBook(data);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', (req, res, next) => {
  try {
    const { availableCopies, ...data } = req.body || {};
    const updated = bookService.updateBook(req.params.id, data);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    bookService.deleteBook(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
