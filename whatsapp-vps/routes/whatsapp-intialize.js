// On your Worker VPS
const express = require('express');
const router = express.Router();
const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios'); // To send webhooks to the Main Backend
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const MAIN_BACKEND_URL = process.env.MAIN_BACKEND_URL;

// 1. The container for all your client instances
const activeClients = {};

/**
 * Creates and initializes a new whatsapp-web.js client instance.
 * @param {string} clientId - A unique identifier for the client (e.g., their username or user ID).
 */

function initializeClient(clientId) {
    console.log(`Initializing client for: ${clientId}`);

    const client = new Client({
        // Use LocalAuth to save session data, ensuring each client has their own folder
        authStrategy: new LocalAuth({ clientId: clientId }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    // --- Event Listeners for this specific client ---

    client.on('qr', (qr) => {
        console.log(`[${clientId}] QR Code received. Sending to Main Backend.`);
        // Send the QR code back to your Main Backend to be relayed to the frontend
        axios.post(`${MAIN_BACKEND_URL}/api/webhook/whatsapp-qr-update`, { clientId, qrCode: qr, auth: process.env.VPS_KEY });
    });

    client.on('ready', () => {
        console.log(`[${clientId}] Client is ready!`);

        // Access information about the logged-in account
        const userName = client.info.pushname;
        const userPhone = client.info.wid.user;

        console.log(userName , userPhone);
        // Notify the Main Backend that the connection is successful
        axios.post(`${MAIN_BACKEND_URL}/api/webhook/whatsapp-status-update`, { 
            clientId, 
            status: 'connected',
            userName,
            userPhone,
            auth: process.env.VPS_KEY
        });
    });

    client.on('disconnected', (reason) => {
        console.log(`[${clientId}] Client was logged out. Reason:`, reason);

        const userName = client.info.pushname;
        const userPhone = client.info.wid.user;

        axios.post(`${MAIN_BACKEND_URL}/api/webhook/whatsapp-status-update`, { 
            clientId, 
            status: 'disconnected',
            userName,
            userPhone,
            auth: process.env.VPS_KEY
        });

        // Clean up the disconnected client
        delete activeClients[clientId];
    });

    client.on('message', (message) => {
        // Handle incoming messages for this client
        console.log(`[${clientId}] Received message:`, message.body);
    });

    // Start the initialization process
    client.initialize();

    // 2. Store the new client instance in our container
    activeClients[clientId] = client;
}

async function sendTestMessage(client, number, message) {
    try {
        // Format the number to the correct WhatsApp ID format
        const chatId = `${number}@c.us`;
        
        // Send the message
        const sentMessage = await client.sendMessage(chatId, message);
        console.log(`[${client.info.me.user}] Successfully sent test message to ${number}`);
        console.log(sentMessage);
        // Return the confirmation from the library
        return sentMessage;
    } catch (error) {
        console.error(`[${client.info.me.user}] Failed to send message to ${number}:`, error);
        // Throw the error so the endpoint can catch it and send a 500 response
        throw new Error('Failed to send message. The number might be invalid or not on WhatsApp.');
    }
}


// --- API Endpoint to create new instances ---

router.post('/initialize-session', (req, res) => {

    console.log('reached to this shit');
    const { clientId } = req.body;
    if (!clientId) {
        return res.status(400).send('clientId is required.');
    }
    if (activeClients[clientId]) {
        return res.status(200).send('Client already initialized.');
    }

    initializeClient(clientId);
    res.status(200).send({'message':'Initialization process started.'});
});


router.post('/disconnect-session', async (req, res) => {

    const { clientId } = req.body;

    if (!clientId) {
        return res.status(400).send('clientId is required.');
    }

    const client = activeClients[clientId];
    if (client) {
        console.log(`[${clientId}] Disconnection requested. Logging out...`);

        const userName = client.info.pushname;
        const userPhone = client.info.wid.user;
        
        axios.post(`${MAIN_BACKEND_URL}/api/webhook/whatsapp-status-update`, { 
            clientId, 
            status: 'disconnected',
            userName,
            userPhone,
            auth: process.env.VPS_KEY
        });

        // Clean up the disconnected client
        delete activeClients[clientId];
        // This will trigger the 'disconnected' event listener automatically
        await client.destroy();

        res.status(200).send('Disconnection process initiated.');
    } else {
        res.status(404).send('Client not found or already disconnected.');
    }
});

router.post('/send-test-message', async (req, res) => {
    const { clientId, number, message } = req.body;

    // 1. Validate the incoming request
    if (!clientId || !number || !message) {
        return res.status(400).json({ message: 'clientId, number, and message are required.' });
    }

    // 2. Find the active client instance
    const client = activeClients[clientId];
    if (!client) {
        return res.status(404).json({ message: 'Client session not found. Please ensure the device is connected.' });
    }

    try {
        // 3. Call the function to send the message
        await sendTestMessage(client, number, message);
        res.status(200).json({ message: 'Test message sent successfully!' });
    } catch (error) {
        // 4. Handle any errors from the sendTestMessage function
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;