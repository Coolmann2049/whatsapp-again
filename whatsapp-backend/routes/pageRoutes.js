// routes/pageRoutes.js
const express = require('express');
const path = require('path');
const router = express.Router();
const { UserID } = require('../models');



// The login page is unprotected
router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// The root path serves the dashboard, but only if logged in
router.get('/', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// An alias for the dashboard
router.get('/dashboard', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// Starting message route
router.get('/starting-message', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'starting-message.html'));
});

// AI config route
router.get('/ai-config', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'ai-config.html'));
});

// Chat history route
router.get('/chat-history', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'chat-history.html'));
});

// Message config route
router.get('/message-config', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'message-config.html'));
});

// CSV upload route
router.get('/csv-upload', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'csv-upload.html'));
});

// Profile route
router.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'profile.html'));
});

// Devices route
router.get('/devices', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'devices.html'));
});




async function authMiddleware(req, res, next) {

    if (!req.session || !req.session.userId) {
        console.log('bruh');
        // No session or no userId in session, meaning user is NOT authenticated
        return res.redirect('/profile');
    }

    try {
        const user = await UserID.findByPk(req.session.userId);
        if (!user) {
            // User associated with session no longer exists in DB - destroy session
            req.session.destroy();
            return res.redirect('/profile');
        }
        req.user = user.toJSON(); // Attach user data (as plain object) to request
        next(); // User is authenticated, proceed to the next middleware/route handler

    } catch (error) {
        console.error("Error in authMiddleware during user lookup:", error);
        return res.redirect('/profile');
    }
}


module.exports = router;