const { connect, clearDatabase, closeDatabase } = require('./db');
const User = require('../../../Models/User');

describe('User Model', () => {
  beforeAll(async () => {
    await connect();
  });
  afterEach(async () => {
    await clearDatabase();
  });
  afterAll(async () => {
    await closeDatabase();
  });

  test('register stores password securely (not in plain text) and enforces unique email', async () => {
    const newUser = new User({ username: 'alice', email: 'alice@example.com' });
    await User.register(newUser, 'plaintext123');
    const saved = await User.findOne({ username: 'alice' });
    expect(saved).toBeTruthy();
    expect(saved.email).toBe('alice@example.com');
    // Ensure raw password is not stored anywhere
    const serialized = JSON.stringify(saved.toObject());
    expect(serialized.includes('plaintext123')).toBe(false);
    // Authentication proves password hashing worked
    const authenticate = User.authenticate();
    const authResult = await new Promise((resolve) => {
      authenticate('alice', 'plaintext123', (err, user) => {
        if (err) return resolve(false);
        resolve(!!user);
      });
    });
    expect(authResult).toBe(true);
  });

  test('duplicate email triggers Mongo duplicate key error', async () => {
    const u1 = new User({ username: 'bob', email: 'bob@example.com' });
    await User.register(u1, 'secret');
    const u2 = new User({ username: 'bobby', email: 'bob@example.com' });
    let error;
    try {
      await User.register(u2, 'another');
    } catch (e) {
      error = e;
    }
    expect(error).toBeTruthy();
    // Mongo duplicate key error code
    expect(error.code).toBe(11000);
  });

  test('authentication success and failure', async () => {
    const u = new User({ username: 'charlie', email: 'charlie@example.com' });
    await User.register(u, 'passwordXYZ');
    const authenticate = User.authenticate();

    // Successful auth
    const success = await new Promise((resolve) => {
      authenticate('charlie', 'passwordXYZ', (err, user, info) => {
        if (err) return resolve({ ok: false });
        resolve({ ok: !!user, user, info });
      });
    });
    expect(success.ok).toBe(true);
    expect(success.user.username).toBe('charlie');

    // Failed auth with wrong password
    const failure = await new Promise((resolve) => {
      authenticate('charlie', 'wrongPass', (err, user, info) => {
        if (err) return resolve({ ok: false });
        resolve({ ok: !!user, user, info });
      });
    });
    expect(failure.ok).toBe(false);
    expect(failure.user).toBeFalsy();
  });
});
