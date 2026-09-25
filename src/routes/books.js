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
    const { q, page, pageSize } = req.query;
    const result = bookService.listBooks({ q, page, pageSize });
    res.status(200).json(result);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: 'Invalid pagination' });
    }
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

router.patch('/:id', (req, res, next) => {
  try {
    const book = bookService.updateBook(req.params.id, req.body);
    res.status(200).json(book);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    bookService.deleteBook(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
