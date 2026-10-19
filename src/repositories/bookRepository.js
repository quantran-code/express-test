/**
 * @typedef {Object} Book
 * @property {number} id
 * @property {string} title
 * @property {string} author
 * @property {string} isbn
 * @property {number} totalCopies
 * @property {number} availableCopies
 */

let books = [];
let nextId = 1;

/**
 * @param {{ title: string, author: string, isbn: string, totalCopies: number, availableCopies: number }} data
 * @returns {Book}
 */
function create(data) {
  const book = {
    id: nextId,
    title: data.title,
    author: data.author,
    isbn: data.isbn,
    totalCopies: data.totalCopies,
    availableCopies: data.availableCopies,
  };

  nextId += 1;
  books.push(book);

  return book;
}

/**
 * @returns {Book[]}
 */
function findAll() {
  return books.slice();
}

/**
 * @param {number} id
 * @returns {Book | undefined}
 */
function findById(id) {
  return books.find((book) => book.id === id);
}

/**
 * @param {string} isbn
 * @returns {Book | undefined}
 */
function findByIsbn(isbn) {
  return books.find((book) => book.isbn === isbn);
}

/**
 * @param {number} id
 * @param {Partial<Book>} patch
 * @returns {Book | undefined}
 */
function update(id, patch) {
  const book = findById(id);

  if (!book) {
    return undefined;
  }

  Object.assign(book, patch);

  return book;
}

/**
 * @param {number} id
 * @returns {boolean}
 */
function remove(id) {
  const index = books.findIndex((book) => book.id === id);

  if (index === -1) {
    return false;
  }

  books.splice(index, 1);

  return true;
}

/**
 * @returns {void}
 */
function reset() {
  books = [];
  nextId = 1;
}

module.exports = {
  create,
  findAll,
  findById,
  findByIsbn,
  update,
  remove,
  reset,
};
