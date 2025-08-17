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
            const user = await UserID.findByPk(userId);

            console.log(`✅ User connected via WebSocket: ${user.email}`);
            
            // Join a room named after the user. This is crucial for sending targeted messages.
            socket.join(userId);

            socket.on('disconnect', () => {
                console.log(`❌ User disconnected: ${user.email}`);
            });

            // Listen for this user to request a new QR code
            socket.on('request-new-qr', async () => {
                console.log(`User ${user.email} is requesting a new QR code.`);

                if (user.count > 4) {
                    socket.emit('qr-request-error', { message: 'Max device limit of 4 reached' });
                    return;
                }
                user.device_id_counter += 1;
        
                // 2. Save the user to persist the new counter value
                await user.save();
                
                // 3. Use the new counter value as the unique deviceId
                const newDeviceId = user.device_id_counter;
                const clientId = `${userId}_${newDeviceId}`;
                fetch(`${process.env.VPS_URL}/api/initialize-session`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        clientId,
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