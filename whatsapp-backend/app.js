const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser'); 
const compression = require('compression');
const http = require('http');
const { Server } = require("socket.io");
const { initializeSocket } = require('./socketIoConnection');

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
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 1 month
    sameSite: 'Lax',
    path: '/'
  }
})

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

// Page routes
app.use('/', pageRoutes);


app.use((req, res, next) => {
    req.io = io;
    next();
});

// API Routes
app.use('/api/user', user);
app.use('/api/whatsapp', whatsapp);
app.use('/api/webhook', webhook);

// Initialize database and start server
initializeDatabase().then(() => {

  // Initialize socket only after database has been initialized. 
  initializeSocket(io);

  // Start server only after database is initialized
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(error => {
  console.error('Unable to initialize database:', error);
  process.exit(1);
});
