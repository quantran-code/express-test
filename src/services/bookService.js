let books = [];
let nextId = 1;

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

  const trimmedIsbn = isbn.trim();
  const duplicate = books.find((book) => book.isbn === trimmedIsbn);
  if (duplicate) {
    throw createError('isbn must be unique', 400);
  }

  const book = {
    id: nextId,
    title: title.trim(),
    author: author.trim(),
    isbn: trimmedIsbn,
    totalCopies,
    availableCopies: totalCopies,
  };

  nextId += 1;
  books.push(book);

  return book;
}

function listBooks() {
  return books;
}

function getBookById(id) {
  // eslint-disable-next-line eqeqeq
  return books.find((book) => book.id == id);
}

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

    book.totalCopies = totalCopies;
    book.availableCopies = newAvailableCopies;
  }

  return book;
}

function deleteBook(id) {
  const book = getBookById(id);
  if (!book) {
    throw createError('Book not found', 404);
  }

  const onLoan = book.totalCopies - book.availableCopies;
  if (onLoan > 0) {
    throw createError('Cannot delete a book while copies are on loan', 409);
  }

  books = books.filter((b) => b.id !== book.id);
}

module.exports = {
  createBook,
  listBooks,
  getBookById,
  updateBook,
  deleteBook,
};
