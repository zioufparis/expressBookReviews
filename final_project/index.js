const express = require('express');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const customer_routes = require('./router/auth_users.js').authenticated;
const genl_routes = require('./router/general.js').general;

const app = express();

// In-memory storage for reviews (You can replace it with a database later)
let reviews = []; // Example: [{ username: 'user1', isbn: '1234567890', review: 'Great book!' }]
let users = []; // Added: In-memory user storage

app.use(express.json());

// Session configuration
app.use("/customer", session({ secret: "fingerprint_customer", resave: true, saveUninitialized: true }));

// Route to register a new user
app.post("/register", (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    // Check if both username and password are provided
    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
    }

    // Check if the user already exists
    const userExists = users.some(u => u.username === username); // Check for existing user

    if (userExists) {
        return res.status(409).json({ message: "User already exists" });
    }

    // Add the new user to the users array (in-memory)
    users.push({ username, password });

    return res.status(201).json({ message: "User successfully registered. Now you can login" });
});

// Route to login a user
app.post("/customer/login", (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    // Validate user credentials (In a real app, check against a database)
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
    }

    // Create JWT token
    const token = jwt.sign({ username: user.username }, "access", { expiresIn: '1h' });

    // Save token in session
    req.session.authorization = { accessToken: token };

    return res.status(200).json({ message: "User successfully logged in", accessToken: token });
});

// Route to post or modify a book review
app.post("/customer/review", (req, res) => {
    const { isbn, review } = req.query;  // ISBN and review come from the query parameters

    // Check if the JWT token is provided in the Authorization header
    const token = req.headers['authorization']?.split(' ')[1];  // Extract token from the Authorization header

    if (!token) {
        return res.status(403).json({ message: "User not logged in" });
    }

    jwt.verify(token, "access", (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Invalid token. User not authenticated" });
        }

        // Ensure ISBN and review are provided
        if (!isbn || !review) {
            return res.status(400).json({ message: "ISBN and review are required" });
        }

        // Find the existing review for the given ISBN
        const existingReviewIndex = reviews.findIndex(r => r.isbn === isbn && r.username === user.username);

        if (existingReviewIndex !== -1) {
            // Modify the existing review
            reviews[existingReviewIndex].review = review;
            return res.status(200).json({ message: "Review updated successfully" });
        } else {
            // Add new review for the given ISBN
            reviews.push({ username: user.username, isbn, review });
            return res.status(201).json({ message: "Review added successfully" });
        }
    });
});

// Route to delete a book review
app.delete("/customer/auth/review/:isbn", (req, res) => {
    const { isbn } = req.params;  // ISBN comes from the URL parameter
    const token = req.session.authorization?.accessToken;

    // Check if the user is logged in
    if (!token) {
        return res.status(403).json({ message: "User not logged in" });
    }

    // Verify the JWT token
    jwt.verify(token, "access", (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Invalid token. User not authenticated" });
        }

        // Find the review to delete (based on ISBN and username)
        const reviewIndex = reviews.findIndex(r => r.isbn === isbn && r.username === user.username);

        if (reviewIndex === -1) {
            return res.status(404).json({ message: "Review not found" });
        }

        // Delete the review
        reviews.splice(reviewIndex, 1);

        return res.status(200).json({ message: "Review deleted successfully" });
    });
});

// Middleware for authenticating routes that require login
app.use("/customer/auth/*", function auth(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];  // Extract token from the Authorization header

    if (!token) {
        return res.status(403).json({ message: "User not logged in" });
    }

    jwt.verify(token, "access", (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Invalid token. User not authenticated" });
        }

        req.user = user;  // Add user to the request object
        next(); // Proceed to the next middleware
    });
});

// Sample protected route
app.get("/customer/auth/secret", (req, res) => {
    res.json({ message: "This is a secret route" });
});

const PORT = 5000;
app.use("/customer", customer_routes);
app.use("/", genl_routes);

app.listen(PORT, () => console.log("Server is running"));
