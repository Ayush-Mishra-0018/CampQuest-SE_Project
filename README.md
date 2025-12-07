# CampQuest – Overview

## 👥 Team Details

- **Team Name:** Team404
- **Members:**
  - Kartikeya Dimri (IMT2023126)
  - Ayush Mishra (IMT2023129)
  - Harsh Sinha (IMT2023571)
  - Santhosh Vodnala (IMT2023622)

---

## 🧾 Project Summary

CampQuest is a full-stack campground listing application (inspired by YelpCamp). The backend exposes functionality for:

- Managing campgrounds (create, view, edit, delete).
- Adding and managing reviews for campgrounds.
- User registration, login, and secure session management.
- Authorization so that only owners can edit/delete their own campgrounds and reviews.
- Server-side validation and centralized error handling.

The frontend uses EJS templates rendered from this backend, with Bootstrap-based styling and custom CSS.

---

## 📁 Repository Structure

```text
  .env                  # Environment variables (MongoDB URI)
  node_modules/         # Project dependencies
  index.js              # Main Express application entry point
  jest.config.js        # Jest configuration for tests
  middleware.js         # Custom authentication & authorization middleware
  schema.js             # Joi validation schemas
  package.json          # Project scripts and dependencies
  Controllers/
    campground.js       # Campground CRUD controllers
    review.js           # Review CRUD controllers
    user.js             # Authentication-related controllers
  helper/
    ExpressError.js     # Custom error class
    WrapError.js        # Async error wrapper
  Models/
    Background.js       # Campground model (location, price, author, etc.)
    review.js           # Review model
    User.js             # User model (authentication)
  Routers/
    campground.js       # Routes for campgrounds
    review.js           # Routes for reviews
    user.js             # Routes for auth (login/register)
  public/
    css/                # Styling (Bootstrap + custom CSS)
    script/
      validateform.js   # Client-side Bootstrap-style form validation
  Seeds/
    cities.js
    seed.js
    seedhelper.js       # Utilities to seed dummy campgrounds data
  tests/
    unit/
      helper/           # Unit tests for helper utilities (error/wrap)
      models/           # Unit tests for Mongoose models
      public/           # Unit tests for client-side validation script
      middleware.test.js# Unit tests for custom middleware
  views/
    layouts/            # Base layout templates
    partials/           # Navbar, footer, flash messages
    campgrounds/        # Campground-related views
    User/               # Login and registration views
    errors.ejs          # Generic error view

```

---

## 🧪 Testing Overview

We use **Jest** for comprehensive testing across unit and integration test suites.

### Unit Tests (`tests/unit/**`)

- `tests/unit/helper/` – Verifies behavior of helper utilities like `ExpressError` and `WrapError` (correct error shape and async error handling).
- `tests/unit/models/` – Tests Mongoose models for validation rules, required fields, and relationships.
- `tests/unit/public/` – Tests the client-side `validateform.js` script to ensure form validation and CSS class toggling work as expected.
- `tests/unit/middleware.test.js` – Tests custom middleware (authentication/authorization & returnTo handling) with mocked requests, responses, and models.

### Integration Tests (`tests/integration/**`)

Integration tests verify that different components work together correctly. They use **MongoDB Memory Server** (in-memory database) so no local MongoDB setup is required. Each suite runs independently with full setup/teardown.

#### 1. **User Lifecycle Tests** (`user.lifecycle.test.js`)

**What it tests:** Complete user authentication flows including registration, login, session management, and logout.

- ✅ User Registration
  - Successfully register new users with unique email/username
  - Prevent duplicate usernames
  - Prevent duplicate emails
- ✅ User Login
  - Login with correct credentials
  - Reject incorrect passwords
  - Reject non-existent usernames
- ✅ Session Persistence
  - Session persists after registration
  - Session persists after login
  - Verify unauthenticated users have no session
- ✅ User Logout
  - Logout successfully clears session
- ✅ Complete Lifecycle
  - Full workflow: Register → Login → Session Maintains → Logout → Session Clears

#### 2. **Review Attachment Flow Tests** (`review.flow.test.js`)

**What it tests:** Creating campgrounds, attaching reviews, populating nested data, and calculating rating statistics.

- ✅ Campground (Background) Creation
  - Create new campgrounds successfully
  - Create multiple campgrounds by different users
- ✅ Review Addition
  - Add reviews to campgrounds
  - Add multiple reviews from different users to same campground
  - Validate review rating constraints (0–5 range)
- ✅ Populate Reviews
  - Populate full review details (body, rating)
  - Populate nested owner information in reviews
- ✅ Rating Aggregation
  - Calculate average rating from multiple reviews
  - Handle single review rating
  - Compute rating statistics (min, max, average)
- ✅ Complete Flow
  - Full workflow: Create Campground → Add Multiple Reviews → Populate Data → Calculate Statistics
  - Handle campgrounds with no reviews (empty review arrays)

#### 3. **Cascade Deletion Tests** (`cascade.deletion.test.js`)

**What it tests:** Proper cleanup and orphan prevention when deleting campgrounds and their reviews.

- ✅ Delete Background with Reviews
  - Delete campground and all its reviews cascade properly
  - Delete campground with multiple reviews (2–5 reviews)
  - Handle deletion of campground with no reviews
- ✅ Orphan Cleanup Verification
  - Only delete reviews belonging to the deleted campground
  - Ensure no orphaned reviews remain in database
- ✅ Verify Unaffected Reviews
  - Preserve reviews from other campgrounds (data isolation)
  - Maintain data integrity after multiple deletions
- ✅ Complete Cascade Flow
  - Full workflow: Create → Add Reviews → Delete Campground → Verify Reviews Deleted
  - Handle edge cases (same user creating multiple reviews)

#### 4. **Campground Management Flow** (`campground.management.test.js`)

**What it tests:** Campground CRUD operations, ownership verification, and permission enforcement.

- ✅ Campground Creation
  - Create campground when user is logged in
  - Prevent creation when user is not authenticated
  - Prevent creation with missing required fields (title, price, description, location, image)
  - Create multiple campgrounds by same user
- ✅ Campground Viewing
  - View all campgrounds without authentication
  - View specific campground details without authentication
  - Return 404 for non-existent campground
  - Populate campground with related reviews
- ✅ Campground Editing
  - Edit campground as owner
  - Prevent non-owner from editing another user's campground
  - Prevent unauthenticated users from editing
- ✅ Campground Deletion
  - Delete campground as owner
  - Prevent non-owner from deleting another user's campground
  - Prevent unauthenticated users from deleting
  - Cascade delete all associated reviews when campground is deleted

#### 5. **Review Management Flow** (`review.management.test.js`)

**What it tests:** Review CRUD operations, rating validation, ownership verification, and review calculations.

- ✅ Review Creation
  - Create review when user is logged in
  - Prevent creation when user is not authenticated
  - Validate review rating is within 0–5 range
  - Prevent creation with missing fields (body, rating)
  - Allow multiple reviews from different users on same campground
  - Support all rating values (0, 1, 2, 3, 4, 5)
  - Reject review for non-existent campground (404)
- ✅ Review Viewing
  - View all reviews for a campground without authentication
  - Return empty array for campground with no reviews
  - View reviews with populated owner information
- ✅ Review Deletion
  - Delete review as owner
  - Prevent non-owner from deleting another user's review
  - Prevent unauthenticated users from deleting
  - Verify review is removed from campground's review array
- ✅ Rating Statistics
  - Retrieve all reviews for rating calculations
  - Calculate min, max, and average ratings from multiple reviews

#### 6. **Complete User Journey** (`complete.user.journey.test.js`)

**What it tests:** Full end-to-end user workflows covering multiple scenarios and error handling.

- ✅ Visitor to Reviewer Journey
  - Register new account
  - Create campground
  - View campground
  - Add reviews to campground
  - Edit campground details
  - Delete reviews
  - Delete campground (cascade delete reviews)
- ✅ Multiple Users Collaborating
  - User 1 creates campgrounds
  - User 2 creates different campgrounds
  - User 3 adds reviews to different campgrounds
  - Verify permission enforcement (users cannot edit/delete each other's content)
  - Cascade deletion preserves other users' campgrounds
- ✅ Complete Lifecycle with Sessions
  - Register → Auto-login
  - Logout and verify session clears
  - Login again with same credentials
  - Access protected routes after re-login
- ✅ Error Handling & Edge Cases
  - Prevent duplicate user registration
  - Reject login with wrong password
  - Prevent creation with invalid data (missing fields, invalid ratings)
  - Handle access to non-existent resources (404)
  - Prevent unauthorized deletion by non-owners

---

## ▶️ How to Run Tests

### Test Commands

From the project root directory, use these npm scripts:

```bash
# Run ALL tests (unit + integration)
npm test

# Run ONLY unit tests
npm run test:unit

# Run ONLY integration tests
npm run test:integration

# Run a specific test file
npx jest tests/integration/user.lifecycle.test.js
npx jest tests/integration/review.flow.test.js
npx jest tests/integration/campground.management.test.js

# Run with coverage report
npx jest --coverage
```

<!-- ### Test Results Summary

```
Test Suites: 6 passed
Tests:       67 passed
Time:        ~10 seconds
``` -->

### Key Testing Features

✅ **In-Memory Database** – MongoDB Memory Server runs tests in isolation without external DB  
✅ **Session Persistence** – Supertest agents maintain cookies/sessions across requests  
✅ **Complete Coverage** – Tests cover happy paths, edge cases, and error scenarios  
✅ **Fast Execution** – All 67 integration tests run in ~10 seconds  
✅ **Independent Tests** – Each test is isolated with proper setup and teardown  
✅ **Real Workflows** – Tests simulate actual user interactions and multi-user scenarios

---

## ▶️ How to Run the Project (CampQuest)

1. **Clone the repository**

   ```bash
   git clone https://github.com/Ayush-Mishra-0018/CampQuest-SE_Project.git
   cd CampQuest-SE_Project
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   - Create a `.env` file (if not already present) in project root directory with values for:
     ```
     MONGODB_URI="mongodb://127.0.0.1:<your_mongodb_port>/YELPCAMP"
     ```
   - Make sure a MongoDB instance is running and accessible at this address.

4. **Seed the database (optional, for sample data)**

   ```bash
   node Seeds/seed.js
   ```

5. **Start the server**

   ```bash
   node index.js
   ```

6. **Open the app**
   - Visit `http://localhost:3000` in your browser.

---

## 🧩 Components & Features (CampQuest)

- **Campgrounds:**
  - Create, view, edit, and delete campgrounds.
  - Each campground can have location, price, description, and images.
- **Reviews:**
  - Users can add and delete reviews for campgrounds.
- **Authentication & Authorization:**
  - Only registered users can create campgrounds or reviews.
  - Only the owner of a campground/review can edit or delete it.
- **Validation & Error Handling:**
  - Joi-based server-side validation for inputs.
  - Centralized error-handling with custom `ExpressError`.
- **UI Layer:**
  - EJS templates with Bootstrap and custom CSS for layout and forms.
