module.exports = {
  roots: ['<rootDir>/tests'],
  verbose: true,
  collectCoverage: false,
  testTimeout: 30000,

  projects: [
    {
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: ['**/tests/**/*.test.js'],
      testPathIgnorePatterns: [
        '/tests/unit/public/',
      ],
    },
    {
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      testMatch: [
        '**/tests/unit/public/**/*.test.js',
      ],
    },
  ],
};
