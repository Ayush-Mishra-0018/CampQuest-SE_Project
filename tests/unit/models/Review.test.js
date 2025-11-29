const { connect, clearDatabase, closeDatabase } = require('./db');
const Review = require('../../../Models/review');
const User = require('../../../Models/User');

describe('Review Model', () => {
  beforeAll(async () => {
    await connect();
  });
  afterEach(async () => {
    await clearDatabase();
  });
  afterAll(async () => {
    await closeDatabase();
  });

  test('rating above max(5) fails validation', async () => {
    const user = new User({ username: 'u', email: 'u@example.com' });
    await User.register(user, 'pw');
    const bad = new Review({ body: 'Too high', owner: user._id, rating: 6 });
    let error;
    try {
      await bad.save();
    } catch (e) {
      error = e;
    }
    expect(error).toBeTruthy();
    expect(error.name).toBe('ValidationError');
  });

  test('missing body still saves (schema does not require)', async () => {
    const user = new User({ username: 'v', email: 'v@example.com' });
    await User.register(user, 'pw');
    const review = new Review({ owner: user._id, rating: 4 });
    await review.save();
    const found = await Review.findById(review._id);
    expect(found).toBeTruthy();
    expect(found.body).toBeUndefined();
    expect(found.rating).toBe(4);
  });

  test('valid boundary rating 5 saves', async () => {
    const user = new User({ username: 'w', email: 'w@example.com' });
    await User.register(user, 'pw');
    const review = new Review({ body: 'Great', owner: user._id, rating: 5 });
    await review.save();
    const saved = await Review.findById(review._id);
    expect(saved.rating).toBe(5);
  });
});
