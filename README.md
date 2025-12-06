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
  uploads/              # Uploaded images (if enabled)
```

---

## 🧪 Testing Overview

We use **Jest** for unit testing inside `CampQuest-SE_Project/tests/unit`.

- `tests/unit/helper/` – Verifies behavior of helper utilities like `ExpressError` and `WrapError` (correct error shape and async error handling).
- `tests/unit/models/` – Tests Mongoose models for validation rules, required fields, and relationships.
- `tests/unit/public/` – Tests the client-side `validateform.js` script to ensure form validation and CSS class toggling work as expected.
- `tests/unit/middleware.test.js` – Tests custom middleware (authentication/authorization & returnTo handling) with mocked requests, responses, and models.

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
   - Create a `.env` file (if not already present) in `YELPCAMP/` with values for:
     - `MONGO_URI` – MongoDB connection string
     - `SECRET` – Session secret for Express-session
   - Make sure a MongoDB instance is running and accessible from `MONGO_URI`.

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

## 🧪 How to Run Tests

All commands below are run from inside the `CampQuest-SE_Project` folder.

1. **Run all unit tests**
   ```bash
   npm run test:unit
   ```

2. **Typical Jest test areas**
   - Models and helpers (default when running Jest).
   - Middleware and client-side validation tests are included as part of the same test run.

> If tests fail because of missing local MongoDB, ensure your MongoDB is running or adjust the test configuration as documented in `jest.config.js` / `tests/unit/models/db.js`.

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

