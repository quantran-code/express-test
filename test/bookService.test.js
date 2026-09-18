function makeValidBook(overrides = {}) {
  return {
    title: 'Clean Code',
    author: 'Robert C. Martin',
    isbn: '9780132350884',
    totalCopies: 5,
    ...overrides,
  };
}

let bookService;

describe('bookService', () => {
  beforeEach(() => {
    vi.resetModules();
    // eslint-disable-next-line global-require
    bookService = require('../src/services/bookService');
    bookService.resetBooks();
  });

  describe('createBook', () => {
    it('sets availableCopies to totalCopies', () => {
      const book = bookService.createBook(makeValidBook());
      expect(book.id).toBeDefined();
      expect(book.availableCopies).toBe(book.totalCopies);
    });

    it('rejects a missing/empty title with a 400-flavoured error', () => {
      expect(() => bookService.createBook(makeValidBook({ title: '' }))).toThrow();
      try {
        bookService.createBook(makeValidBook({ title: '' }));
        throw new Error('expected createBook to throw');
      } catch (err) {
        expect(err.status).toBe(400);
      }
    });

    it('rejects a missing/empty author with a 400-flavoured error', () => {
      try {
        bookService.createBook(makeValidBook({ author: '   ' }));
        throw new Error('expected createBook to throw');
      } catch (err) {
        expect(err.status).toBe(400);
      }
    });

    it('rejects a non-positive totalCopies with a 400-flavoured error', () => {
      try {
        bookService.createBook(makeValidBook({ totalCopies: 0 }));
        throw new Error('expected createBook to throw');
      } catch (err) {
        expect(err.status).toBe(400);
      }
    });

    it('rejects a non-integer totalCopies with a 400-flavoured error', () => {
      try {
        bookService.createBook(makeValidBook({ totalCopies: 2.5 }));
        throw new Error('expected createBook to throw');
      } catch (err) {
        expect(err.status).toBe(400);
      }
    });

    it('rejects a duplicate isbn (after trimming whitespace) with a 409-flavoured error', () => {
      bookService.createBook(makeValidBook({ isbn: ' 123-456 ' }));
      try {
        bookService.createBook(makeValidBook({ isbn: '123-456' }));
        throw new Error('expected createBook to throw');
      } catch (err) {
        expect(err.status).toBe(409);
      }
    });
  });

  describe('listBooks', () => {
    it('returns every book that has been created', () => {
      bookService.createBook(makeValidBook({ isbn: 'a' }));
      bookService.createBook(makeValidBook({ isbn: 'b' }));
      expect(bookService.listBooks().length).toBe(2);
    });
  });

  describe('getBookById', () => {
    it('returns the matching book', () => {
      const created = bookService.createBook(makeValidBook());
      const found = bookService.getBookById(created.id);
      expect(found.id).toBe(created.id);
    });

    it('returns undefined (without throwing) for an unknown id', () => {
      expect(bookService.getBookById('missing-id')).toBeUndefined();
    });
  });

  describe('updateBook', () => {
    it('updates only the fields provided, leaving availableCopies unchanged when totalCopies is omitted', () => {
      const created = bookService.createBook(makeValidBook());
      const updated = bookService.updateBook(created.id, { title: 'New Title' });
      expect(updated.title).toBe('New Title');
      expect(updated.author).toBe(created.author);
      expect(updated.totalCopies).toBe(created.totalCopies);
      expect(updated.availableCopies).toBe(created.availableCopies);
    });

    it('recomputes availableCopies while preserving copies already on loan when totalCopies changes', () => {
      const created = bookService.createBook(makeValidBook({ totalCopies: 5 }));
      const book = bookService.getBookById(created.id);
      // simulate 2 copies currently on loan
      book.availableCopies = 3;

      const updated = bookService.updateBook(created.id, { totalCopies: 4 });
      expect(updated.totalCopies).toBe(4);
      expect(updated.availableCopies).toBe(2);
    });

    it('rejects a totalCopies change that would drive availableCopies negative', () => {
      const created = bookService.createBook(makeValidBook({ totalCopies: 5 }));
      const book = bookService.getBookById(created.id);
      // simulate 4 copies currently on loan
      book.availableCopies = 1;

      try {
        bookService.updateBook(created.id, { totalCopies: 2 });
        throw new Error('expected updateBook to throw');
      } catch (err) {
        expect(err.status).toBe(400);
      }

      // state must be unchanged after the rejected update
      expect(bookService.getBookById(created.id).availableCopies).toBe(1);
      expect(bookService.getBookById(created.id).totalCopies).toBe(5);
    });

    it('throws a 404-flavoured error when the book does not exist', () => {
      try {
        bookService.updateBook('missing-id', { title: 'x' });
        throw new Error('expected updateBook to throw');
      } catch (err) {
        expect(err.status).toBe(404);
      }
    });
  });

  describe('deleteBook', () => {
    it('removes the book and returns true when no copies are on loan', () => {
      const created = bookService.createBook(makeValidBook());
      const result = bookService.deleteBook(created.id);
      expect(result).toBe(true);
      expect(bookService.getBookById(created.id)).toBeUndefined();
    });

    it('rejects deletion with a 409-flavoured error when copies are on loan', () => {
      const created = bookService.createBook(makeValidBook());
      const book = bookService.getBookById(created.id);
      book.availableCopies = created.totalCopies - 1;

      try {
        bookService.deleteBook(created.id);
        throw new Error('expected deleteBook to throw');
      } catch (err) {
        expect(err.status).toBe(409);
      }

      expect(bookService.getBookById(created.id)).toBeDefined();
    });

    it('throws a 404-flavoured error when the book does not exist', () => {
      try {
        bookService.deleteBook('missing-id');
        throw new Error('expected deleteBook to throw');
      } catch (err) {
        expect(err.status).toBe(404);
      }
    });
  });
});
