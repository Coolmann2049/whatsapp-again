// On your Worker VPS
const express = require('express');
const router = express.Router();
const axios = require('axios'); // To send webhooks to the Main Backend
const { initializeClient, sendTestMessage, activeClients, processCampaign, intentionalLogouts  } = require('../controllers/initialize');
const fs = require('fs').promises;
const path = require('path');


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

    if (!client) {
        return res.status(404).send(JSON.stringify({
            message: 'Client not found or already disconnected.'
        }));

    }

    if (client) {
        try {
            console.log(`[${clientId}] Intentional removal requested. Logging out and cleaning up...`);
            
            // --- THE FIX: SET THE FLAG ---
            // Tell the system this logout is on purpose.
            intentionalLogouts.add(clientId);
            
            // Step 1: Gracefully log out from WhatsApp's servers. This will trigger the 'disconnected' event.
            await client.logout();
            
            // Step 2: Manually delete the session folder.
            const sessionPath = path.join('.wwebjs_auth', `session-${clientId}`);
            await fs.rm(sessionPath, { recursive: true, force: true });
            console.log(`[${clientId}] Successfully deleted session folder.`);

            res.status(200).send('Device removed and session data cleared successfully.');

        } catch (error) {
            console.error(`[${clientId}] Error during manual removal:`, error);
            // Clean up the flag on error
            intentionalLogouts.delete(clientId);

            res.status(500).send('Failed to fully remove device.');
        }
    } 
});

router.post('/send-message', async (req, res) => {
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

router.post('/process-campaign', (req, res) => {
    try {
        // 1. Get the data from the request body
        const { campaignId, clientId, auth } = req.body;

        // 2. Authenticate the request from the Main Backend
        if (auth !== process.env.VPS_KEY) {
            return res.status(401).send('Unauthorized');
        }

        // 3. Validate the required data
        if (!campaignId || !clientId) {
            return res.status(400).send('campaignId and clientId are required.');
        }

        // 4. Start the background job.
        // We do not await this, so the try...catch here will only catch
        // synchronous errors if the processCampaign function itself fails to start.
        processCampaign(campaignId, clientId);

        // 5. Immediately send a success response to the Main Backend
        res.status(200).json({ message: 'Campaign processing has been successfully initiated.' });

    } catch (error) {
        // 6. Catch any synchronous errors that occurred
        console.error('CRITICAL ERROR: Failed to initiate campaign process.', error);
        res.status(500).json({ error: 'Failed to start campaign on the worker.' });
    }
});
// POST: Get all WhatsApp groups for a client
router.post('/get-groups', async (req, res) => {
    try {
        const { clientId } = req.body;
        
        if (!clientId) {
            return res.status(400).json({ error: 'clientId is required' });
        }

        const client = activeClients[clientId];
        if (!client) {
            return res.status(404).json({ error: 'Client not found or not connected' });
        }

        // Get all chats and filter for groups
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);

        const groupsData = groups.map(group => ({
            id: group.id._serialized,
            name: group.name,
            participantCount: group.participants ? group.participants.length : 0,
            description: group.description || ''
        }));

        res.json({
            success: true,
            groups: groupsData,
            totalGroups: groupsData.length
        });

    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: 'Failed to fetch WhatsApp groups' });
    }
});

// Get contacts from specific WhatsApp groups
router.post('/get-group-contacts', async (req, res) => {
    try {
        const { clientId, groups, userId } = req.body;

        if (!clientId || !groups || !Array.isArray(groups) || !userId) {
            return res.status(400).json({ message: 'clientId, groupIds array, and userId are required' });
        }

        const client = activeClients[clientId];
        if (!client) {
            return res.status(404).json({ message: 'Client not found' });
        }

        // Count total participants across all groups for immediate response
        let totalParticipants = 0;
        for (const groupId of groups) {
            try {
                const chat = await client.getChatById(groupId);
                if (chat.isGroup) {
                    totalParticipants += chat.participants.length;
                }
            } catch (error) {
                console.error(`Error counting participants in group ${groupId}:`, error);
            }
        }

        // Send immediate response
        res.status(200).json({ 
            message: `Found ${totalParticipants} contacts across ${groups.length} groups. Fetching and processing contact details...`,
            totalContacts: totalParticipants
        });

        // Process contacts asynchronously
        processGroupContactsAsync(clientId, groups, userId);

    } catch (error) {
        console.error('Error fetching group contacts:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Async function to process contacts and send to webhook
async function processGroupContactsAsync(clientId, groupIds, userId) {
    try {
        const client = activeClients[clientId];
        if (!client) {
            console.error('Client not found during async processing');
            return;
        }

        const allContacts = [];
        
        for (const groupId of groupIds) {
            try {
                const chat = await client.getChatById(groupId);
                if (chat.isGroup) {
                    const participants = chat.participants;
                    
                    for (const participant of participants) {
                        try {
                            const contact = await client.getContactById(participant.id._serialized);
                            allContacts.push({
                                name: contact.name || contact.pushname || participant.id.user,
                                phone: participant.id.user,
                                groupName: chat.name,
                                groupId: groupId
                            });
                        } catch (contactError) {
                            console.error(`Error fetching contact ${participant.id.user}:`, contactError);
                            // Add contact with minimal info if detailed fetch fails
                            allContacts.push({
                                name: participant.id.user,
                                phone: participant.id.user,
                                groupName: chat.name,
                                groupId: groupId
                            });
                        }
                    }
                }
            } catch (error) {
                console.error(`Error fetching contacts from group ${groupId}:`, error);
            }
        }

        // Send results to webhook endpoint
        const webhookUrl = `${process.env.MAIN_BACKEND_URL}/api/webhooks/group-contacts-processed`;
        const webhookData = {
            userId: userId,
            contacts: allContacts,
            groupIds: groupIds,
            auth: process.env.VPS_KEY
        };

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(webhookData)
            });

            if (!response.ok) {
                console.error('Failed to send webhook notification:', response.statusText);
            } else {
                console.log(`Successfully processed ${allContacts.length} contacts and sent to webhook`);
            }
        } catch (webhookError) {
            console.error('Error sending webhook notification:', webhookError);
        }

    } catch (error) {
        console.error('Error in async contact processing:', error);
    }
}

module.exports = router;