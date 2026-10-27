const store = {};
const MMKV = jest.fn().mockImplementation(() => ({
  set: jest.fn((key, value) => { store[key] = value; }),
  getString: jest.fn((key) => store[key]),
  getNumber: jest.fn((key) => store[key]),
  getBoolean: jest.fn((key) => store[key]),
  delete: jest.fn((key) => { delete store[key]; }),
  contains: jest.fn((key) => key in store),
  clearAll: jest.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
}));

module.exports = { MMKV, createMMKV: jest.fn(() => new MMKV()) };
