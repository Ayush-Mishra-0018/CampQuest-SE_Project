const { connect, clearDatabase, closeDatabase } = require('./db');
const Background = require('../../../Models/Background');
const Review = require('../../../Models/review');
const User = require('../../../Models/User');

describe('Background Model', () => {
  beforeAll(async () => {
    await connect();
  });
  afterEach(async () => {
    await clearDatabase();
  });
  afterAll(async () => {
    await closeDatabase();
  });

  test('saves with minimal fields; missing optional fields undefined', async () => {
    const user = new User({ username: 'owner', email: 'owner@example.com' });
    await User.register(user, 'pw');
    const camp = new Background({ title: 'Test Camp', author: user._id });
    await camp.save();
    const found = await Background.findById(camp._id);
    expect(found).toBeTruthy();
    expect(found.title).toBe('Test Camp');
    expect(found.price).toBeUndefined();
    expect(found.description).toBeUndefined();
  });

  test('review array population returns full review documents', async () => {
    const user = new User({ username: 'owner2', email: 'owner2@example.com' });
    await User.register(user, 'pw');
    const r1 = await Review.create({ body: 'Nice', owner: user._id, rating: 4 });
    const r2 = await Review.create({ body: 'Great', owner: user._id, rating: 5 });
    const camp = await Background.create({ title: 'Pop Camp', author: user._id, review: [r1._id, r2._id] });

    const populated = await Background.findById(camp._id).populate('review');
    expect(populated.review.length).toBe(2);
    const ratings = populated.review.map(r => r.rating).sort();
    expect(ratings).toEqual([4,5]);
  });
});
