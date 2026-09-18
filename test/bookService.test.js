const {
  createBook,
  listBooks,
  getBookById,
  updateBook,
  deleteBook,
  resetStore,
} = require('../src/services/bookService');

function makeValidBook(overrides = {}) {
  return {
    title: 'Clean Code',
    author: 'Robert C. Martin',
    isbn: '9780132350884',
    totalCopies: 5,
    ...overrides,
  };
}

describe('bookService business rules', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('createBook', () => {
    it('creates a book with availableCopies equal to totalCopies and a generated id', async () => {
      const book = await createBook(makeValidBook());

      expect(book.id).toBeTruthy();
      expect(book.title).toBe('Clean Code');
      expect(book.author).toBe('Robert C. Martin');
      expect(book.isbn).toBe('9780132350884');
      expect(book.totalCopies).toBe(5);
      expect(book.availableCopies).toBe(5);
    });

    it('rejects a duplicate isbn with status 409', async () => {
      await createBook(makeValidBook());

      await expect(createBook(makeValidBook({ title: 'Another Title' }))).rejects.toMatchObject({
        status: 409,
      });
    });

    it('rejects missing title with status 400', async () => {
      await expect(createBook(makeValidBook({ title: undefined }))).rejects.toMatchObject({
        status: 400,
      });
    });

    it('rejects missing author with status 400', async () => {
      await expect(createBook(makeValidBook({ author: undefined }))).rejects.toMatchObject({
        status: 400,
      });
    });

    it('rejects missing isbn with status 400', async () => {
      await expect(createBook(makeValidBook({ isbn: undefined }))).rejects.toMatchObject({
        status: 400,
      });
    });

    it('rejects a totalCopies of 0 or less with status 400', async () => {
      await expect(createBook(makeValidBook({ totalCopies: 0 }))).rejects.toMatchObject({
        status: 400,
      });
    });

    it('rejects a non-integer totalCopies with status 400', async () => {
      await expect(createBook(makeValidBook({ totalCopies: 1.5 }))).rejects.toMatchObject({
        status: 400,
      });
    });
  });

  describe('listBooks / getBookById', () => {
    it('lists all created books', async () => {
      await createBook(makeValidBook({ isbn: 'isbn-1' }));
      await createBook(makeValidBook({ isbn: 'isbn-2', title: 'Second Book' }));

      const books = await listBooks();
      expect(books).toHaveLength(2);
    });

    it('returns a book by id', async () => {
      const created = await createBook(makeValidBook());
      const found = await getBookById(created.id);
      expect(found).toMatchObject({ id: created.id, title: created.title });
    });

    it('returns undefined for a missing id', async () => {
      const found = await getBookById('does-not-exist');
      expect(found).toBeUndefined();
    });
  });

  describe('updateBook', () => {
    it('updates title/author/totalCopies and recomputes availableCopies', async () => {
      const created = await createBook(makeValidBook({ totalCopies: 10 }));

      const updated = await updateBook(created.id, {
        title: 'Updated Title',
        author: 'Updated Author',
        totalCopies: 12,
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.author).toBe('Updated Author');
      expect(updated.totalCopies).toBe(12);
      // no copies were on loan, so availableCopies should track totalCopies
      expect(updated.availableCopies).toBe(12);
    });

    it('preserves copies currently on loan when totalCopies shrinks, without going negative', async () => {
      const created = await createBook(makeValidBook({ totalCopies: 10 }));

      // Simulate 4 copies on loan by directly manipulating internal state via update
      // (borrow/return is out of scope, so we reach this state through the store directly).
      const books = await listBooks();
      const stored = books.find((b) => b.id === created.id);
      stored.availableCopies = 6; // 4 copies on loan

      const updated = await updateBook(created.id, { totalCopies: 5 });

      // 4 copies still on loan, totalCopies is now 5 -> availableCopies should be 1
      expect(updated.totalCopies).toBe(5);
      expect(updated.availableCopies).toBe(1);
    });

    it('rejects an update that would make availableCopies negative', async () => {
      const created = await createBook(makeValidBook({ totalCopies: 10 }));

      const books = await listBooks();
      const stored = books.find((b) => b.id === created.id);
      stored.availableCopies = 2; // 8 copies on loan

      await expect(updateBook(created.id, { totalCopies: 5 })).rejects.toMatchObject({
        status: 400,
      });
    });

    it('rejects an invalid totalCopies with status 400', async () => {
      const created = await createBook(makeValidBook());

      await expect(updateBook(created.id, { totalCopies: 0 })).rejects.toMatchObject({
        status: 400,
      });
    });

    it('rejects updating a missing book with status 404', async () => {
      await expect(updateBook('does-not-exist', { title: 'X' })).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('deleteBook', () => {
    it('deletes a book when no copies are on loan', async () => {
      const created = await createBook(makeValidBook());

      const result = await deleteBook(created.id);
      expect(result).toBe(true);
      expect(await getBookById(created.id)).toBeUndefined();
    });

    it('rejects deletion with status 409 when copies are on loan', async () => {
      const created = await createBook(makeValidBook({ totalCopies: 5 }));

      const books = await listBooks();
      const stored = books.find((b) => b.id === created.id);
      stored.availableCopies = 3; // 2 copies on loan

      await expect(deleteBook(created.id)).rejects.toMatchObject({ status: 409 });
    });

    it('rejects deletion of a missing book with status 404', async () => {
      await expect(deleteBook('does-not-exist')).rejects.toMatchObject({ status: 404 });
    });
  });
});
