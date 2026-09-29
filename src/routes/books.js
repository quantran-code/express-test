const express = require('express');

const bookStore = require('../store/bookStore');
const ApiError = bookStore.ApiError;
const createBook = bookStore.createBook;
const getAllBooks = bookStore.getAllBooks;
const getBookById = bookStore.getBookById;
const updateBook = bookStore.updateBook;
const deleteBook = bookStore.deleteBook;

const router = express.Router();

router.post('/', (req, res, next) => {
  try {
    const book = createBook(req.body);
    res.status(201).json(book);
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    return next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const title = req.query.title;
    const author = req.query.author;
    const page = req.query.page !== undefined ? Number(req.query.page) : undefined;
    const pageSize = req.query.pageSize !== undefined ? Number(req.query.pageSize) : undefined;

    const result = getAllBooks({ title, author, page, pageSize });
    res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const book = getBookById(req.params.id);
    res.status(200).json(book);
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    return next(err);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const book = updateBook(req.params.id, req.body);
    res.status(200).json(book);
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    return next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    deleteBook(req.params.id);
    res.status(204).send();
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    return next(err);
  }
});

module.exports = router;
