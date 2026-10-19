const HttpError = require('../errors/httpError');
const bookRepository = require('../repositories/bookRepository');

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

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

/**
 * @param {{ page?: string | number, pageSize?: string | number }} query
 * @returns {{ page: number, pageSize: number }}
 */
function parsePagination(query) {
  const data = query || {};

  const page = data.page === undefined ? 1 : Number(data.page);
  const pageSize =
    data.pageSize === undefined ? DEFAULT_PAGE_SIZE : Number(data.pageSize);

  if (!Number.isInteger(page) || page < 1) {
    throw new HttpError(
      400,
      'page must be an integer greater than or equal to 1',
    );
  }

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new HttpError(
      400,
      'pageSize must be an integer greater than or equal to 1',
    );
  }

  if (pageSize > MAX_PAGE_SIZE) {
    throw new HttpError(
      400,
      `pageSize must not be greater than ${MAX_PAGE_SIZE}`,
    );
  }

  return { page, pageSize };
}

/**
 * @param {{ q?: string, page?: string | number, pageSize?: string | number }} query
 * @returns {{ data: import('../repositories/bookRepository').Book[], total: number }}
 */
function searchBooks(query) {
  const data = query || {};
  const { page, pageSize } = parsePagination(data);
  const term = typeof data.q === 'string' ? data.q.trim().toLowerCase() : '';

  const matches = bookRepository.findAll().filter((book) => {
    if (term === '') {
      return true;
    }

    return (
      book.title.toLowerCase().includes(term) ||
      book.author.toLowerCase().includes(term)
    );
  });

  const start = (page - 1) * pageSize;

  return {
    data: matches.slice(start, start + pageSize),
    total: matches.length,
  };
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePagination,
  createBook,
  listBooks,
  searchBooks,
  getBook,
  updateBook,
  deleteBook,
};
