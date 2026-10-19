const HttpError = require('../errors/httpError');
const bookRepository = require('../repositories/bookRepository');

/**
 * @param {number | string} id
 * @returns {number}
 */
function parseId(id) {
  const parsed = Number.parseInt(id, 10);

  if (Number.isNaN(parsed)) {
    throw new HttpError(404, 'Book not found');
  }

  return parsed;
}

/**
 * @param {*} value
 * @param {string} field
 * @returns {string}
 */
function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, `${field} is required`);
  }

  return value.trim();
}

/**
 * @param {*} value
 * @returns {number}
 */
function requirePositiveInteger(value) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, 'totalCopies must be a positive integer');
  }

  return value;
}

/**
 * @param {object} payload
 * @returns {import('../repositories/bookRepository').Book}
 */
function createBook(payload) {
  const data = payload || {};

  const title = requireNonEmptyString(data.title, 'title');
  const author = requireNonEmptyString(data.author, 'author');
  const isbn = requireNonEmptyString(data.isbn, 'isbn');
  const totalCopies = requirePositiveInteger(data.totalCopies);

  if (bookRepository.findByIsbn(isbn)) {
    throw new HttpError(409, 'A book with this isbn already exists');
  }

  return bookRepository.create({
    title,
    author,
    isbn,
    totalCopies,
    availableCopies: totalCopies,
  });
}

/**
 * @returns {import('../repositories/bookRepository').Book[]}
 */
function listBooks() {
  return bookRepository.findAll();
}

/**
 * @param {number | string} id
 * @returns {import('../repositories/bookRepository').Book}
 */
function getBook(id) {
  const bookId = parseId(id);
  const book = bookRepository.findById(bookId);

  if (!book) {
    throw new HttpError(404, 'Book not found');
  }

  return book;
}

/**
 * @param {number | string} id
 * @param {object} payload
 * @returns {import('../repositories/bookRepository').Book}
 */
function updateBook(id, payload) {
  const bookId = parseId(id);
  const book = bookRepository.findById(bookId);

  if (!book) {
    throw new HttpError(404, 'Book not found');
  }

  const data = payload || {};
  const patch = {};

  if (data.title !== undefined) {
    patch.title = requireNonEmptyString(data.title, 'title');
  }

  if (data.author !== undefined) {
    patch.author = requireNonEmptyString(data.author, 'author');
  }

  if (data.isbn !== undefined) {
    const isbn = requireNonEmptyString(data.isbn, 'isbn');
    const existing = bookRepository.findByIsbn(isbn);

    if (existing && existing.id !== bookId) {
      throw new HttpError(409, 'A book with this isbn already exists');
    }

    patch.isbn = isbn;
  }

  if (data.totalCopies !== undefined) {
    const totalCopies = requirePositiveInteger(data.totalCopies);
    const copiesOnLoan = book.totalCopies - book.availableCopies;
    const availableCopies = totalCopies - copiesOnLoan;

    if (availableCopies < 0) {
      throw new HttpError(
        409,
        'totalCopies cannot be lower than the number of copies on loan',
      );
    }

    patch.totalCopies = totalCopies;
    patch.availableCopies = availableCopies;
  }

  return bookRepository.update(bookId, patch);
}

/**
 * @param {number | string} id
 * @returns {void}
 */
function deleteBook(id) {
  const bookId = parseId(id);
  const book = bookRepository.findById(bookId);

  if (!book) {
    throw new HttpError(404, 'Book not found');
  }

  if (book.totalCopies - book.availableCopies > 0) {
    throw new HttpError(409, 'Cannot delete a book while copies are on loan');
  }

  bookRepository.remove(bookId);
}

module.exports = {
  createBook,
  listBooks,
  getBook,
  updateBook,
  deleteBook,
};
