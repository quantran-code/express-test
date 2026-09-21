const { randomUUID } = require('crypto');

const books = [];

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

  if (!isNonEmptyString(title) || !isNonEmptyString(author) || !isNonEmptyString(isbn)) {
    throw createError('title, author, and isbn are required non-empty strings', 400);
  }

  if (!isPositiveInteger(totalCopies)) {
    throw createError('totalCopies is required and must be an integer greater than 0', 400);
  }

  const normalizedIsbn = isbn.trim();

  if (books.some((book) => book.isbn === normalizedIsbn)) {
    throw createError(`A book with isbn "${normalizedIsbn}" already exists`, 409);
  }

  const now = new Date().toISOString();
  const book = {
    id: randomUUID(),
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

  const { title, author, totalCopies } = data || {};

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

    book.totalCopies = totalCopies;
    book.availableCopies = newAvailableCopies;
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

  const index = books.findIndex((b) => b.id === id);
  books.splice(index, 1);
  return true;
}

module.exports = {
  createBook,
  getAllBooks,
  getBookById,
  updateBook,
  deleteBook,
};
