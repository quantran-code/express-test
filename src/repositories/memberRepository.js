/**
 * @typedef {Object} Member
 * @property {number} id
 * @property {string} name
 * @property {string} email
 */

let members = [];
let nextId = 1;

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeForLookup(value) {
  return String(value).trim().toLowerCase();
}

/**
 * @param {{ name: string, email: string }} data
 * @returns {Member}
 */
function create(data) {
  const member = {
    id: nextId,
    name: data.name,
    email: data.email,
  };

  nextId += 1;
  members.push(member);

  return member;
}

/**
 * @returns {Member[]}
 */
function findAll() {
  return members.slice();
}

/**
 * @param {number} id
 * @returns {Member | undefined}
 */
function findById(id) {
  return members.find((member) => member.id === id);
}

/**
 * @param {string} email
 * @returns {Member | undefined}
 */
function findByEmail(email) {
  const target = normalizeForLookup(email);

  return members.find((member) => normalizeForLookup(member.email) === target);
}

/**
 * @param {number} id
 * @param {Partial<Member>} patch
 * @returns {Member | undefined}
 */
function update(id, patch) {
  const member = findById(id);

  if (!member) {
    return undefined;
  }

  Object.assign(member, patch);

  return member;
}

/**
 * @param {number} id
 * @returns {boolean}
 */
function remove(id) {
  const index = members.findIndex((member) => member.id === id);

  if (index === -1) {
    return false;
  }

  members.splice(index, 1);

  return true;
}

/**
 * @returns {void}
 */
function reset() {
  members = [];
  nextId = 1;
}

module.exports = {
  create,
  findAll,
  findById,
  findByEmail,
  update,
  remove,
  reset,
};
