let members = [];
let nextId = 1;

function getAllMembers() {
  return members;
}

function getMemberById(id) {
  // eslint-disable-next-line eqeqeq
  return members.find((member) => member.id == id);
}

function findMemberByEmail(email, excludeId) {
  return members.find((member) => member.email === email && member.id !== excludeId);
}

function createMemberRecord(data) {
  const { name, email, role, passwordHash } = data;
  const member = {
    id: nextId,
    name,
    email,
    role,
    passwordHash: passwordHash === undefined ? null : passwordHash,
  };
  nextId += 1;
  members.push(member);
  return member;
}

function deleteMemberRecord(id) {
  const index = members.findIndex((member) => member.id === id);
  if (index === -1) {
    return false;
  }
  members.splice(index, 1);
  return true;
}

module.exports = {
  getAllMembers,
  getMemberById,
  findMemberByEmail,
  createMemberRecord,
  deleteMemberRecord,
};
