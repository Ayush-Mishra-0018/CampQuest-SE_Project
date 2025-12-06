const Background = require('../../Models/Background');
const Review = require('../../Models/review');
const User = require('../../Models/User');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./setup');

describe('Integration Tests: Cascade Deletion', () => {
    let testUser1;
    let testUser2;
    let campground1;
    let campground2;

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

        // Create test campgrounds
        campground1 = await Background.create({
            title: 'Campground 1',
            price: 50,
            description: 'First campground',
            location: 'Location 1',
            image: 'https://example.com/image1.jpg',
            author: testUser1._id
        });

        campground2 = await Background.create({
            title: 'Campground 2',
            price: 60,
            description: 'Second campground',
            location: 'Location 2',
            image: 'https://example.com/image2.jpg',
            author: testUser2._id
        });
    });

    describe('Delete Background with Reviews', () => {
        it('should delete campground and all its reviews', async () => {
            // Add reviews to campground1
            const review1 = await Review.create({
                body: 'Great place!',
                rating: 5,
                owner: testUser1._id
            });

            const review2 = await Review.create({
                body: 'Nice campground!',
                rating: 4,
                owner: testUser2._id
            });

            campground1.review.push(review1._id, review2._id);
            await campground1.save();

            // Verify reviews exist
            let allReviews = await Review.find({});
            expect(allReviews).toHaveLength(2);

            // Delete campground (should trigger cascade deletion)
            await Background.findByIdAndDelete(campground1._id);

            // Verify campground is deleted
            const deletedCampground = await Background.findById(campground1._id);
            expect(deletedCampground).toBeNull();

            // Verify reviews are deleted (cascade deletion)
            allReviews = await Review.find({});
            expect(allReviews).toHaveLength(0);
        });

        it('should delete campground with multiple reviews', async () => {
            // Add 5 reviews to campground1
            const reviewIds = [];
            for (let i = 1; i <= 5; i++) {
                const review = await Review.create({
                    body: `Review ${i}`,
                    rating: i,
                    owner: testUser1._id
                });
                reviewIds.push(review._id);
            }

            campground1.review = reviewIds;
            await campground1.save();

            // Verify initial state
            let allReviews = await Review.find({});
            expect(allReviews).toHaveLength(5);

            // Delete campground
            await Background.findByIdAndDelete(campground1._id);

            // Verify all reviews are deleted
            allReviews = await Review.find({});
            expect(allReviews).toHaveLength(0);

            // Verify campground is deleted
            const deletedCampground = await Background.findById(campground1._id);
            expect(deletedCampground).toBeNull();
        });

        it('should handle deletion of campground with no reviews', async () => {
            // Campground1 has no reviews
            const initialCampgrounds = await Background.find({});
            expect(initialCampgrounds).toHaveLength(2);

            // Delete campground with no reviews
            await Background.findByIdAndDelete(campground1._id);

            // Verify campground is deleted
            const remainingCampgrounds = await Background.find({});
            expect(remainingCampgrounds).toHaveLength(1);
            expect(remainingCampgrounds[0]._id.toString()).toBe(campground2._id.toString());
        });
    });

    describe('Orphan Cleanup Verification', () => {
        it('should only delete reviews belonging to deleted campground', async () => {
            // Add reviews to both campgrounds
            const review1 = await Review.create({
                body: 'Review for campground 1',
                rating: 5,
                owner: testUser1._id
            });

            const review2 = await Review.create({
                body: 'Another review for campground 1',
                rating: 4,
                owner: testUser2._id
            });

            const review3 = await Review.create({
                body: 'Review for campground 2',
                rating: 3,
                owner: testUser1._id
            });

            campground1.review.push(review1._id, review2._id);
            await campground1.save();

            campground2.review.push(review3._id);
            await campground2.save();

            // Verify initial state
            let allReviews = await Review.find({});
            expect(allReviews).toHaveLength(3);

            // Delete campground1
            await Background.findByIdAndDelete(campground1._id);

            // Verify only reviews from campground1 are deleted
            allReviews = await Review.find({});
            expect(allReviews).toHaveLength(1);
            expect(allReviews[0]._id.toString()).toBe(review3._id.toString());
            expect(allReviews[0].body).toBe('Review for campground 2');

            // Verify campground2 and its review still exist
            const remainingCampground = await Background.findById(campground2._id);
            expect(remainingCampground).toBeDefined();
            expect(remainingCampground.review).toHaveLength(1);
        });

        it('should not leave orphaned reviews after campground deletion', async () => {
            // Create reviews
            const review1 = await Review.create({
                body: 'Test review 1',
                rating: 5,
                owner: testUser1._id
            });

            const review2 = await Review.create({
                body: 'Test review 2',
                rating: 4,
                owner: testUser2._id
            });

            campground1.review.push(review1._id, review2._id);
            await campground1.save();

            const reviewIdsBefore = [review1._id.toString(), review2._id.toString()];

            // Delete campground
            await Background.findByIdAndDelete(campground1._id);

            // Try to find the reviews by their IDs
            const orphanedReview1 = await Review.findById(review1._id);
            const orphanedReview2 = await Review.findById(review2._id);

            // Both should be null (deleted)
            expect(orphanedReview1).toBeNull();
            expect(orphanedReview2).toBeNull();

            // Verify no reviews exist with those IDs
            const allReviews = await Review.find({
                _id: { $in: reviewIdsBefore }
            });
            expect(allReviews).toHaveLength(0);
        });
    });

    describe('Verify Unaffected Reviews', () => {
        it('should not affect reviews from other campgrounds', async () => {
            // Add reviews to campground1
            const review1Camp1 = await Review.create({
                body: 'Review 1 for camp 1',
                rating: 5,
                owner: testUser1._id
            });

            const review2Camp1 = await Review.create({
                body: 'Review 2 for camp 1',
                rating: 4,
                owner: testUser2._id
            });

            campground1.review.push(review1Camp1._id, review2Camp1._id);
            await campground1.save();

            // Add reviews to campground2
            const review1Camp2 = await Review.create({
                body: 'Review 1 for camp 2',
                rating: 3,
                owner: testUser1._id
            });

            const review2Camp2 = await Review.create({
                body: 'Review 2 for camp 2',
                rating: 5,
                owner: testUser2._id
            });

            campground2.review.push(review1Camp2._id, review2Camp2._id);
            await campground2.save();

            // Verify initial state
            let allReviews = await Review.find({});
            expect(allReviews).toHaveLength(4);

            // Delete campground1
            await Background.findByIdAndDelete(campground1._id);

            // Verify campground2's reviews are unaffected
            allReviews = await Review.find({});
            expect(allReviews).toHaveLength(2);

            const camp2Reviews = allReviews.map(r => r._id.toString());
            expect(camp2Reviews).toContain(review1Camp2._id.toString());
            expect(camp2Reviews).toContain(review2Camp2._id.toString());

            // Verify content of remaining reviews
            const remainingReview1 = await Review.findById(review1Camp2._id);
            const remainingReview2 = await Review.findById(review2Camp2._id);

            expect(remainingReview1.body).toBe('Review 1 for camp 2');
            expect(remainingReview2.body).toBe('Review 2 for camp 2');

            // Verify campground2 still has its reviews
            const updatedCampground2 = await Background.findById(campground2._id);
            expect(updatedCampground2.review).toHaveLength(2);
        });

        it('should maintain data integrity after multiple deletions', async () => {
            // Create third campground
            const campground3 = await Background.create({
                title: 'Campground 3',
                price: 70,
                description: 'Third campground',
                location: 'Location 3',
                image: 'https://example.com/image3.jpg',
                author: testUser1._id
            });

            // Add reviews to all three campgrounds
            const review1 = await Review.create({
                body: 'Camp 1 review',
                rating: 5,
                owner: testUser1._id
            });

            const review2 = await Review.create({
                body: 'Camp 2 review',
                rating: 4,
                owner: testUser2._id
            });

            const review3 = await Review.create({
                body: 'Camp 3 review',
                rating: 3,
                owner: testUser1._id
            });

            campground1.review.push(review1._id);
            await campground1.save();

            campground2.review.push(review2._id);
            await campground2.save();

            campground3.review.push(review3._id);
            await campground3.save();

            // Delete campground1
            await Background.findByIdAndDelete(campground1._id);

            // Verify state after first deletion
            let remainingReviews = await Review.find({});
            expect(remainingReviews).toHaveLength(2);

            // Delete campground3
            await Background.findByIdAndDelete(campground3._id);

            // Verify only campground2's review remains
            remainingReviews = await Review.find({});
            expect(remainingReviews).toHaveLength(1);
            expect(remainingReviews[0]._id.toString()).toBe(review2._id.toString());

            // Verify campground2 still exists with its review
            const finalCampground = await Background.findById(campground2._id);
            expect(finalCampground).toBeDefined();
            expect(finalCampground.review).toHaveLength(1);
            expect(finalCampground.title).toBe('Campground 2');
        });
    });

    describe('Complete Cascade Deletion Flow', () => {
        it('should complete full flow: Create Campground → Add Reviews → Delete → Verify Cleanup', async () => {
            // Step 1: Create a new campground
            const testCampground = await Background.create({
                title: 'Test Delete Camp',
                price: 85,
                description: 'Campground for deletion test',
                location: 'Test Location',
                image: 'https://example.com/test.jpg',
                author: testUser1._id
            });

            expect(testCampground).toBeDefined();

            // Step 2: Add multiple reviews
            const review1 = await Review.create({
                body: 'Amazing place!',
                rating: 5,
                owner: testUser1._id
            });

            const review2 = await Review.create({
                body: 'Beautiful scenery!',
                rating: 5,
                owner: testUser2._id
            });

            const review3 = await Review.create({
                body: 'Highly recommend!',
                rating: 4,
                owner: testUser1._id
            });

            testCampground.review.push(review1._id, review2._id, review3._id);
            await testCampground.save();

            // Step 3: Verify setup
            let campground = await Background.findById(testCampground._id);
            expect(campground.review).toHaveLength(3);

            let allReviews = await Review.find({});
            const testReviewCount = allReviews.filter(r => 
                [review1._id.toString(), review2._id.toString(), review3._id.toString()]
                .includes(r._id.toString())
            ).length;
            expect(testReviewCount).toBe(3);

            // Step 4: Delete campground
            await Background.findByIdAndDelete(testCampground._id);

            // Step 5: Verify campground deletion
            campground = await Background.findById(testCampground._id);
            expect(campground).toBeNull();

            // Step 6: Verify all associated reviews are deleted (orphan cleanup)
            const deletedReview1 = await Review.findById(review1._id);
            const deletedReview2 = await Review.findById(review2._id);
            const deletedReview3 = await Review.findById(review3._id);

            expect(deletedReview1).toBeNull();
            expect(deletedReview2).toBeNull();
            expect(deletedReview3).toBeNull();

            // Step 7: Verify other campgrounds are unaffected
            const unaffectedCampground1 = await Background.findById(campground1._id);
            const unaffectedCampground2 = await Background.findById(campground2._id);

            expect(unaffectedCampground1).toBeDefined();
            expect(unaffectedCampground2).toBeDefined();
            expect(unaffectedCampground1.title).toBe('Campground 1');
            expect(unaffectedCampground2.title).toBe('Campground 2');
        });

        it('should handle edge case: delete campground with reviews from same user', async () => {
            // Single user creates multiple reviews
            const review1 = await Review.create({
                body: 'First visit review',
                rating: 5,
                owner: testUser1._id
            });

            const review2 = await Review.create({
                body: 'Second visit review',
                rating: 4,
                owner: testUser1._id
            });

            const review3 = await Review.create({
                body: 'Third visit review',
                rating: 5,
                owner: testUser1._id
            });

            campground1.review.push(review1._id, review2._id, review3._id);
            await campground1.save();

            // Verify setup
            const allReviewsBefore = await Review.find({ owner: testUser1._id });
            expect(allReviewsBefore.length).toBeGreaterThanOrEqual(3);

            // Delete campground
            await Background.findByIdAndDelete(campground1._id);

            // Verify all reviews from that campground are deleted
            const review1After = await Review.findById(review1._id);
            const review2After = await Review.findById(review2._id);
            const review3After = await Review.findById(review3._id);

            expect(review1After).toBeNull();
            expect(review2After).toBeNull();
            expect(review3After).toBeNull();
        });
    });
});
