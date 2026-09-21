const crypto = require('crypto');

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
  return Number.isInteger(value) && value > 0;
}

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

  const normalizedIsbn = isbn.trim();
  const existing = books.find((b) => b.isbn === normalizedIsbn);
  if (existing) {
    throw createError('isbn must be unique', 409);
  }

  const now = new Date().toISOString();
  const book = {
    id: crypto.randomUUID(),
    title: title.trim(),
    author: author.trim(),
    isbn: normalizedIsbn,
    totalCopies,
    availableCopies: totalCopies,
    createdAt: now,
    updatedAt: now,
  };

  books.push(book);
  return book;
}

function getAllBooks() {
  return books;
}

function getBookById(id) {
  return books.find((b) => b.id === id);
}

function updateBook(id, data) {
  const book = getBookById(id);
  if (!book) {
    throw createError('Book not found', 404);
  }

  const { title, author, isbn, totalCopies } = data || {};

  if (isbn !== undefined) {
    throw createError('isbn is immutable', 400);
  }

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

    book.totalCopies = totalCopies;
    book.availableCopies = totalCopies;
  }

  book.updatedAt = new Date().toISOString();
  return book;
}

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
  books,
  createBook,
  getAllBooks,
  getBookById,
  updateBook,
  deleteBook,
};
