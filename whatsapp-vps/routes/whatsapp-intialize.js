// On your Worker VPS
const express = require('express');
const router = express.Router();
const axios = require('axios'); // To send webhooks to the Main Backend
const { initializeClient, sendTestMessage, activeClients, processCampaign } = require('../controllers/initialize');

const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const MAIN_BACKEND_URL = process.env.MAIN_BACKEND_URL;

/**
 * Creates and initializes a new whatsapp-web.js client instance.
 * @param {string} clientId - A unique identifier for the client (e.g., their username or user ID).
 */


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
        console.log(error);
        // 4. Handle any errors from the sendTestMessage function
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;