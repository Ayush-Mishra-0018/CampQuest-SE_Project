module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  verbose: true,
  collectCoverage: false,
  testTimeout: 30000,
  testMatch: [
    '**/tests/**/*.test.js'
  ]
};
