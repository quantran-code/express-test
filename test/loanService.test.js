function makeValidMember(overrides = {}) {
  return {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    ...overrides,
  };
}

function makeValidBook(overrides = {}) {
  return {
    title: 'Clean Code',
    author: 'Robert C. Martin',
    isbn: '9780132350884',
    totalCopies: 5,
    ...overrides,
  };
}

let memberService;
let bookService;
let loanService;

describe('loanService', () => {
  beforeEach(() => {
    vi.resetModules();
    // eslint-disable-next-line global-require
    memberService = require('../src/services/memberService');
    // eslint-disable-next-line global-require
    bookService = require('../src/services/bookService');
    // eslint-disable-next-line global-require
    loanService = require('../src/services/loanService');

    memberService.resetMembers();
    bookService.resetBooks();
    loanService.resetLoans();
  });

  describe('createLoan', () => {
    it('rejects when memberId or bookId missing with 400', () => {
      try {
        loanService.createLoan({ memberId: 'm1' });
        throw new Error('expected createLoan to throw');
      } catch (err) {
        expect(err.status).toBe(400);
      }
    });

    it('rejects unknown member with 404', () => {
      const createdBook = bookService.createBook(makeValidBook({ isbn: 'm-book' }));
      try {
        loanService.createLoan({ memberId: 'missing', bookId: createdBook.id });
        throw new Error('expected createLoan to throw');
      } catch (err) {
        expect(err.status).toBe(404);
        expect(err.message).toBe('Member not found');
      }
    });

    it('rejects unknown book with 404', () => {
      const createdMember = memberService.createMember(makeValidMember({ email: 'm1@example.com' }));
      try {
        loanService.createLoan({ memberId: createdMember.id, bookId: 'missing-book' });
        throw new Error('expected createLoan to throw');
      } catch (err) {
        expect(err.status).toBe(404);
        expect(err.message).toBe('Book not found');
      }
    });

    it('rejects when the book already has an active loan with 409 BOOK_ALREADY_BORROWED', () => {
      const member1 = memberService.createMember(makeValidMember({ email: 'm1@example.com' }));
      const member2 = memberService.createMember(makeValidMember({ email: 'm2@example.com' }));
      const book = bookService.createBook(makeValidBook({ isbn: 'b1' }));

      const loan1 = loanService.createLoan({ memberId: member1.id, bookId: book.id });
      expect(loan1.status).toBe('active');

      try {
        loanService.createLoan({ memberId: member2.id, bookId: book.id });
        throw new Error('expected createLoan to throw');
      } catch (err) {
        expect(err.status).toBe(409);
        expect(err.message).toBe('BOOK_ALREADY_BORROWED');
      }
    });

    it('rejects when member loan cap reached with 409 MEMBER_LOAN_LIMIT_REACHED', () => {
      const member = memberService.createMember(makeValidMember({ email: 'm1@example.com' }));

      const b1 = bookService.createBook(makeValidBook({ isbn: 'b1' }));
      const b2 = bookService.createBook(makeValidBook({ isbn: 'b2' }));
      const b3 = bookService.createBook(makeValidBook({ isbn: 'b3' }));
      const b4 = bookService.createBook(makeValidBook({ isbn: 'b4' }));

      loanService.createLoan({ memberId: member.id, bookId: b1.id });
      loanService.createLoan({ memberId: member.id, bookId: b2.id });
      loanService.createLoan({ memberId: member.id, bookId: b3.id });

      try {
        loanService.createLoan({ memberId: member.id, bookId: b4.id });
        throw new Error('expected createLoan to throw');
      } catch (err) {
        expect(err.status).toBe(409);
        expect(err.message).toBe('MEMBER_LOAN_LIMIT_REACHED');
      }
    });

    it('creates an active loan on success', () => {
      const member = memberService.createMember(makeValidMember({ email: 'm1@example.com' }));
      const book = bookService.createBook(makeValidBook({ isbn: 'b1' }));

      const loan = loanService.createLoan({ memberId: member.id, bookId: book.id });
      expect(loan.status).toBe('active');
      expect(loan.borrowedAt).toBeDefined();
      expect(loan.returnedAt).toBeNull();
    });
  });

  describe('returnLoan', () => {
    it('sets returnedAt and status, and is idempotent', () => {
      const member = memberService.createMember(makeValidMember({ email: 'm1@example.com' }));
      const book = bookService.createBook(makeValidBook({ isbn: 'b1' }));

      const loan = loanService.createLoan({ memberId: member.id, bookId: book.id });
      const first = loanService.returnLoan(loan.id);
      expect(first.status).toBe('returned');
      expect(first.returnedAt).toBeDefined();

      const second = loanService.returnLoan(loan.id);
      expect(second.status).toBe('returned');
      expect(second.returnedAt).toBe(first.returnedAt);
    });

    it('throws 404 when loan does not exist', () => {
      try {
        loanService.returnLoan('missing');
        throw new Error('expected returnLoan to throw');
      } catch (err) {
        expect(err.status).toBe(404);
      }
    });
  });
});
