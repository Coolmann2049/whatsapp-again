const axios = require('axios'); // Make sure to import axios
const { Client, LocalAuth } = require('whatsapp-web.js');
const { processCampaign } = require('../controllers'); // Import the campaign processor
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const activeClients = {};

async function restoreAllSessions() {
    console.log('Attempting to restore sessions on startup...');
    try {
        console.log(process.env.VPS_KEY);
        // The request is now a POST to send the auth key in the body
        const response = await axios.post(`${process.env.MAIN_BACKEND_URL}/api/webhook/get-all-clients`, {
            // The auth key is sent in the request body
            auth: process.env.VPS_KEY 
        });

        const clientIdsToRestore = response.data;
        
        if (clientIdsToRestore && clientIdsToRestore.length > 0) {
            console.log(`Found ${clientIdsToRestore.length} clients to restore. Initializing now...`);
            // Loop through the list and initialize each client
            for (const clientId of clientIdsToRestore) {
                initializeClient(clientId);
            }
        } else {
            console.log('No active clients found to restore.');
        }

    } catch (error) {
        // Axios provides more detailed error messages, which is helpful for debugging
        const errorMessage = error.response ? `Status ${error.response.status}: ${error.response.data}` : error.message;
        console.error('FATAL: Could not restore sessions on startup.', errorMessage);
    }
}


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

    client.on('message', async (message) => {
        try {
            // Ignore messages from groups or status updates, only process direct chats.
            if (message.from.endsWith('@g.us') || message.from.endsWith('@broadcast')) {
                return;
            }

            // 1. Gather the necessary context
            const contactNumber = message.from.replace('@c.us', ''); // Get the plain phone number
            const messageBody = message.body;

            console.log(`[${clientId}] Received message from ${contactNumber}. Forwarding to Main Backend.`);

            // 2. Send the data to the master webhook on the Main Backend
            await axios.post(`${process.env.MAIN_BACKEND_URL}/api/webhooks/process-incoming-message`, {
                clientId: clientId,
                contactNumber: contactNumber,
                messageBody: messageBody,
                auth: process.env.VPS_KEY // Your secret key for authentication
            });

        } catch (error) {
            // Log any errors that occur while trying to send the webhook
            const errorMessage = error.response ? `Status ${error.response.status}` : error.message;
            console.error(`[${clientId}] Failed to forward message from ${contactNumber} to Main Backend. Error: ${errorMessage}`);
        }
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


async function resumeRunningCampaigns() {
    console.log('Checking for running campaigns to resume...');
    try {
        console.log(process.env.VPS_KEY);
        const response = await axios.get(`${process.env.MAIN_BACKEND_URL}/api/webhook/running-campaigns`, {
            auth : process.env.VPS_KEY 
        });

        const campaignsToResume = response.data;
        
        if (campaignsToResume && campaignsToResume.length > 0) {
            console.log(`Found ${campaignsToResume.length} campaigns to resume.`);

            for (const campaign of campaignsToResume) {
                if (!campaign.user || !campaign.user.email) {
                    console.error(`Cannot resume campaign ID ${campaign.id}: Missing user email.`);
                    continue; // Skip to the next campaign
                }

                // Reconstruct the clientId using the data from the Main Backend
                const clientId = `${campaign.userId}_${campaign.user.email}_${campaign.deviceId}`;
                
                console.log(`Resuming campaign ID: ${campaign.id} for client: ${clientId}`);
                // Kick off the processing loop for this campaign in the background
                processCampaign(campaign.id, clientId);
            }
        } else {
            console.log('No running campaigns to resume.');
        }

    } catch (error) {
        const errorMessage = error.response ? `Status ${error.response.status}: ${error.response.data}` : error.message;
        console.error('Could not resume running campaigns:', errorMessage);
    }
}


module.exports = {
    restoreAllSessions,
    initializeClient,
    sendTestMessage,
    resumeRunningCampaigns,
    activeClients
}
