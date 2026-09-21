const { randomUUID } = require('crypto');

/**
 * @typedef {Object} Book
 * @property {string} id
 * @property {string} title
 * @property {string} author
 * @property {string} isbn
 * @property {number} totalCopies
 * @property {number} availableCopies
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/** @type {Book[]} */
let books = [];

function createError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * @param {{title:string,author:string,isbn:string,totalCopies:number}} data
 * @returns {Book}
 */
function createBook(data) {
  const { title, author, isbn, totalCopies } = data || {};

  if (!isNonEmptyString(title)) {
    throw createError('title must be a non-empty string', 400);
  }

  if (!isNonEmptyString(author)) {
    throw createError('author must be a non-empty string', 400);
  }

  if (!isNonEmptyString(isbn)) {
    throw createError('isbn must be a non-empty string', 400);
  }

  if (!isPositiveInteger(totalCopies)) {
    throw createError('totalCopies must be an integer greater than 0', 400);
  }

  const existing = books.find((b) => b.isbn === isbn);
  if (existing) {
    throw createError('Duplicate isbn', 409);
  }

  const now = new Date().toISOString();
  const book = {
    id: randomUUID(),
    title: title.trim(),
    author: author.trim(),
    isbn: isbn.trim(),
    totalCopies,
    availableCopies: totalCopies,
    createdAt: now,
    updatedAt: now,
  };

  books.push(book);
  return book;
}

/**
 * @returns {Book[]}
 */
function getAllBooks() {
  return books;
}

/**
 * @param {string} id
 * @returns {Book|undefined}
 */
function getBookById(id) {
  return books.find((b) => b.id === id);
}

/**
 * @param {string} id
 * @param {{title?:string,author?:string,totalCopies?:number,availableCopies?:number}} data
 * @returns {Book}
 */
function updateBook(id, data) {
  const book = getBookById(id);
  if (!book) {
    throw createError('Book not found', 404);
  }

  const { title, author, totalCopies } = data || {};

  // ignore any user-supplied availableCopies

  if (title !== undefined) {
    if (!isNonEmptyString(title)) {
      throw createError('title must be a non-empty string', 400);
    }
    book.title = title.trim();
  }

  if (author !== undefined) {
    if (!isNonEmptyString(author)) {
      throw createError('author must be a non-empty string', 400);
    }
    book.author = author.trim();
  }

  if (totalCopies !== undefined) {
    if (!isPositiveInteger(totalCopies)) {
      throw createError('totalCopies must be an integer greater than 0', 400);
    }

    const onLoan = book.totalCopies - book.availableCopies;
    const newAvailableCopies = totalCopies - onLoan;

    if (newAvailableCopies < 0) {
      throw createError('totalCopies cannot be less than the number of copies currently on loan', 400);
    }

    // keep within invariants: if onLoan is computed correctly, availableCopies will never exceed totalCopies
    book.totalCopies = totalCopies;
    book.availableCopies = newAvailableCopies;
  }

  book.updatedAt = new Date().toISOString();
  return book;
}

/**
 * @param {string} id
 * @returns {boolean}
 */
function deleteBook(id) {
  const book = getBookById(id);
  if (!book) {
    throw createError('Book not found', 404);
  }

  if (book.availableCopies !== book.totalCopies) {
    throw createError('Cannot delete a book while copies are on loan', 409);
  }

  books = books.filter((b) => b.id !== id);
  return true;
}

module.exports = {
  createBook,
  getAllBooks,
  getBookById,
  updateBook,
  deleteBook,
};
