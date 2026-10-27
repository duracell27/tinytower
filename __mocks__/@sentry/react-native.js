module.exports = {
  captureMessage: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setExtra: jest.fn(),
  withScope: jest.fn((fn) => fn({ setExtra: jest.fn(), setTag: jest.fn() })),
  init: jest.fn(),
};
