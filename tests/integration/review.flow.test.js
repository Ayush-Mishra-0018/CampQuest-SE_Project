const Background = require('../../Models/Background');
const Review = require('../../Models/review');
const User = require('../../Models/User');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./setup');

describe('Integration Tests: Review Attachment Flow', () => {
    let testUser1;
    let testUser2;
    let campground;

    beforeAll(async () => {
        await setupTestDB();
    });

    afterAll(async () => {
        await teardownTestDB();
    });

    beforeEach(async () => {
        await clearTestDB();

        // Create test users
        const user1 = new User({ email: 'user1@example.com', username: 'user1' });
        testUser1 = await User.register(user1, 'password123');

        const user2 = new User({ email: 'user2@example.com', username: 'user2' });
        testUser2 = await User.register(user2, 'password123');
    });

    describe('Background Creation', () => {
        it('should create a new campground successfully', async () => {
            const campgroundData = {
                title: 'Test Campground',
                price: 50,
                description: 'A beautiful test campground',
                location: 'Test Location',
                image: 'https://example.com/image.jpg',
                author: testUser1._id
            };

            campground = await Background.create(campgroundData);

            expect(campground).toBeDefined();
            expect(campground.title).toBe('Test Campground');
            expect(campground.price).toBe(50);
            expect(campground.author.toString()).toBe(testUser1._id.toString());
            expect(campground.review).toEqual([]);
        });

        it('should create multiple campgrounds', async () => {
            const campground1 = await Background.create({
                title: 'Campground 1',
                price: 30,
                description: 'Description 1',
                location: 'Location 1',
                image: 'https://example.com/image1.jpg',
                author: testUser1._id
            });

            const campground2 = await Background.create({
                title: 'Campground 2',
                price: 60,
                description: 'Description 2',
                location: 'Location 2',
                image: 'https://example.com/image2.jpg',
                author: testUser2._id
            });

            expect(campground1.title).toBe('Campground 1');
            expect(campground2.title).toBe('Campground 2');

            const allCampgrounds = await Background.find({});
            expect(allCampgrounds).toHaveLength(2);
        });
    });

    describe('Review Addition', () => {
        beforeEach(async () => {
            campground = await Background.create({
                title: 'Test Campground',
                price: 50,
                description: 'A beautiful test campground',
                location: 'Test Location',
                image: 'https://example.com/image.jpg',
                author: testUser1._id
            });
        });

        it('should add a review to a campground', async () => {
            const reviewData = {
                body: 'Great campground!',
                rating: 5,
                owner: testUser2._id
            };

            const review = await Review.create(reviewData);
            campground.review.push(review._id);
            await campground.save();

            const updatedCampground = await Background.findById(campground._id);
            expect(updatedCampground.review).toHaveLength(1);
            expect(updatedCampground.review[0].toString()).toBe(review._id.toString());

            const savedReview = await Review.findById(review._id);
            expect(savedReview.body).toBe('Great campground!');
            expect(savedReview.rating).toBe(5);
            expect(savedReview.owner.toString()).toBe(testUser2._id.toString());
        });

        it('should add multiple reviews from different users', async () => {
            const review1 = await Review.create({
                body: 'Excellent place!',
                rating: 5,
                owner: testUser1._id
            });

            const review2 = await Review.create({
                body: 'Nice campground!',
                rating: 4,
                owner: testUser2._id
            });

            campground.review.push(review1._id, review2._id);
            await campground.save();

            const updatedCampground = await Background.findById(campground._id);
            expect(updatedCampground.review).toHaveLength(2);
        });

        it('should validate review rating is within range', async () => {
            const reviewData = {
                body: 'Test review',
                rating: 3,
                owner: testUser1._id
            };

            const review = await Review.create(reviewData);
            expect(review.rating).toBe(3);
            expect(review.rating).toBeLessThanOrEqual(5);
            expect(review.rating).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Populate Reviews', () => {
        beforeEach(async () => {
            campground = await Background.create({
                title: 'Test Campground',
                price: 50,
                description: 'A beautiful test campground',
                location: 'Test Location',
                image: 'https://example.com/image.jpg',
                author: testUser1._id
            });

            const review1 = await Review.create({
                body: 'Review 1',
                rating: 5,
                owner: testUser1._id
            });

            const review2 = await Review.create({
                body: 'Review 2',
                rating: 4,
                owner: testUser2._id
            });

            campground.review.push(review1._id, review2._id);
            await campground.save();
        });

        it('should populate reviews with full details', async () => {
            const populatedCampground = await Background.findById(campground._id)
                .populate('review')
                .populate('author');

            expect(populatedCampground.review).toHaveLength(2);
            expect(populatedCampground.review[0]).toHaveProperty('body');
            expect(populatedCampground.review[0]).toHaveProperty('rating');
            expect(populatedCampground.review[0]).toHaveProperty('owner');
        });

        it('should populate nested owner information in reviews', async () => {
            const populatedCampground = await Background.findById(campground._id)
                .populate({
                    path: 'review',
                    populate: { path: 'owner' }
                });

            expect(populatedCampground.review).toHaveLength(2);
            expect(populatedCampground.review[0].owner).toHaveProperty('username');
            expect(populatedCampground.review[0].owner).toHaveProperty('email');
        });
    });

    describe('Rating Aggregation', () => {
        beforeEach(async () => {
            campground = await Background.create({
                title: 'Test Campground',
                price: 50,
                description: 'A beautiful test campground',
                location: 'Test Location',
                image: 'https://example.com/image.jpg',
                author: testUser1._id
            });
        });

        it('should calculate average rating from multiple reviews', async () => {
            const review1 = await Review.create({
                body: 'Excellent!',
                rating: 5,
                owner: testUser1._id
            });

            const review2 = await Review.create({
                body: 'Good!',
                rating: 4,
                owner: testUser2._id
            });

            const review3 = await Review.create({
                body: 'Great!',
                rating: 5,
                owner: testUser1._id
            });

            campground.review.push(review1._id, review2._id, review3._id);
            await campground.save();

            // Calculate average rating
            const populatedCampground = await Background.findById(campground._id)
                .populate('review');

            const ratings = populatedCampground.review.map(r => r.rating);
            const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;

            expect(averageRating).toBeCloseTo(4.67, 2);
            expect(ratings).toEqual([5, 4, 5]);
        });

        it('should handle single review rating', async () => {
            const review = await Review.create({
                body: 'Amazing place!',
                rating: 5,
                owner: testUser1._id
            });

            campground.review.push(review._id);
            await campground.save();

            const populatedCampground = await Background.findById(campground._id)
                .populate('review');

            const averageRating = populatedCampground.review[0].rating;
            expect(averageRating).toBe(5);
        });

        it('should get all ratings and calculate stats', async () => {
            const ratings = [5, 4, 3, 5, 4];
            
            for (const rating of ratings) {
                const review = await Review.create({
                    body: `Review with rating ${rating}`,
                    rating: rating,
                    owner: testUser1._id
                });
                campground.review.push(review._id);
            }
            await campground.save();

            const populatedCampground = await Background.findById(campground._id)
                .populate('review');

            const reviewRatings = populatedCampground.review.map(r => r.rating);
            const sum = reviewRatings.reduce((acc, r) => acc + r, 0);
            const avg = sum / reviewRatings.length;
            const min = Math.min(...reviewRatings);
            const max = Math.max(...reviewRatings);

            expect(avg).toBeCloseTo(4.2, 1);
            expect(min).toBe(3);
            expect(max).toBe(5);
            expect(reviewRatings).toHaveLength(5);
        });
    });

    describe('Complete Review Attachment Flow', () => {
        it('should complete full flow: Create Background → Add Reviews → Populate → Calculate Rating', async () => {
            // Step 1: Create Background
            const newCampground = await Background.create({
                title: 'Mountain View Camp',
                price: 75,
                description: 'Beautiful mountain views',
                location: 'Rocky Mountains',
                image: 'https://example.com/mountain.jpg',
                author: testUser1._id
            });

            expect(newCampground).toBeDefined();
            expect(newCampground.review).toHaveLength(0);

            // Step 2: Add multiple reviews
            const review1 = await Review.create({
                body: 'Stunning views!',
                rating: 5,
                owner: testUser1._id
            });

            const review2 = await Review.create({
                body: 'Loved the location!',
                rating: 4,
                owner: testUser2._id
            });

            const review3 = await Review.create({
                body: 'Perfect getaway!',
                rating: 5,
                owner: testUser1._id
            });

            newCampground.review.push(review1._id, review2._id, review3._id);
            await newCampground.save();

            // Step 3: Populate reviews with owner details
            const populatedCampground = await Background.findById(newCampground._id)
                .populate('author')
                .populate({
                    path: 'review',
                    populate: { path: 'owner' }
                });

            expect(populatedCampground.review).toHaveLength(3);
            expect(populatedCampground.author.username).toBe('user1');
            
            populatedCampground.review.forEach(review => {
                expect(review).toHaveProperty('body');
                expect(review).toHaveProperty('rating');
                expect(review.owner).toHaveProperty('username');
            });

            // Step 4: Aggregate rating
            const ratings = populatedCampground.review.map(r => r.rating);
            const averageRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;

            expect(averageRating).toBeCloseTo(4.67, 2);
            expect(ratings).toEqual([5, 4, 5]);

            // Verify data integrity
            expect(populatedCampground.title).toBe('Mountain View Camp');
            expect(populatedCampground.price).toBe(75);
            expect(populatedCampground.author.email).toBe('user1@example.com');
        });

        it('should handle campground with no reviews', async () => {
            const campgroundNoReviews = await Background.create({
                title: 'New Campground',
                price: 40,
                description: 'Brand new campground',
                location: 'New Location',
                image: 'https://example.com/new.jpg',
                author: testUser1._id
            });

            const populatedCampground = await Background.findById(campgroundNoReviews._id)
                .populate('review');

            expect(populatedCampground.review).toHaveLength(0);
            
            // Average rating should be 0 or undefined when no reviews
            const ratings = populatedCampground.review.map(r => r.rating);
            const averageRating = ratings.length > 0 
                ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length 
                : 0;

            expect(averageRating).toBe(0);
        });
    });
});
