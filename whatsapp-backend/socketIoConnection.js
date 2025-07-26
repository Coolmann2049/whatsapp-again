function initializeSocket(io) {
    // This function sets up all the real-time connection logic.
    io.on('connection', (socket) => {
        // Check for authentication via the session attached by the middleware
        const userSession = socket.request.session;

        if (userSession && userSession.userId) {
            const email = userSession.email;
            console.log(`✅ User connected via WebSocket: ${email}`);
            
            // Join a room named after the user. This is crucial for sending targeted messages.
            socket.join(email);

            socket.on('disconnect', () => {
                console.log(`❌ User disconnected: ${email}`);
            });

            // Listen for this user to request a new QR code
            socket.on('request-new-qr', () => {
                console.log(`User ${email} is requesting a new QR code.`);

                socket.emit('qr-code-update', '123456');
                console.log('done');
            });

        } else {
            console.warn(`⚠️ Unauthenticated socket connection attempt rejected.`);
            socket.disconnect(true);
        }
    });
}

module.exports = { initializeSocket };