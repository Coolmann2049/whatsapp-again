const dotenv = require('dotenv');
const { UserID } = require('./models');

// Load environment variablFVes
dotenv.config();


function initializeSocket(io) {
    // This function sets up all the real-time connection logic.
    io.on('connection', async (socket) => {
        // Check for authentication via the session attached by the middleware
        const userSession = socket.request.session;
        if (userSession && userSession.userId) {

            const userId = userSession.userId;
            const email = userSession.email;
            const sanitizedEmail = email.replace(/[^a-zA-Z0-9_-]/g, '-');
            const user = await UserID.findByPk(userId);

            console.log(`✅ User connected via WebSocket: ${email}`);
            
            // Join a room named after the user. This is crucial for sending targeted messages.
            socket.join(sanitizedEmail);

            socket.on('disconnect', () => {
                console.log(`❌ User disconnected: ${email}`);
            });

            // Listen for this user to request a new QR code
            socket.on('request-new-qr', () => {
                console.log(`User ${email} is requesting a new QR code.`);

                if (user.count > 4) {
                    socket.emit('qr-request-error', { message: 'Max device limit of 4 reached' });
                    return;
                }

                fetch(`${process.env.VPS_URL}/api/initialize-session`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        clientId: `${userId}_${sanitizedEmail}_${user.count}`,
                        auth: process.env.VPS_KEY,
                    }),
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log(data.message); 
                    socket.emit('qr-code-initialized', "Initialization process started");

                })
                .catch(error => {
                    console.error('Error fetching QR code:', error);
                    socket.emit('qr-request-error', { message: 'Failed to initialize session' });
                });
            });
        } else {
            console.warn(`⚠️ Unauthenticated socket connection attempt rejected.`);
            socket.disconnect(true);
        }
    });
}

module.exports = { initializeSocket };