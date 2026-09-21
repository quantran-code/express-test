const bookService = require('../src/services/bookService');

describe('bookService on-loan guards', () => {
  it('updateBook throws 400 when recomputed availableCopies would be negative (400)', () => {
    const created = bookService.createBook({
      title: 'OnLoan',
      author: 'Loan Author',
      isbn: 'LOAN1',
      totalCopies: 5,
    });

    // Simulate copies on loan: availableCopies < totalCopies
    const liveRef = bookService.getBookById(created.id);
    liveRef.availableCopies = 1; // onLoan = 4

    const err = (() => {
      try {
        bookService.updateBook(created.id, { totalCopies: 3 }); // newAvailableCopies = 3 - 4 = -1
      } catch (e) {
        return e;
      }
    })();

    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(400);
  });

  it('deleteBook throws 409 when copies are on loan (409)', () => {
    const created = bookService.createBook({
      title: 'DeleteOnLoan',
      author: 'Loan Author',
      isbn: 'LOAN2',
      totalCopies: 4,
    });

    const liveRef = bookService.getBookById(created.id);
    liveRef.availableCopies = 2; // onLoan = 2

    const err = (() => {
      try {
        bookService.deleteBook(created.id);
      } catch (e) {
        return e;
      }
    })();

    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(409);
  });
});
