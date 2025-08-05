const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const MemoryStore = require('memorystore')(session); // 1. Import memorystore
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser'); 
const compression = require('compression');
const http = require('http');
const { Server } = require("socket.io");
const { initializeSocket } = require('./socketIoConnection');
const { startAnalyticsJob } = require('./cron/analyticsJob');

// Load environment variables
dotenv.config();

const { sequelize, initializeDatabase,UserID  } = require('./models/index');

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// Middleware

app.use((req, res, next) => {
    console.log(`[INCOMING REQUEST] Method: ${req.method}, Path: ${req.originalUrl}`);
    next();
});

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://127.0.0.1:5500',
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser()); 
app.use(compression());

// Session middleware

const sessionMiddleware = session({
    store: new MemoryStore({
        checkPeriod: 86400000 // Prune expired entries every 24h
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, 
        sameSite: 'lax', 
        path: '/'
    }
});

app.use(sessionMiddleware);
app.use(express.static('public')); // Serve static files from 'public'

io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});


// Import routers 
const pageRoutes = require('./routes/pageRoutes');
const user = require('./routes/user');
const whatsapp = require('./routes/whatsapp');
const webhook = require('./routes/webhooks');
const csv = require('./routes/csv');
const data = require('./routes/data');
const chat = require('./routes/chat');

// Page routes
app.use('/', pageRoutes);

app.use((req, res, next) => {
    req.io = io;
    next();
});

// API Routes protected by logic in the routes itself
app.use('/api/user', user);
app.use('/api/webhook', webhook);

app.use(authMiddleware);

// API routes where the request should be sent from the frontend itself
app.use('/api/whatsapp', whatsapp);
app.use('/api/csv', csv);
app.use('/api/data', data);
app.use('/api/chat', chat)
// Initialize database and start server
initializeDatabase().then(() => {

  // Initialize socket only after database has been initialized. 
  initializeSocket(io);

  // Start server only after database is initialized
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);

    // Start the cron job
    startAnalyticsJob();
  });
}).catch(error => {
  console.error('Unable to initialize database:', error);
  process.exit(1);
});


async function authMiddleware(req, res, next) {

    if (!req.session || !req.session.userId) {
        console.log('bruh');
        // No session or no userId in session, meaning user is NOT authenticated
        return res.status(401).json({ message: 'Unauthorized: Please log in.' });
    }

    try {
        const user = await UserID.findByPk(req.session.userId);

        if (!user) {
            // User associated with session no longer exists in DB - destroy session
            req.session.destroy();
            return res.status(401).json({ message: 'Unauthorized: Please log in.' });
        }

        req.user = user.toJSON();
        next(); // User is authenticated, proceed to the next middleware/route handler

    } catch (error) {
        console.error("Error in authMiddleware during user lookup:", error);
        return res.status(500).json({ message: 'Internal server error during authentication.' });
    }
}
