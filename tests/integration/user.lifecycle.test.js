const request = require('supertest');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('../../Models/User');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./setup');

// Create a minimal Express app for testing authentication
const createTestApp = () => {
    const app = express();
    
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    
    // Session configuration
    app.use(session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false }
    }));
    
    // Passport initialization
    app.use(passport.initialize());
    app.use(passport.session());
    passport.use(new LocalStrategy(User.authenticate()));
    passport.serializeUser(User.serializeUser());
    passport.deserializeUser(User.deserializeUser());
    
    // Routes for testing
    app.post('/register', async (req, res) => {
        try {
            const { email, username, password } = req.body;
            const user = new User({ email, username });
            const registeredUser = await User.register(user, password);
            
            req.login(registeredUser, (err) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.status(201).json({ 
                    success: true, 
                    user: { 
                        id: registeredUser._id,
                        username: registeredUser.username,
                        email: registeredUser.email
                    }
                });
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    app.post('/login', passport.authenticate('local'), (req, res) => {
        res.status(200).json({ 
            success: true, 
            user: { 
                id: req.user._id,
                username: req.user.username,
                email: req.user.email
            }
        });
    });
    
    app.post('/logout', (req, res) => {
        req.logout((err) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.status(200).json({ success: true, message: 'Logged out' });
        });
    });
    
    app.get('/profile', (req, res) => {
        if (req.isAuthenticated()) {
            res.status(200).json({ 
                authenticated: true, 
                user: {
                    id: req.user._id,
                    username: req.user.username,
                    email: req.user.email
                }
            });
        } else {
            res.status(401).json({ authenticated: false });
        }
    });
    
    return app;
};

describe('Integration Tests: User Lifecycle', () => {
    let app;
    let agent;

    beforeAll(async () => {
        await setupTestDB();
        app = createTestApp();
    });

    afterAll(async () => {
        await teardownTestDB();
    });

    beforeEach(async () => {
        await clearTestDB();
        agent = request.agent(app); // Use agent to persist cookies/sessions
    });

    describe('User Registration', () => {
        it('should register a new user successfully', async () => {
            const response = await agent
                .post('/register')
                .send({
                    email: 'test@example.com',
                    username: 'testuser',
                    password: 'password123'
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.user).toHaveProperty('username', 'testuser');
            expect(response.body.user).toHaveProperty('email', 'test@example.com');
            expect(response.body.user).toHaveProperty('id');
        });

        it('should not allow duplicate usernames', async () => {
            // Register first user
            await agent
                .post('/register')
                .send({
                    email: 'test1@example.com',
                    username: 'testuser',
                    password: 'password123'
                });

            // Try to register with same username
            const response = await agent
                .post('/register')
                .send({
                    email: 'test2@example.com',
                    username: 'testuser',
                    password: 'password456'
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        it('should not allow duplicate emails', async () => {
            // Register first user
            await agent
                .post('/register')
                .send({
                    email: 'test@example.com',
                    username: 'testuser1',
                    password: 'password123'
                });

            // Try to register with same email
            const response = await agent
                .post('/register')
                .send({
                    email: 'test@example.com',
                    username: 'testuser2',
                    password: 'password456'
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('User Login', () => {
        beforeEach(async () => {
            // Create a user for login tests
            const user = new User({ 
                email: 'login@example.com', 
                username: 'loginuser' 
            });
            await User.register(user, 'password123');
        });

        it('should login successfully with correct credentials', async () => {
            const response = await agent
                .post('/login')
                .send({
                    username: 'loginuser',
                    password: 'password123'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.user).toHaveProperty('username', 'loginuser');
        });

        it('should reject login with incorrect password', async () => {
            const response = await agent
                .post('/login')
                .send({
                    username: 'loginuser',
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(401);
        });

        it('should reject login with non-existent username', async () => {
            const response = await agent
                .post('/login')
                .send({
                    username: 'nonexistent',
                    password: 'password123'
                });

            expect(response.status).toBe(401);
        });
    });

    describe('Session Persistence', () => {
        it('should maintain session after registration', async () => {
            // Register a user
            const registerResponse = await agent
                .post('/register')
                .send({
                    email: 'session@example.com',
                    username: 'sessionuser',
                    password: 'password123'
                });

            expect(registerResponse.status).toBe(201);

            // Check if user is authenticated without logging in again
            const profileResponse = await agent.get('/profile');

            expect(profileResponse.status).toBe(200);
            expect(profileResponse.body.authenticated).toBe(true);
            expect(profileResponse.body.user.username).toBe('sessionuser');
        });

        it('should maintain session after login', async () => {
            // Create a user
            const user = new User({ 
                email: 'persist@example.com', 
                username: 'persistuser' 
            });
            await User.register(user, 'password123');

            // Login
            const loginResponse = await agent
                .post('/login')
                .send({
                    username: 'persistuser',
                    password: 'password123'
                });

            expect(loginResponse.status).toBe(200);

            // Check if session persists
            const profileResponse = await agent.get('/profile');

            expect(profileResponse.status).toBe(200);
            expect(profileResponse.body.authenticated).toBe(true);
            expect(profileResponse.body.user.username).toBe('persistuser');
        });

        it('should not be authenticated without login', async () => {
            const response = await agent.get('/profile');

            expect(response.status).toBe(401);
            expect(response.body.authenticated).toBe(false);
        });
    });

    describe('User Logout', () => {
        it('should logout successfully and clear session', async () => {
            // Register and login
            await agent
                .post('/register')
                .send({
                    email: 'logout@example.com',
                    username: 'logoutuser',
                    password: 'password123'
                });

            // Verify logged in
            let profileResponse = await agent.get('/profile');
            expect(profileResponse.body.authenticated).toBe(true);

            // Logout
            const logoutResponse = await agent.post('/logout');
            expect(logoutResponse.status).toBe(200);
            expect(logoutResponse.body.success).toBe(true);

            // Verify session cleared
            profileResponse = await agent.get('/profile');
            expect(profileResponse.status).toBe(401);
            expect(profileResponse.body.authenticated).toBe(false);
        });
    });

    describe('Complete User Lifecycle', () => {
        it('should complete full lifecycle: Register → Login → Session → Logout', async () => {
            // Step 1: Register
            const registerResponse = await agent
                .post('/register')
                .send({
                    email: 'lifecycle@example.com',
                    username: 'lifecycleuser',
                    password: 'password123'
                });

            expect(registerResponse.status).toBe(201);
            expect(registerResponse.body.success).toBe(true);

            // Step 2: Verify session after registration
            let profileResponse = await agent.get('/profile');
            expect(profileResponse.status).toBe(200);
            expect(profileResponse.body.authenticated).toBe(true);
            expect(profileResponse.body.user.username).toBe('lifecycleuser');

            // Step 3: Logout
            const logoutResponse = await agent.post('/logout');
            expect(logoutResponse.status).toBe(200);

            // Step 4: Verify session cleared after logout
            profileResponse = await agent.get('/profile');
            expect(profileResponse.status).toBe(401);
            expect(profileResponse.body.authenticated).toBe(false);

            // Step 5: Login again
            const loginResponse = await agent
                .post('/login')
                .send({
                    username: 'lifecycleuser',
                    password: 'password123'
                });

            expect(loginResponse.status).toBe(200);
            expect(loginResponse.body.success).toBe(true);

            // Step 6: Verify session restored after login
            profileResponse = await agent.get('/profile');
            expect(profileResponse.status).toBe(200);
            expect(profileResponse.body.authenticated).toBe(true);
            expect(profileResponse.body.user.username).toBe('lifecycleuser');

            // Step 7: Final logout
            await agent.post('/logout');
            profileResponse = await agent.get('/profile');
            expect(profileResponse.status).toBe(401);
            expect(profileResponse.body.authenticated).toBe(false);
        });
    });
});
