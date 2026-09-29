const express = require('express');

const memberStore = require('../store/memberStore');
const ApiError = memberStore.ApiError;
const createMember = memberStore.createMember;
const getAllMembers = memberStore.getAllMembers;
const getMemberById = memberStore.getMemberById;
const borrowBook = memberStore.borrowBook;
const returnBook = memberStore.returnBook;
const getLoansForMember = memberStore.getLoansForMember;

const router = express.Router();

router.post('/', (req, res, next) => {
  try {
    const member = createMember(req.body);
    res.status(201).json(member);
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    return next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const members = getAllMembers();
    res.status(200).json(members);
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const member = getMemberById(req.params.id);
    res.status(200).json(member);
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    return next(err);
  }
});

router.post('/:id/borrow', (req, res, next) => {
  try {
    const result = borrowBook(req.params.id, req.body.bookId);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    return next(err);
  }
});

router.post('/:id/return', (req, res, next) => {
  try {
    const result = returnBook(req.params.id, req.body.bookId);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    return next(err);
  }
});

router.get('/:id/loans', (req, res, next) => {
  try {
    const overdue = req.query.overdue === 'true';
    const loans = getLoansForMember(req.params.id, { overdue });
    res.status(200).json(loans);
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    return next(err);
  }
});

module.exports = router;
