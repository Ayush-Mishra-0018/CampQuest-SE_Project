# Integration Tests Documentation

## Overview

This directory contains comprehensive integration tests for the YelpCamp application. Integration tests verify that different components of the application work together correctly, including database operations, user authentication, and data relationships.

## Test Structure

```
tests/
├── integration/
│   ├── setup.js                        # Test database setup and utilities
│   ├── user.lifecycle.test.js          # User authentication flow tests
│   ├── review.flow.test.js             # Review attachment and rating tests
│   └── cascade.deletion.test.js        # Cascade deletion tests
└── unit/
    └── models/                          # Unit tests for models
```

## Test Suites

### 1. User Lifecycle Tests (`user.lifecycle.test.js`)

Tests the complete user authentication flow from registration to logout.

**Test Scenarios:**
- ✅ User Registration
  - Register new users successfully
  - Prevent duplicate usernames
  - Prevent duplicate emails
  
- ✅ User Login
  - Login with correct credentials
  - Reject incorrect passwords
  - Reject non-existent usernames
  
- ✅ Session Persistence
  - Maintain session after registration
  - Maintain session after login
  - Verify unauthenticated state
  
- ✅ User Logout
  - Logout and clear session
  
- ✅ Complete User Lifecycle
  - Full flow: Register → Login → Session → Logout

### 2. Review Attachment Flow Tests (`review.flow.test.js`)

Tests the complete flow of creating campgrounds, attaching reviews, and calculating ratings.

**Test Scenarios:**
- ✅ Background (Campground) Creation
  - Create new campgrounds
  - Create multiple campgrounds
  
- ✅ Review Addition
  - Add reviews to campgrounds
  - Add multiple reviews from different users
  - Validate rating ranges (0-5)
  
- ✅ Populate Reviews
  - Populate reviews with full details
  - Populate nested owner information
  
- ✅ Rating Aggregation
  - Calculate average ratings
  - Handle single review ratings
  - Calculate rating statistics (min, max, average)
  
- ✅ Complete Flow
  - Full flow: Create Background → Add Reviews → Populate → Calculate Rating
  - Handle campgrounds with no reviews

### 3. Cascade Deletion Tests (`cascade.deletion.test.js`)

Tests that deleting campgrounds properly cleans up associated reviews while preserving unrelated data.

**Test Scenarios:**
- ✅ Delete Background with Reviews
  - Delete campground and all its reviews
  - Handle multiple reviews deletion
  - Handle deletion with no reviews
  
- ✅ Orphan Cleanup Verification
  - Only delete reviews belonging to deleted campground
  - Ensure no orphaned reviews remain
  
- ✅ Verify Unaffected Reviews
  - Preserve reviews from other campgrounds
  - Maintain data integrity after multiple deletions
  
- ✅ Complete Cascade Deletion Flow
  - Full flow: Create → Add Reviews → Delete → Verify Cleanup
  - Handle edge cases (same user, multiple reviews)

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Only Unit Tests
```bash
npm run test:unit
```

### Run Only Integration Tests
```bash
npm run test:integration
```

### Run Specific Test File
```bash
npx jest tests/integration/user.lifecycle.test.js
```

### Run with Coverage
```bash
npx jest --coverage
```

## Test Database Setup

Integration tests use **MongoDB Memory Server** to create an in-memory database for each test run. This provides:

- ✅ Fast test execution
- ✅ Isolation between tests
- ✅ No dependency on external database
- ✅ Automatic cleanup after tests

### Setup Process:

1. **Before All Tests** (`beforeAll`):
   - Create in-memory MongoDB instance
   - Connect Mongoose to test database

2. **Before Each Test** (`beforeEach`):
   - Clear all collections
   - Create fresh test data

3. **After All Tests** (`afterAll`):
   - Drop all collections
   - Disconnect from database
   - Stop MongoDB Memory Server

## Key Features

### 1. Session Management with Supertest

The user lifecycle tests use `request.agent()` from supertest to persist cookies across requests, simulating a real browser session:

```javascript
const agent = request.agent(app);
await agent.post('/register').send(userData);
await agent.get('/profile'); // Session persists
```

### 2. Mongoose Middleware Testing

Cascade deletion tests verify that Mongoose post-middleware (`findOneAndDelete`) properly cleans up related documents:

```javascript
backgroundschema.post("findOneAndDelete", async function(camp){
    if(camp.review && camp.review.length){
        await Review.deleteMany({_id:{$in:camp.review}});
    }
});
```

### 3. Data Population Testing

Tests verify that Mongoose populate works correctly for nested relationships:

```javascript
const campground = await Background.findById(id)
    .populate('author')
    .populate({
        path: 'review',
        populate: { path: 'owner' }
    });
```

## Dependencies

```json
{
  "jest": "^29.7.0",
  "mongodb-memory-server": "^10.3.0",
  "supertest": "^7.0.0"
}
```

## Configuration

### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  verbose: true,
  collectCoverage: false,
  testTimeout: 30000,
  testMatch: ['**/tests/**/*.test.js']
};
```

## Test Results

All integration tests pass successfully:

```
Test Suites: 3 passed, 3 total
Tests:       32 passed, 32 total
Time:        ~2-3 seconds
```

## Best Practices

1. **Isolation**: Each test is independent and doesn't rely on other tests
2. **Cleanup**: Database is cleared before each test
3. **Realistic**: Tests simulate real user interactions
4. **Comprehensive**: Tests cover happy paths and edge cases
5. **Fast**: In-memory database ensures quick execution

## Troubleshooting

### Tests Timing Out
If tests timeout, increase the timeout in `jest.config.js`:
```javascript
testTimeout: 30000 // 30 seconds
```

### Database Connection Issues
Ensure MongoDB Memory Server is properly installed:
```bash
npm install mongodb-memory-server --save-dev
```

### Session Not Persisting
Make sure you're using `request.agent()` instead of `request()` for session tests.

## Future Enhancements

- Add API endpoint integration tests
- Add error handling tests
- Add performance tests
- Add test coverage reporting
- Add database transaction tests

## Contributing

When adding new integration tests:
1. Follow existing test structure
2. Use descriptive test names
3. Clean up test data properly
4. Document complex test scenarios
5. Ensure tests are independent

## Contact

For questions or issues with integration tests, please open an issue on the repository.
