const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const compression = require('compression');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use((req, res, next) => {
    console.log(`[INCOMING REQUEST] Method: ${req.method}, Path: ${req.originalUrl}`);
    next();
});

app.use(cors({
  origin: process.env.MAIN_BACKEND_URL || 'http://127.0.0.1:5500',
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(compression());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the whatsapp backend API' });
});


function vpsAuthMiddleware(req, res, next) {
    // 1. Get the secret key from the request header. A common practice is to use a custom 'X-' header.
    const providedKey = req.body.auth;
    const expectedKey = process.env.VPS_KEY;
    if (!expectedKey) {
        console.error('FATAL: VPS_KEY environment variable is not set on the worker.');
        return res.status(500).send('Internal Server Error: Authentication is not configured.');
    }
    if (providedKey === expectedKey) {
        return next();
    }

    res.status(401).send('Unauthorized');
}

app.use(vpsAuthMiddleware);

// Import router files
const whatsappInitialize = require('./routes/whatsapp-intialize');

const { restoreAllSessions, resumeRunningCampaigns } = require('./controllers/initialize'); // Note the simpler path

app.use('/api', whatsappInitialize);

const PORT = process.env.VPS_PORT || 5000;

app.listen(PORT, async () => {
    console.log(`Worker VPS is running on port ${PORT}`);
    
    try {
        // Use await to ensure we wait for the initial fetch and loop to start
        await restoreAllSessions();
        console.log('Session restoration process has been successfully initiated.');

        await resumeRunningCampaigns();
        console.log('Campaign resumption process has been successfully initiated.');
    } catch (error) {
        // This will catch any errors from the axios call or initial setup
        console.error('CRITICAL STARTUP ERROR: Failed to restore sessions.', error.message);
        // The server will continue running, but in a degraded state.
        // You might want to implement a health check endpoint that reports this failure.
    }
});