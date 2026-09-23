let books = [];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function createError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
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

  const existing = books.find((b) => b.isbn === isbn);
  if (existing) {
    throw createError('isbn already exists', 409);
  }

  const book = {
    id: String(Date.now() + Math.random()),
    title: title.trim(),
    author: author.trim(),
    isbn: isbn.trim(),
    totalCopies,
    availableCopies: totalCopies,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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

    // keep within invariants: if onLoan is computed correctly, availableCopies will never exceed totalCopies
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
