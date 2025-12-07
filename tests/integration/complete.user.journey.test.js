const request = require("supertest");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const flash = require("connect-flash");

const User = require("../../Models/User");
const Background = require("../../Models/Background");
const Review = require("../../Models/review");
const { setupTestDB, teardownTestDB, clearTestDB } = require("./setup");
const { isLogin, hasPermission, canUpdateReview } = require("../../middleware");

// Note: These tests use middleware that redirects instead of returning error status codes
// In a real app with Express views, redirects (302) happen, but our test apps may return them

// Create comprehensive test app
const createTestApp = () => {
  const app = express();

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    })
  );

  app.use(flash());

  app.use(passport.initialize());
  app.use(passport.session());
  passport.use(new LocalStrategy(User.authenticate()));
  passport.serializeUser(User.serializeUser());
  passport.deserializeUser(User.deserializeUser());

  // Authentication endpoints
  app.post("/register", async (req, res) => {
    try {
      const { email, username, password } = req.body;
      const user = new User({ email, username });
      const registeredUser = await User.register(user, password);

      req.login(registeredUser, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({
          success: true,
          user: {
            id: registeredUser._id,
            username: registeredUser.username,
            email: registeredUser.email,
          },
        });
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        username: req.user.username,
      },
    });
  });

  app.post("/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ success: true });
    });
  });

  app.get("/profile", (req, res) => {
    if (req.isAuthenticated()) {
      res.status(200).json({ authenticated: true, user: { id: req.user._id } });
    } else {
      res.status(401).json({ authenticated: false });
    }
  });

  // Campground endpoints
  app.get("/campgrounds", async (req, res) => {
    try {
      const campgrounds = await Background.find({}).populate("author");
      res.status(200).json({ success: true, campgrounds });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/campgrounds", isLogin, async (req, res) => {
    try {
      const { title, price, description, location, image } = req.body;
      if (!title || !price || !description || !location || !image) {
        return res.status(400).json({ error: "All fields required" });
      }

      const campground = await Background.create({
        title,
        price,
        description,
        location,
        image,
        author: req.user._id,
      });

      res.status(201).json({ success: true, campground });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/campgrounds/:id", async (req, res) => {
    try {
      const campground = await Background.findById(req.params.id)
        .populate("author")
        .populate({ path: "review", populate: { path: "owner" } });

      if (!campground) {
        return res.status(404).json({ error: "Not found" });
      }

      res.status(200).json({ success: true, campground });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/campgrounds/:id", isLogin, hasPermission, async (req, res) => {
    try {
      const { title, price, description, location, image } = req.body;
      if (!title || !price || !description || !location || !image) {
        return res.status(400).json({ error: "All fields required" });
      }

      const campground = await Background.findByIdAndUpdate(
        req.params.id,
        { title, price, description, location, image },
        { new: true }
      );

      res.status(200).json({ success: true, campground });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/campgrounds/:id", isLogin, hasPermission, async (req, res) => {
    try {
      await Background.findByIdAndDelete(req.params.id);
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Review endpoints
  app.post("/campgrounds/:id/reviews", isLogin, async (req, res) => {
    try {
      const { body, rating } = req.body;
      if (!body || rating === undefined) {
        return res.status(400).json({ error: "Required fields missing" });
      }
      if (rating < 0 || rating > 5) {
        return res.status(400).json({ error: "Invalid rating" });
      }

      const campground = await Background.findById(req.params.id);
      if (!campground) {
        return res.status(404).json({ error: "Campground not found" });
      }

      const review = await Review.create({
        body,
        rating: Number(rating),
        owner: req.user._id,
      });

      campground.review.push(review._id);
      await campground.save();

      res.status(201).json({ success: true, review });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/campgrounds/:id/reviews", async (req, res) => {
    try {
      const campground = await Background.findById(req.params.id).populate({
        path: "review",
        populate: { path: "owner" },
      });

      if (!campground) {
        return res.status(404).json({ error: "Not found" });
      }

      res.status(200).json({ success: true, reviews: campground.review });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete(
    "/campgrounds/:id/reviews/:revid",
    isLogin,
    canUpdateReview,
    async (req, res) => {
      try {
        const { id, revid } = req.params;
        const campground = await Background.findById(id);

        campground.review = campground.review.filter(
          (rid) => rid.toString() !== revid
        );
        await campground.save();
        await Review.findByIdAndDelete(revid);

        res.status(200).json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  return app;
};

describe("Integration Tests: Complete User Journey", () => {
  let app;

  beforeAll(async () => {
    await setupTestDB();
    app = createTestApp();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe("End-to-End User Journey: Visitor to Reviewer", () => {
    it("should allow user to register, create campground, and add reviews", async () => {
      const userAgent = request.agent(app);

      // Step 1: User visits homepage and views campgrounds (no auth needed)
      let response = await userAgent.get("/campgrounds");
      expect(response.status).toBe(200);
      expect(response.body.campgrounds).toHaveLength(0);

      // Step 2: User registers
      response = await userAgent.post("/register").send({
        email: "journey@example.com",
        username: "journeyuser",
        password: "securepass123",
      });

      expect(response.status).toBe(201);
      const userId = response.body.user.id;

      // Step 3: User creates a campground
      response = await userAgent.post("/campgrounds").send({
        title: "My Amazing Camp",
        price: 50,
        description: "Perfect camping spot",
        location: "Mountain View",
        image: "https://example.com/camp.jpg",
      });

      expect(response.status).toBe(201);
      const campgroundId = response.body.campground._id;

      // Step 4: User views their created campground
      response = await userAgent.get(`/campgrounds/${campgroundId}`);

      expect(response.status).toBe(200);
      expect(response.body.campground.title).toBe("My Amazing Camp");
      expect(response.body.campground.review).toHaveLength(0);

      // Step 5: Another user registers and adds a review
      const reviewer = request.agent(app);
      await reviewer.post("/register").send({
        email: "reviewer@example.com",
        username: "reviewer",
        password: "pass456",
      });

      response = await reviewer
        .post(`/campgrounds/${campgroundId}/reviews`)
        .send({
          body: "Wonderful camping experience!",
          rating: 5,
        });

      expect(response.status).toBe(201);

      // Step 6: Creator views their campground with the review
      response = await userAgent.get(`/campgrounds/${campgroundId}`);

      expect(response.status).toBe(200);
      expect(response.body.campground.review).toHaveLength(1);
      expect(response.body.campground.review[0].body).toBe(
        "Wonderful camping experience!"
      );

      // Step 7: User edits their campground
      response = await userAgent.patch(`/campgrounds/${campgroundId}`).send({
        title: "My Updated Amazing Camp",
        price: 60,
        description: "Even better now",
        location: "Mountain View Updated",
        image: "https://example.com/updated.jpg",
      });

      expect(response.status).toBe(200);
      expect(response.body.campground.price).toBe(60);

      // Step 8: Reviewer adds another review
      response = await reviewer
        .post(`/campgrounds/${campgroundId}/reviews`)
        .send({
          body: "Still amazing after updates!",
          rating: 5,
        });

      expect(response.status).toBe(201);

      // Step 9: Reviewer can view both reviews
      response = await reviewer.get(`/campgrounds/${campgroundId}`);

      expect(response.body.campground.review).toHaveLength(2);

      // Step 10: Reviewer deletes their second review
      const reviewId = response.body.campground.review[1]._id;
      response = await reviewer.delete(
        `/campgrounds/${campgroundId}/reviews/${reviewId}`
      );

      expect(response.status).toBe(200);

      // Step 11: Verify review count is back to 1
      response = await userAgent.get(`/campgrounds/${campgroundId}`);

      expect(response.body.campground.review).toHaveLength(1);

      // Step 12: Creator deletes campground
      response = await userAgent.delete(`/campgrounds/${campgroundId}`);

      expect(response.status).toBe(200);

      // Step 13: Verify campground is deleted and reviews are cascade deleted
      response = await userAgent.get(`/campgrounds/${campgroundId}`);

      expect(response.status).toBe(404);

      const reviews = await Review.find({});
      expect(reviews).toHaveLength(0);
    });
  });

  describe("End-to-End User Journey: Multiple Users Collaborating", () => {
    it("should handle multiple users creating and reviewing multiple campgrounds", async () => {
      // User 1 setup
      const user1 = request.agent(app);
      await user1.post("/register").send({
        email: "user1@test.com",
        username: "user1",
        password: "pass1",
      });

      // User 2 setup
      const user2 = request.agent(app);
      await user2.post("/register").send({
        email: "user2@test.com",
        username: "user2",
        password: "pass2",
      });

      // User 3 setup
      const user3 = request.agent(app);
      await user3.post("/register").send({
        email: "user3@test.com",
        username: "user3",
        password: "pass3",
      });

      // User 1 creates 2 campgrounds
      let res = await user1.post("/campgrounds").send({
        title: "User1 Camp 1",
        price: 40,
        description: "Desc1",
        location: "Loc1",
        image: "https://example.com/1.jpg",
      });
      const camp1 = res.body.campground._id;

      res = await user1.post("/campgrounds").send({
        title: "User1 Camp 2",
        price: 60,
        description: "Desc2",
        location: "Loc2",
        image: "https://example.com/2.jpg",
      });
      const camp2 = res.body.campground._id;

      // User 2 creates 1 campground
      res = await user2.post("/campgrounds").send({
        title: "User2 Camp 1",
        price: 50,
        description: "Desc3",
        location: "Loc3",
        image: "https://example.com/3.jpg",
      });
      const camp3 = res.body.campground._id;

      // Verify 3 campgrounds exist
      res = await user1.get("/campgrounds");
      expect(res.body.campgrounds).toHaveLength(3);

      // Users 2 and 3 review User1's first campground
      await user2.post(`/campgrounds/${camp1}/reviews`).send({
        body: "Great campground",
        rating: 5,
      });

      await user3.post(`/campgrounds/${camp1}/reviews`).send({
        body: "Nice place",
        rating: 4,
      });

      // User 1 reviews their own campground
      await user1.post(`/campgrounds/${camp1}/reviews`).send({
        body: "I built this",
        rating: 5,
      });

      // Verify 3 reviews on camp1
      res = await user1.get(`/campgrounds/${camp1}/reviews`);
      expect(res.body.reviews).toHaveLength(3);

      // User 3 reviews User2's campground
      await user3.post(`/campgrounds/${camp3}/reviews`).send({
        body: "Awesome",
        rating: 5,
      });

      // User 2 edits their campground
      res = await user2.patch(`/campgrounds/${camp3}`).send({
        title: "User2 Camp 1 Updated",
        price: 55,
        description: "Updated desc",
        location: "Updated loc",
        image: "https://example.com/updated.jpg",
      });

      expect(res.body.campground.title).toBe("User2 Camp 1 Updated");

      // Verify User 2 cannot edit User1's campground
      res = await user2.patch(`/campgrounds/${camp1}`).send({
        title: "Hacked",
        price: 1,
        description: "Hacked",
        location: "Hacked",
        image: "https://example.com/hacked.jpg",
      });

      // Middleware redirects when user lacks permission
      expect([301, 302, 307, 308]).toContain(res.status);

      // User 2 deletes their campground
      res = await user2.delete(`/campgrounds/${camp3}`);
      expect(res.status).toBe(200);

      // Verify campground deleted
      res = await user1.get(`/campgrounds/${camp3}`);
      expect(res.status).toBe(404);

      // Verify 2 campgrounds remain
      res = await user1.get("/campgrounds");
      expect(res.body.campgrounds).toHaveLength(2);

      // Verify review was cascade deleted
      const reviews = await Review.find({});
      expect(reviews).toHaveLength(3); // Only reviews on User1's campgrounds
    });
  });

  describe("End-to-End User Journey: Complete Lifecycle", () => {
    it("should handle full lifecycle with login/logout", async () => {
      const userAgent = request.agent(app);

      // Register
      let res = await userAgent.post("/register").send({
        email: "lifecycle@test.com",
        username: "lifecycle",
        password: "lifecyclepass",
      });

      expect(res.status).toBe(201);

      // User is now authenticated
      res = await userAgent.get("/profile");
      expect(res.body.authenticated).toBe(true);

      // Create campground while logged in
      res = await userAgent.post("/campgrounds").send({
        title: "Lifecycle Camp",
        price: 45,
        description: "Full cycle test",
        location: "Test Location",
        image: "https://example.com/lifecycle.jpg",
      });

      const campId = res.body.campground._id;
      expect(res.status).toBe(201);

      // Logout
      res = await userAgent.post("/logout");
      expect(res.status).toBe(200);

      // User is no longer authenticated
      res = await userAgent.get("/profile");
      expect(res.body.authenticated).toBe(false);

      // Can still view campgrounds without auth
      res = await userAgent.get("/campgrounds");
      expect(res.status).toBe(200);
      expect(res.body.campgrounds).toHaveLength(1);

      // Cannot create campground while logged out
      res = await userAgent.post("/campgrounds").send({
        title: "Unauthorized Camp",
        price: 50,
        description: "Should fail",
        location: "Fail Location",
        image: "https://example.com/fail.jpg",
      });

      // Middleware redirects when not authenticated
      expect([301, 302, 307, 308]).toContain(res.status);

      // Cannot add review while logged out
      res = await userAgent.post(`/campgrounds/${campId}/reviews`).send({
        body: "Unauthorized review",
        rating: 3,
      });

      // Middleware redirects when not authenticated
      expect([301, 302, 307, 308]).toContain(res.status);

      // Login again
      res = await userAgent.post("/login").send({
        username: "lifecycle",
        password: "lifecyclepass",
      });

      expect(res.status).toBe(200);

      // Can now add review
      res = await userAgent.post(`/campgrounds/${campId}/reviews`).send({
        body: "Review after relogin",
        rating: 4,
      });

      expect(res.status).toBe(201);

      // Verify campground has the review
      res = await userAgent.get(`/campgrounds/${campId}`);
      expect(res.body.campground.review).toHaveLength(1);
    });
  });

  describe("End-to-End: Error Handling", () => {
    it("should handle edge cases and errors gracefully", async () => {
      const userAgent = request.agent(app);

      // Try to login with non-existent user
      let res = await userAgent.post("/login").send({
        username: "nonexistent",
        password: "password",
      });

      // Failed authentication redirects or returns error
      expect([301, 302, 307, 308, 401]).toContain(res.status);

      // Register valid user
      res = await userAgent.post("/register").send({
        email: "errors@test.com",
        username: "erroruser",
        password: "errorpass",
      });

      expect(res.status).toBe(201);

      // Try duplicate registration
      const user2 = request.agent(app);
      res = await user2.post("/register").send({
        email: "errors@test.com",
        username: "erroruser",
        password: "pass",
      });

      expect(res.status).toBe(400);

      // Create campground
      res = await userAgent.post("/campgrounds").send({
        title: "Error Test Camp",
        price: 50,
        description: "Test",
        location: "Test",
        image: "https://example.com/test.jpg",
      });

      const campId = res.body.campground._id;

      // Try invalid rating
      res = await userAgent.post(`/campgrounds/${campId}/reviews`).send({
        body: "Test review",
        rating: 10,
      });

      expect(res.status).toBe(400);

      // Try missing review body
      res = await userAgent.post(`/campgrounds/${campId}/reviews`).send({
        rating: 4,
      });

      expect(res.status).toBe(400);

      // Try accessing non-existent campground
      res = await userAgent.get("/campgrounds/507f1f77bcf86cd799439011");
      expect(res.status).toBe(404);

      // Try deleting non-existent campground
      res = await userAgent.delete("/campgrounds/507f1f77bcf86cd799439011");
      expect([301, 302, 304, 307, 308, 404]).toContain(res.status);

      // Create valid review
      res = await userAgent.post(`/campgrounds/${campId}/reviews`).send({
        body: "Valid review",
        rating: 4,
      });

      expect(res.status).toBe(201);
      const reviewId = res.body.review._id;

      // Create another user and try to delete review as non-owner
      const other = request.agent(app);
      await other.post("/register").send({
        email: "other@test.com",
        username: "otheruserr",
        password: "otherpass",
      });

      res = await other.delete(`/campgrounds/${campId}/reviews/${reviewId}`);
      // Middleware redirects when user lacks permission
      expect([301, 302, 307, 308]).toContain(res.status);

      // Valid deletion by owner
      res = await userAgent.delete(
        `/campgrounds/${campId}/reviews/${reviewId}`
      );
      expect(res.status).toBe(200);
    });
  });
});
