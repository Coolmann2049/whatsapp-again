const axios = require('axios'); // Make sure to import axios
const { Client, LocalAuth } = require('whatsapp-web.js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const activeClients = {};

const MAIN_BACKEND_URL = process.env.MAIN_BACKEND_URL;
async function restoreAllSessions() {
    console.log('Attempting to restore sessions on startup...');
    try {
        console.log(process.env.VPS_KEY);
        // The request is now a POST to send the auth key in the body
        const response = await fetch(`${process.env.MAIN_BACKEND_URL}/api/webhook/get-all-clients`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                auth: process.env.VPS_KEY 
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Status ${response.status}: ${errorText}`);
        }

        const clientIdsToRestore = await response.json();
        
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
        console.error('FATAL: Could not restore sessions on startup.', error.message);
    }
}

function initializeClient(clientId) {
    // This Promise wrapper makes the function "thenable" and provides resolve/reject
    return new Promise((resolve, reject) => {
        try {
            console.log(`Initializing client for: ${clientId}`);

            const client = new Client({
                authStrategy: new LocalAuth({ clientId: clientId }),
                puppeteer: {
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                }
            });

            let clientInfo = {}; // To safely store client info on 'ready'

            const initTimeout = setTimeout(() => {
                console.error(`[${clientId}] Initialization timed out after 90 seconds.`);
                client.destroy(); 
                reject(new Error(`Initialization timed out for ${clientId}`));
            }, 90000);

            // --- Event Listeners ---

            client.on('qr', (qr) => {
                console.log(`[${clientId}] QR Code received. Sending to Main Backend.`);
                axios.post(`${MAIN_BACKEND_URL}/api/webhook/whatsapp-qr-update`, { clientId, qrCode: qr, auth: process.env.VPS_KEY });
            });

            client.on('ready', () => {
                console.log(`[${clientId}] Client is ready!`);
                clearTimeout(initTimeout); 

                // Safely store client info now that it's available
                clientInfo = {
                    name: client.info.pushname,
                    phone: client.info.wid.user
                };
                
                console.log(clientInfo.name, clientInfo.phone);
                axios.post(`${MAIN_BACKEND_URL}/api/webhook/whatsapp-status-update`, { 
                    clientId, 
                    status: 'connected',
                    userName: clientInfo.name,
                    userPhone: clientInfo.phone,
                    auth: process.env.VPS_KEY
                });
                resolve(); // Signal that the promise succeeded
            });

            client.on('disconnected', (reason) => {
                console.log(`[${clientId}] Client was logged out. Reason:`, reason);
                // Use the safely stored clientInfo instead of relying on the disconnected client object
                axios.post(`${MAIN_BACKEND_URL}/api/webhook/whatsapp-status-update`, { 
                    clientId, 
                    status: 'disconnected',
                    userName: clientInfo.name, // Use last known name
                    userPhone: clientInfo.phone, // Use last known phone
                    auth: process.env.VPS_KEY
                });
                delete activeClients[clientId];
            });

            client.on('message', async (message) => {
                let contactNumber;
                try {
                    if (message.from.endsWith('@g.us') || message.from.endsWith('@broadcast')) return;
                    
                    contactNumber = message.from.replace('@c.us', '');
                    const messageBody = message.body;

                    console.log(`[${clientId}] Received message from ${contactNumber}. Forwarding to Main Backend.`);
                    
                    await axios.post(`${process.env.MAIN_BACKEND_URL}/api/webhook/process-incoming-message`, {
                        clientId: clientId,
                        contactNumber: contactNumber,
                        messageBody: messageBody,
                        auth: process.env.VPS_KEY
                    });
                } catch (error) {
                    const errorMessage = error.response ? `Status ${error.response.status}` : error.message;
                    console.error(`[${clientId}] Failed to forward message from ${contactNumber || 'unknown'}. Error: ${errorMessage}`);
                }   
            });

            // Start the initialization process, ensuring any errors are caught
            client.initialize().catch(err => {
                clearTimeout(initTimeout);
                reject(err); // Reject the promise if initialization fails
            });

            activeClients[clientId] = client;

        } catch (error) {
            // This will catch any synchronous errors during setup
            console.error(`[${clientId}] A critical error occurred during client setup:`, error);
            reject(error);
        }
    });
}

async function sendTestMessage(client, number, message) {
    try {
        // Format the number to the correct WhatsApp ID format
        const chatId = `${number}@c.us`;
        
        // Send the message
        const sentMessage = await client.sendMessage(chatId, message);
        console.log(`[${client.info.wid}] Successfully sent test message to ${number}`);
        console.log(sentMessage);
        // Return the confirmation from the library
        return sentMessage;
    } catch (error) {
        console.error(`[${client.info.wid}] Failed to send message to ${number}:`, error);
        // Throw the error so the endpoint can catch it and send a 500 response
        throw new Error('Failed to send message. The number might be invalid or not on WhatsApp.');
    }
}


async function resumeRunningCampaigns() {
    console.log('Checking for running campaigns to resume...');
    try {
        console.log(process.env.VPS_KEY);
        const response = await fetch(`${process.env.MAIN_BACKEND_URL}/api/webhook/running-campaigns`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                auth: process.env.VPS_KEY
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Status ${response.status}: ${errorText}`);
        }

        const campaignsToResume = await response.json();
        
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
        console.error('Could not resume running campaigns:', error.message);
    }
}

// Helper function for delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * The main background job for processing a campaign.
 * @param {number} campaignId - The ID of the campaign to process.
 * @param {string} clientId - The ID of the WhatsApp client to use.
 */

async function processCampaign(campaignId, clientId) {
    console.log(`[${clientId}] Starting processing for campaign ID: ${campaignId}`);
    const client = activeClients[clientId];

    if (!client) {
        console.error(`[${clientId}] CRITICAL: Client not found. Aborting campaign ${campaignId}.`);
        // You might want a webhook here to notify the Main Backend of this failure
        return;
    }

    while (true) {
        try {
            // 1. Get the next contact from the Main Backend
            const url = `${process.env.MAIN_BACKEND_URL}/api/webhook/next-contact/${campaignId}?auth=${process.env.VPS_KEY}`;
            const response = await axios.get(url);


            const nextTask = response.data;
            console.log(nextTask);
            // 2. Check if the campaign is finished
            if (!nextTask) {
                console.log(`[${clientId}] Campaign ${campaignId} completed. Exiting loop.`);
                break; // Exit the while loop
            }

            const { campaignContactId, contact, templateContent, phone } = nextTask;


            // 3. Prepare and send the message
            let messageContent = templateContent
                .replace(/{{name}}/g, contact.name || '')
                .replace(/{{company}}/g, contact.company || '');
            
            const chatId = `${phone}@c.us`;
            await client.sendMessage(chatId, messageContent);

            // 4. Update the status to 'sent'
            await axios.post(`${process.env.MAIN_BACKEND_URL}/api/webhook/update-status`, {
                campaignContactId,
                status: 'sent',
                auth: process.env.VPS_KEY
            });
            console.log(`[${clientId}] Successfully sent message to ${phone} for campaign ${campaignId}.`);

        } catch (error) {
            console.error(`[${clientId}] Error during campaign ${campaignId} loop:`, error.message);
            // You would also update the status to 'failed' here
            // This part needs the campaignContactId, which we might not have if the first API call failed.
            // For now, we just log the error and continue.
        } finally {
            // 5. Wait for a random delay to avoid bans
            const delay = Math.floor(Math.random() * (40000 - 30000 + 1)) + 30000; // 30-40 seconds
            console.log(`[${clientId}] Waiting for ${delay / 1000} seconds...`);
            await sleep(delay);
        }
    }
}


module.exports = {
    restoreAllSessions,
    initializeClient,
    sendTestMessage,
    resumeRunningCampaigns,
    processCampaign,
    activeClients
}
