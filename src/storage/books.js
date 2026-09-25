let books = [];
let nextId = 1;

function getAllBooks() {
  return books;
}

function getBookById(id) {
  return books.find((book) => book.id === id);
}

function findBookByIsbn(isbn, excludeId) {
  return books.find((book) => book.isbn === isbn && book.id !== excludeId);
}

function createBookRecord(data) {
  const { title, author, isbn, totalCopies } = data;
  const book = {
    id: nextId,
    title,
    author,
    isbn,
    totalCopies,
    availableCopies: totalCopies,
  };
  nextId += 1;
  books.push(book);
  return book;
}

function deleteBookRecord(id) {
  const index = books.findIndex((book) => book.id === id);
  if (index === -1) {
    return false;
  }
  books.splice(index, 1);
  return true;
}

module.exports = {
  getAllBooks,
  getBookById,
  findBookByIsbn,
  createBookRecord,
  deleteBookRecord,
};
