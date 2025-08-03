// In your worker's controller file (e.g., controllers/campaignController.js)

const axios = require('axios');
const { activeClients } = require('./initialize'); // Assuming activeClients is exported

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
            const response = await axios.get(`${process.env.MAIN_BACKEND_URL}/api/webhook/next-contact/${campaignId}`, {
                auth: process.env.VPS_KEY 
            });

            const nextTask = response.data;

            // 2. Check if the campaign is finished
            if (!nextTask) {
                console.log(`[${clientId}] Campaign ${campaignId} completed. Exiting loop.`);
                break; // Exit the while loop
            }

            const { campaignContactId, contact, templateContent } = nextTask;

            // 3. Prepare and send the message
            let messageContent = templateContent
                .replace(/{{name}}/g, contact.name || '')
                .replace(/{{company}}/g, contact.company || '');
            
            const chatId = `${contact.phone}@c.us`;
            await client.sendMessage(chatId, messageContent);

            // 4. Update the status to 'sent'
            await axios.post(`${process.env.MAIN_BACKEND_URL}/api/webhook/update-status`, {
                campaignContactId,
                status: 'sent',
                auth: process.env.VPS_KEY
            });
            console.log(`[${clientId}] Successfully sent message to ${contact.phone} for campaign ${campaignId}.`);

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

module.exports = { processCampaign };