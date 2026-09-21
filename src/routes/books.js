const express = require('express');
const bookService = require('../services/bookService');

const router = express.Router();

router.post('/', (req, res, next) => {
  try {
    const { title, author, isbn, totalCopies, availableCopies } = req.body || {};
    const book = bookService.createBook({ title, author, isbn, totalCopies, availableCopies });
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
    const book = bookService.getBookById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Not Found' });
    }
    res.status(200).json(book);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', (req, res, next) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'Bad Request' });
    }

    const { title, author, totalCopies, availableCopies } = req.body || {};
    const book = bookService.updateBook(req.params.id, { title, author, totalCopies, availableCopies });
    res.status(200).json(book);
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
