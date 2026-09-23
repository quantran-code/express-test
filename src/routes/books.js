const express = require('express');
const { createBook, getAllBooks, getBookById, updateBook, deleteBook } = require('../services/bookService');

const router = express.Router();

router.post('/', (req, res, next) => {
  try {
    const created = createBook(req.body);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res) => {
  res.status(200).json(getAllBooks());
});

router.get('/:id', (req, res) => {
  const book = getBookById(req.params.id);
  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  res.status(200).json(book);
});

router.patch('/:id', (req, res, next) => {
  try {
    const updated = updateBook(req.params.id, req.body);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    deleteBook(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
