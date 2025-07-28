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

app.use('/api', whatsappInitialize);

app.listen(process.env.PORT || 5000, () => {
    console.log(`Server is running on port ${process.env.PORT || 5000}`);
});
