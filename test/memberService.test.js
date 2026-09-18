function makeValidMember(overrides = {}) {
  return {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    ...overrides,
  };
}

let memberService;

describe('memberService', () => {
  beforeEach(() => {
    vi.resetModules();
    // eslint-disable-next-line global-require
    memberService = require('../src/services/memberService');
    memberService.resetMembers();
  });

  describe('createMember', () => {
    it('sets fields and timestamps', () => {
      const member = memberService.createMember(makeValidMember());
      expect(member.id).toBeDefined();
      expect(member.name).toBe('Ada Lovelace');
      expect(member.email).toBe('ada@example.com');
      expect(typeof member.createdAt).toBe('string');
      expect(typeof member.updatedAt).toBe('string');
    });

    it('rejects a missing/empty name with a 400-flavoured error', () => {
      expect(() => memberService.createMember(makeValidMember({ name: '' }))).toThrow();
      try {
        memberService.createMember(makeValidMember({ name: '' }));
        throw new Error('expected createMember to throw');
      } catch (err) {
        expect(err.status).toBe(400);
      }
    });

    it('rejects a missing/empty email with a 400-flavoured error', () => {
      try {
        memberService.createMember(makeValidMember({ email: '   ' }));
        throw new Error('expected createMember to throw');
      } catch (err) {
        expect(err.status).toBe(400);
      }
    });

    it('rejects a duplicate email (after trimming whitespace) with a 409-flavoured error', () => {
      memberService.createMember(makeValidMember({ email: ' 123@example.com ' }));
      try {
        memberService.createMember(makeValidMember({ email: '123@example.com' }));
        throw new Error('expected createMember to throw');
      } catch (err) {
        expect(err.status).toBe(409);
      }
    });
  });

  describe('listMembers', () => {
    it('returns every member that has been created', () => {
      memberService.createMember(makeValidMember({ email: 'a@example.com' }));
      memberService.createMember(makeValidMember({ email: 'b@example.com' }));
      expect(memberService.listMembers().length).toBe(2);
    });
  });

  describe('getMemberById', () => {
    it('returns the matching member', () => {
      const created = memberService.createMember(makeValidMember());
      const found = memberService.getMemberById(created.id);
      expect(found.id).toBe(created.id);
    });

    it('returns undefined (without throwing) for an unknown id', () => {
      expect(memberService.getMemberById('missing-id')).toBeUndefined();
    });
  });

  describe('updateMember', () => {
    it('updates only the fields provided', () => {
      const created = memberService.createMember(makeValidMember());
      const updated = memberService.updateMember(created.id, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
      expect(updated.email).toBe(created.email);
    });

    it('throws a 404-flavoured error when the member does not exist', () => {
      try {
        memberService.updateMember('missing-id', { name: 'x' });
        throw new Error('expected updateMember to throw');
      } catch (err) {
        expect(err.status).toBe(404);
      }
    });

    it('rejects a duplicate email update with a 409-flavoured error', () => {
      const m1 = memberService.createMember(makeValidMember({ email: 'one@example.com' }));
      const m2 = memberService.createMember(makeValidMember({ email: 'two@example.com' }));

      try {
        memberService.updateMember(m2.id, { email: m1.email });
        throw new Error('expected updateMember to throw');
      } catch (err) {
        expect(err.status).toBe(409);
      }
    });

    it('rejects invalid supplied fields with a 400-flavoured error', () => {
      const created = memberService.createMember(makeValidMember());
      try {
        memberService.updateMember(created.id, { email: '   ' });
        throw new Error('expected updateMember to throw');
      } catch (err) {
        expect(err.status).toBe(400);
      }
    });
  });

  describe('deleteMember', () => {
    it('removes the member and returns true', () => {
      const created = memberService.createMember(makeValidMember());
      const result = memberService.deleteMember(created.id);
      expect(result).toBe(true);
      expect(memberService.getMemberById(created.id)).toBeUndefined();
    });

    it('throws a 404-flavoured error when the member does not exist', () => {
      try {
        memberService.deleteMember('missing-id');
        throw new Error('expected deleteMember to throw');
      } catch (err) {
        expect(err.status).toBe(404);
      }
    });
  });
});
