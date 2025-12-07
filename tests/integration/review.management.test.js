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
const { isLogin, canUpdateReview } = require("../../middleware");

// Create test app with review routes
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

  // Authentication routes
  app.post("/register", async (req, res) => {
    try {
      const { email, username, password } = req.body;
      const user = new User({ email, username });
      const registeredUser = await User.register(user, password);

      req.login(registeredUser, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({
          success: true,
          user: { id: registeredUser._id, username: registeredUser.username },
        });
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json({
      success: true,
      user: { id: req.user._id, username: req.user.username },
    });
  });

  app.post("/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ success: true, message: "Logged out" });
    });
  });

  // Review routes
  app.post("/campgrounds/:id/reviews", isLogin, async (req, res) => {
    try {
      const { id } = req.params;
      const { body, rating } = req.body;

      // Validation
      if (!body || rating === undefined) {
        return res.status(400).json({ error: "Body and rating are required" });
      }

      if (rating < 0 || rating > 5) {
        return res
          .status(400)
          .json({ error: "Rating must be between 0 and 5" });
      }

      const campground = await Background.findById(id);
      if (!campground) {
        return res.status(404).json({ error: "Campground not found" });
      }

      const review = new Review({
        body,
        rating: Number(rating),
        owner: req.user._id,
      });

      await review.save();
      campground.review.push(review._id);
      await campground.save();

      res.status(201).json({
        success: true,
        message: "Review created successfully",
        review,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/campgrounds/:id/reviews", async (req, res) => {
    try {
      const { id } = req.params;
      const campground = await Background.findById(id).populate({
        path: "review",
        populate: { path: "owner" },
      });

      if (!campground) {
        return res.status(404).json({ error: "Campground not found" });
      }

      res.status(200).json({
        success: true,
        reviews: campground.review,
      });
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
        if (!campground) {
          return res.status(404).json({ error: "Campground not found" });
        }

        campground.review = campground.review.filter(
          (reviewId) => reviewId.toString() !== revid
        );
        await campground.save();

        await Review.findByIdAndDelete(revid);

        res.status(200).json({
          success: true,
          message: "Review deleted successfully",
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  return app;
};

describe("Integration Tests: Review Management Flow", () => {
  let app;
  let agent;
  let testUser1;
  let testUser2;
  let campground;

  beforeAll(async () => {
    await setupTestDB();
    app = createTestApp();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    agent = request.agent(app);

    // Create test users
    const user1 = new User({
      email: "reviewer1@example.com",
      username: "reviewer1",
    });
    testUser1 = await User.register(user1, "password123");

    const user2 = new User({
      email: "reviewer2@example.com",
      username: "reviewer2",
    });
    testUser2 = await User.register(user2, "password456");

    // Create campground
    campground = await Background.create({
      title: "Test Campground",
      price: 50,
      description: "A wonderful place",
      location: "Test Location",
      image: "https://example.com/image.jpg",
      author: testUser1._id,
    });
  });

  describe("Review Creation", () => {
    it("should create a review when user is logged in", async () => {
      // Login
      await agent.post("/login").send({
        username: "reviewer2",
        password: "password456",
      });

      const response = await agent
        .post(`/campgrounds/${campground._id}/reviews`)
        .send({
          body: "This is an amazing campground!",
          rating: 5,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.review).toHaveProperty(
        "body",
        "This is an amazing campground!"
      );
      expect(response.body.review).toHaveProperty("rating", 5);

      // Verify in database
      const updated = await Background.findById(campground._id);
      expect(updated.review).toHaveLength(1);
    });

    it("should not create a review when user is not logged in", async () => {
      const response = await agent
        .post(`/campgrounds/${campground._id}/reviews`)
        .send({
          body: "Unauthorized review",
          rating: 3,
        });

      // Middleware redirects (302) when not authenticated
      expect([301, 302, 307, 308]).toContain(response.status);
    });

    it("should not create a review with invalid rating", async () => {
      // Login
      await agent.post("/login").send({
        username: "reviewer2",
        password: "password456",
      });

      // Rating too high
      const response1 = await agent
        .post(`/campgrounds/${campground._id}/reviews`)
        .send({
          body: "Test review",
          rating: 10,
        });

      expect(response1.status).toBe(400);

      // Rating too low
      const response2 = await agent
        .post(`/campgrounds/${campground._id}/reviews`)
        .send({
          body: "Test review",
          rating: -1,
        });

      expect(response2.status).toBe(400);
    });

    it("should not create a review with missing fields", async () => {
      // Login
      await agent.post("/login").send({
        username: "reviewer2",
        password: "password456",
      });

      // Missing body
      const response = await agent
        .post(`/campgrounds/${campground._id}/reviews`)
        .send({
          rating: 4,
        });

      expect(response.status).toBe(400);
    });

    it("should create multiple reviews on same campground from different users", async () => {
      // Create review from user1
      const user1Agent = request.agent(app);
      await user1Agent.post("/login").send({
        username: "reviewer1",
        password: "password123",
      });

      const response1 = await user1Agent
        .post(`/campgrounds/${campground._id}/reviews`)
        .send({
          body: "Great place for camping!",
          rating: 5,
        });

      expect(response1.status).toBe(201);

      // Create review from user2
      const user2Agent = request.agent(app);
      await user2Agent.post("/login").send({
        username: "reviewer2",
        password: "password456",
      });

      const response2 = await user2Agent
        .post(`/campgrounds/${campground._id}/reviews`)
        .send({
          body: "Nice but crowded",
          rating: 3,
        });

      expect(response2.status).toBe(201);

      // Verify both reviews exist
      const updated = await Background.findById(campground._id);
      expect(updated.review).toHaveLength(2);
    });

    it("should allow different rating values", async () => {
      // Login
      await agent.post("/login").send({
        username: "reviewer2",
        password: "password456",
      });

      const ratings = [0, 1, 2, 3, 4, 5];

      for (const rating of ratings) {
        const response = await agent
          .post(`/campgrounds/${campground._id}/reviews`)
          .send({
            body: `Review with rating ${rating}`,
            rating,
          });

        expect(response.status).toBe(201);
        expect(response.body.review.rating).toBe(rating);
      }

      const updated = await Background.findById(campground._id);
      expect(updated.review).toHaveLength(6);
    });

    it("should reject review for non-existent campground", async () => {
      // Login
      await agent.post("/login").send({
        username: "reviewer2",
        password: "password456",
      });

      const fakeId = "507f1f77bcf86cd799439011";
      const response = await agent.post(`/campgrounds/${fakeId}/reviews`).send({
        body: "Test review",
        rating: 4,
      });

      expect(response.status).toBe(404);
    });
  });

  describe("Review Viewing", () => {
    beforeEach(async () => {
      // Add reviews to campground
      const review1 = await Review.create({
        body: "Amazing place!",
        rating: 5,
        owner: testUser1._id,
      });

      const review2 = await Review.create({
        body: "Good but expensive",
        rating: 3,
        owner: testUser2._id,
      });

      campground.review.push(review1._id, review2._id);
      await campground.save();
    });

    it("should view all reviews for a campground", async () => {
      const response = await agent.get(
        `/campgrounds/${campground._id}/reviews`
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.reviews).toHaveLength(2);
      expect(response.body.reviews[0]).toHaveProperty("body");
      expect(response.body.reviews[0]).toHaveProperty("rating");
      expect(response.body.reviews[0]).toHaveProperty("owner");
    });

    it("should view reviews without authentication", async () => {
      const response = await agent.get(
        `/campgrounds/${campground._id}/reviews`
      );

      expect(response.status).toBe(200);
      expect(response.body.reviews).toHaveLength(2);
    });

    it("should return empty array for campground with no reviews", async () => {
      const emptycamp = await Background.create({
        title: "New Campground",
        price: 40,
        description: "Fresh campground",
        location: "Somewhere",
        image: "https://example.com/new.jpg",
        author: testUser1._id,
      });

      const response = await agent.get(`/campgrounds/${emptycamp._id}/reviews`);

      expect(response.status).toBe(200);
      expect(response.body.reviews).toHaveLength(0);
    });
  });

  describe("Review Deletion", () => {
    let review1;
    let review2;

    beforeEach(async () => {
      review1 = await Review.create({
        body: "Great place!",
        rating: 5,
        owner: testUser1._id,
      });

      review2 = await Review.create({
        body: "Good place!",
        rating: 4,
        owner: testUser2._id,
      });

      campground.review.push(review1._id, review2._id);
      await campground.save();
    });

    it("should delete review as owner", async () => {
      // Login as review owner
      await agent.post("/login").send({
        username: "reviewer1",
        password: "password123",
      });

      const response = await agent.delete(
        `/campgrounds/${campground._id}/reviews/${review1._id}`
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify deleted
      const deletedReview = await Review.findById(review1._id);
      expect(deletedReview).toBeNull();

      // Verify removed from campground
      const updated = await Background.findById(campground._id);
      expect(updated.review).toHaveLength(1);
      expect(updated.review[0].toString()).toBe(review2._id.toString());
    });

    it("should not delete review as non-owner", async () => {
      // Login as different user
      await agent.post("/login").send({
        username: "reviewer2",
        password: "password456",
      });

      const response = await agent.delete(
        `/campgrounds/${campground._id}/reviews/${review1._id}`
      );

      // Middleware redirects (302) when user lacks permission
      expect([301, 302, 307, 308]).toContain(response.status);

      // Verify not deleted
      const existing = await Review.findById(review1._id);
      expect(existing).not.toBeNull();
    });

    it("should not delete review when not authenticated", async () => {
      const response = await agent.delete(
        `/campgrounds/${campground._id}/reviews/${review1._id}`
      );

      // Middleware redirects (302) when not authenticated
      expect([301, 302, 307, 308]).toContain(response.status);

      // Verify not deleted
      const existing = await Review.findById(review1._id);
      expect(existing).not.toBeNull();
    });

    it("should delete review and remove from campground", async () => {
      // Login
      await agent.post("/login").send({
        username: "reviewer1",
        password: "password123",
      });

      // Delete review
      await agent.delete(
        `/campgrounds/${campground._id}/reviews/${review1._id}`
      );

      // Verify campground still exists
      const camp = await Background.findById(campground._id);
      expect(camp).not.toBeNull();
      expect(camp.review).toHaveLength(1);
    });
  });

  describe("Rating Statistics", () => {
    beforeEach(async () => {
      // Create campground with multiple reviews
      const ratings = [5, 4, 3, 5, 2];

      for (const rating of ratings) {
        const review = await Review.create({
          body: `Review with rating ${rating}`,
          rating,
          owner: testUser1._id,
        });
        campground.review.push(review._id);
      }

      await campground.save();
    });

    it("should retrieve all reviews for rating calculation", async () => {
      const response = await agent.get(
        `/campgrounds/${campground._id}/reviews`
      );

      expect(response.status).toBe(200);
      expect(response.body.reviews).toHaveLength(5);

      const ratings = response.body.reviews.map((r) => r.rating);
      const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;

      expect(average).toBe(3.8);
    });

    it("should calculate min, max, and average ratings", async () => {
      const response = await agent.get(
        `/campgrounds/${campground._id}/reviews`
      );

      const ratings = response.body.reviews.map((r) => r.rating);

      const min = Math.min(...ratings);
      const max = Math.max(...ratings);
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;

      expect(min).toBe(2);
      expect(max).toBe(5);
      expect(avg).toBe(3.8);
    });
  });
});
