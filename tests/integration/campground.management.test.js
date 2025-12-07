const request = require("supertest");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const path = require("path");
const flash = require("connect-flash");

const User = require("../../Models/User");
const Background = require("../../Models/Background");
const Review = require("../../Models/review");
const { setupTestDB, teardownTestDB, clearTestDB } = require("./setup");
const campgroundController = require("../../Controllers/campground");
const { isLogin, hasPermission } = require("../../middleware");

// Create test app with campground routes
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

  // Setup routes for testing
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
      res.status(200).json({ success: true, message: "Logged out" });
    });
  });

  // Campground routes
  app.get("/campgrounds", async (req, res) => {
    try {
      const backgrounds = await Background.find({}).populate("author");
      res.status(200).json({ success: true, campgrounds: backgrounds });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/campgrounds", isLogin, async (req, res) => {
    try {
      const { title, price, description, location, image } = req.body;

      // Validation
      if (!title || !price || !description || !location || !image) {
        return res.status(400).json({ error: "All fields are required" });
      }

      const campground = await Background.create({
        title,
        price,
        description,
        location,
        image,
        author: req.user._id,
      });

      res.status(201).json({
        success: true,
        message: "Campground created successfully",
        campground,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/campgrounds/:id", async (req, res) => {
    try {
      const campground = await Background.findById(req.params.id)
        .populate("author")
        .populate({
          path: "review",
          populate: { path: "owner" },
        });

      if (!campground) {
        return res.status(404).json({ error: "Campground not found" });
      }

      res.status(200).json({ success: true, campground });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/campgrounds/:id", isLogin, hasPermission, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, price, description, location, image } = req.body;

      // Validation
      if (!title || !price || !description || !location || !image) {
        return res.status(400).json({ error: "All fields are required" });
      }

      const campground = await Background.findByIdAndUpdate(
        id,
        { title, price, description, location, image },
        { new: true }
      ).populate("author");

      res.status(200).json({
        success: true,
        message: "Campground updated successfully",
        campground,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/campgrounds/:id", isLogin, hasPermission, async (req, res) => {
    try {
      const { id } = req.params;
      const campground = await Background.findByIdAndDelete(id).populate(
        "review"
      );

      if (!campground) {
        return res.status(404).json({ error: "Campground not found" });
      }

      res.status(200).json({
        success: true,
        message: "Campground deleted successfully",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return app;
};

describe("Integration Tests: Campground Management Flow", () => {
  let app;
  let agent;
  let testUser;
  let testUser2;

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
    const user = new User({
      email: "campground@example.com",
      username: "campgrounduser",
    });
    testUser = await User.register(user, "password123");

    const user2 = new User({
      email: "other@example.com",
      username: "otheruser",
    });
    testUser2 = await User.register(user2, "password456");
  });

  describe("Campground Creation", () => {
    it("should create a campground when user is logged in", async () => {
      // Login first
      await agent.post("/login").send({
        username: "campgrounduser",
        password: "password123",
      });

      // Create campground
      const response = await agent.post("/campgrounds").send({
        title: "Beautiful Mountain Camp",
        price: 50,
        description: "A wonderful camping experience in the mountains",
        location: "Colorado",
        image: "https://example.com/mountain.jpg",
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.campground).toHaveProperty(
        "title",
        "Beautiful Mountain Camp"
      );
      expect(response.body.campground).toHaveProperty("price", 50);
      expect(response.body.campground).toHaveProperty("author");
    });

    it("should not create a campground when user is not logged in", async () => {
      const response = await agent.post("/campgrounds").send({
        title: "Test Camp",
        price: 50,
        description: "Description",
        location: "Location",
        image: "https://example.com/test.jpg",
      });

      // Middleware redirects to login (302)
      expect([301, 302, 307, 308]).toContain(response.status);
    });

    it("should not create a campground with missing fields", async () => {
      // Login first
      await agent.post("/login").send({
        username: "campgrounduser",
        password: "password123",
      });

      // Missing title
      const response = await agent.post("/campgrounds").send({
        price: 50,
        description: "Description",
        location: "Location",
        image: "https://example.com/image.jpg",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should create multiple campgrounds by same user", async () => {
      // Login
      await agent.post("/login").send({
        username: "campgrounduser",
        password: "password123",
      });

      // Create first campground
      const response1 = await agent.post("/campgrounds").send({
        title: "Camp 1",
        price: 30,
        description: "Description 1",
        location: "Location 1",
        image: "https://example.com/1.jpg",
      });

      // Create second campground
      const response2 = await agent.post("/campgrounds").send({
        title: "Camp 2",
        price: 60,
        description: "Description 2",
        location: "Location 2",
        image: "https://example.com/2.jpg",
      });

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);

      // Verify both exist
      const allCamps = await Background.find({});
      expect(allCamps).toHaveLength(2);
    });
  });

  describe("Campground Viewing", () => {
    let campground;

    beforeEach(async () => {
      campground = await Background.create({
        title: "Test Campground",
        price: 50,
        description: "Test description",
        location: "Test Location",
        image: "https://example.com/image.jpg",
        author: testUser._id,
      });
    });

    it("should view all campgrounds without authentication", async () => {
      const response = await agent.get("/campgrounds");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.campgrounds).toHaveLength(1);
      expect(response.body.campgrounds[0]).toHaveProperty(
        "title",
        "Test Campground"
      );
    });

    it("should view specific campground without authentication", async () => {
      const response = await agent.get(`/campgrounds/${campground._id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.campground).toHaveProperty(
        "_id",
        campground._id.toString()
      );
      expect(response.body.campground).toHaveProperty(
        "title",
        "Test Campground"
      );
    });

    it("should return 404 for non-existent campground", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      const response = await agent.get(`/campgrounds/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error");
    });

    it("should view campground with reviews populated", async () => {
      // Add a review
      const review = await Review.create({
        body: "Great place!",
        rating: 5,
        owner: testUser2._id,
      });

      campground.review.push(review._id);
      await campground.save();

      const response = await agent.get(`/campgrounds/${campground._id}`);

      expect(response.status).toBe(200);
      expect(response.body.campground.review).toHaveLength(1);
      expect(response.body.campground.review[0]).toHaveProperty(
        "body",
        "Great place!"
      );
      expect(response.body.campground.review[0]).toHaveProperty("rating", 5);
    });
  });

  describe("Campground Editing", () => {
    let campground;

    beforeEach(async () => {
      campground = await Background.create({
        title: "Original Title",
        price: 50,
        description: "Original description",
        location: "Original Location",
        image: "https://example.com/original.jpg",
        author: testUser._id,
      });
    });

    it("should edit campground as owner", async () => {
      // Login as owner
      await agent.post("/login").send({
        username: "campgrounduser",
        password: "password123",
      });

      const response = await agent
        .patch(`/campgrounds/${campground._id}`)
        .send({
          title: "Updated Title",
          price: 75,
          description: "Updated description",
          location: "Updated Location",
          image: "https://example.com/updated.jpg",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.campground).toHaveProperty("title", "Updated Title");
      expect(response.body.campground).toHaveProperty("price", 75);

      // Verify in database
      const updated = await Background.findById(campground._id);
      expect(updated.title).toBe("Updated Title");
    });

    it("should not edit campground as non-owner", async () => {
      // Login as different user
      await agent.post("/login").send({
        username: "otheruser",
        password: "password456",
      });

      const response = await agent
        .patch(`/campgrounds/${campground._id}`)
        .send({
          title: "Hacked Title",
          price: 1,
          description: "Hacked",
          location: "Hacked",
          image: "https://example.com/hacked.jpg",
        });

      // Middleware redirects (302) when user lacks permission
      expect([301, 302, 307, 308]).toContain(response.status);

      // Verify not changed in database
      const unchanged = await Background.findById(campground._id);
      expect(unchanged.title).toBe("Original Title");
    });

    it("should not edit campground when not authenticated", async () => {
      const response = await agent
        .patch(`/campgrounds/${campground._id}`)
        .send({
          title: "Unauthorized Edit",
          price: 999,
          description: "Unauthorized",
          location: "Unauthorized",
          image: "https://example.com/unauthorized.jpg",
        });

      // Middleware redirects (302) when not authenticated
      expect([301, 302, 307, 308]).toContain(response.status);
    });
  });

  describe("Campground Deletion", () => {
    let campground;

    beforeEach(async () => {
      campground = await Background.create({
        title: "To Delete",
        price: 50,
        description: "This will be deleted",
        location: "Deletion Test",
        image: "https://example.com/delete.jpg",
        author: testUser._id,
      });
    });

    it("should delete campground as owner", async () => {
      // Login as owner
      await agent.post("/login").send({
        username: "campgrounduser",
        password: "password123",
      });

      const response = await agent.delete(`/campgrounds/${campground._id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify deleted from database
      const deleted = await Background.findById(campground._id);
      expect(deleted).toBeNull();
    });

    it("should not delete campground as non-owner", async () => {
      // Login as different user
      await agent.post("/login").send({
        username: "otheruser",
        password: "password456",
      });

      const response = await agent.delete(`/campgrounds/${campground._id}`);

      // Middleware redirects (302) when user lacks permission
      expect([301, 302, 307, 308]).toContain(response.status);

      // Verify still exists in database
      const existing = await Background.findById(campground._id);
      expect(existing).not.toBeNull();
    });

    it("should not delete campground when not authenticated", async () => {
      const response = await agent.delete(`/campgrounds/${campground._id}`);

      // Middleware redirects (302) when not authenticated
      expect([301, 302, 307, 308]).toContain(response.status);

      // Verify still exists
      const existing = await Background.findById(campground._id);
      expect(existing).not.toBeNull();
    });

    it("should delete campground and cascade delete reviews", async () => {
      // Add reviews to campground
      const review1 = await Review.create({
        body: "Review 1",
        rating: 5,
        owner: testUser._id,
      });

      const review2 = await Review.create({
        body: "Review 2",
        rating: 4,
        owner: testUser2._id,
      });

      campground.review.push(review1._id, review2._id);
      await campground.save();

      // Login and delete
      await agent.post("/login").send({
        username: "campgrounduser",
        password: "password123",
      });

      const response = await agent.delete(`/campgrounds/${campground._id}`);

      expect(response.status).toBe(200);

      // Verify campground deleted
      const campDeleted = await Background.findById(campground._id);
      expect(campDeleted).toBeNull();

      // Verify reviews cascade deleted
      const reviews = await Review.find({});
      expect(reviews).toHaveLength(0);
    });
  });
});
