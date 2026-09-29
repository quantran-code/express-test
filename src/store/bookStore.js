class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let nextId = 1;

// In-memory storage for books
// Book shape (internal): { id, title, author, isbn, totalCopies, availableCopies, onLoanCopies }
const booksById = new Map();
const booksByIsbn = new Map();

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertRequiredNonEmptyString(value, fieldName) {
  if (!isNonEmptyString(value)) {
    throw new ApiError(400, `${fieldName} is required`);
  }
}

function assertIntegerGreaterThan(value, fieldName, minExclusive) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= minExclusive) {
    throw new ApiError(400, `${fieldName} must be an integer > ${minExclusive}`);
  }
}

function serializeBook(book) {
  const { onLoanCopies, ...rest } = book;
  return rest;
}

function createBook(input) {
  const { title, author, isbn, totalCopies } = input || {};

  assertRequiredNonEmptyString(title, 'title');
  assertRequiredNonEmptyString(author, 'author');
  assertRequiredNonEmptyString(isbn, 'isbn');
  assertIntegerGreaterThan(totalCopies, 'totalCopies', 0);

  if (booksByIsbn.has(isbn)) {
    throw new ApiError(400, 'isbn must be unique');
  }

  const id = String(nextId++);
  const availableCopies = totalCopies;
  const onLoanCopies = 0;

  const book = {
    id,
    title: title.trim(),
    author: author.trim(),
    isbn: isbn.trim(),
    totalCopies,
    availableCopies,
    onLoanCopies,
  };

  booksById.set(id, book);
  booksByIsbn.set(book.isbn, id);

  return serializeBook(book);
}

function getAllBooks() {
  return Array.from(booksById.values()).map(serializeBook);
}

function getBookById(id) {
  const book = booksById.get(String(id));
  if (!book) {
    throw new ApiError(404, 'Book not found');
  }
  return serializeBook(book);
}

function updateBook(id, input) {
  const book = booksById.get(String(id));
  if (!book) {
    throw new ApiError(404, 'Book not found');
  }

  const { title, author, isbn, totalCopies } = input || {};

  if (isbn !== undefined) {
    throw new ApiError(400, 'isbn is immutable');
  }

  if (title !== undefined) {
    assertRequiredNonEmptyString(title, 'title');
    book.title = title.trim();
  }

  if (author !== undefined) {
    assertRequiredNonEmptyString(author, 'author');
    book.author = author.trim();
  }

  if (totalCopies !== undefined) {
    assertIntegerGreaterThan(totalCopies, 'totalCopies', 0);

    const newTotalCopies = totalCopies;
    const newAvailableCopies = newTotalCopies - book.onLoanCopies;

    if (newAvailableCopies < 0 || newAvailableCopies > newTotalCopies) {
      throw new ApiError(400, 'availableCopies would be invalid');
    }

    book.totalCopies = newTotalCopies;
    book.availableCopies = newAvailableCopies;
  }

  return serializeBook(book);
}

function deleteBook(id) {
  const book = booksById.get(String(id));
  if (!book) {
    throw new ApiError(404, 'Book not found');
  }

  if (book.onLoanCopies > 0) {
    throw new ApiError(409, 'Cannot delete book with copies on loan');
  }

  booksById.delete(String(id));
  booksByIsbn.delete(book.isbn);
}

function setOnLoanCopies(id, count) {
  const book = booksById.get(String(id));
  if (!book) {
    throw new ApiError(404, 'Book not found');
  }

  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new ApiError(400, 'onLoanCopies must be a non-negative integer');
  }

  // Keep bookkeeping consistent with business rules
  if (count > book.totalCopies) {
    throw new ApiError(400, 'onLoanCopies cannot exceed totalCopies');
  }

  book.onLoanCopies = count;
  book.availableCopies = book.totalCopies - book.onLoanCopies;
}

module.exports = {
  ApiError,
  createBook,
  getAllBooks,
  getBookById,
  updateBook,
  deleteBook,
  setOnLoanCopies,
};
