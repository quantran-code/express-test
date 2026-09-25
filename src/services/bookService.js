const {
  getAllBooks,
  getBookById,
  findBookByIsbn,
  createBookRecord,
  deleteBookRecord,
} = require('../storage/books');

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

  if (findBookByIsbn(isbn)) {
    throw createError('ISBN already exists', 409);
  }

  return createBookRecord({
    title: title.trim(),
    author: author.trim(),
    isbn: isbn.trim(),
    totalCopies,
  });
}

function listBooks() {
  return getAllBooks();
}

function getBook(id) {
  const book = getBookById(id);
  if (!book) {
    throw createError('Book not found', 404);
  }
  return book;
}

function updateBook(id, data) {
  const book = getBook(id);

  const { title, author, isbn, totalCopies } = data || {};

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

  if (isbn !== undefined) {
    if (!isNonEmptyString(isbn)) {
      throw createError('isbn must be a non-empty string', 400);
    }
    if (findBookByIsbn(isbn, book.id)) {
      throw createError('ISBN already exists', 409);
    }
    book.isbn = isbn.trim();
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

  return book;
}

function deleteBook(id) {
  const book = getBook(id);

  if (book.availableCopies < book.totalCopies) {
    throw createError('Cannot delete a book while copies are on loan', 409);
  }

  deleteBookRecord(id);
}

module.exports = {
  createError,
  createBook,
  listBooks,
  getBook,
  updateBook,
  deleteBook,
};
