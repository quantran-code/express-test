const express = require('express');
const {
  createBook,
  getAllBooks,
  getBookById,
  updateBook,
  deleteBook,
} = require('../services/bookService');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const book = createBook(req.body);
    res.status(201).json(book);
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    res.status(200).json(getAllBooks());
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const book = getBookById(req.params.id);
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

router.patch('/:id', async (req, res, next) => {
  try {
    const book = updateBook(req.params.id, req.body);
    res.status(200).json(book);
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
