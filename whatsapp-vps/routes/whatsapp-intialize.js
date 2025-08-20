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

// POST: Get contacts from a specific WhatsApp group
router.post('/get-group-contacts', async (req, res) => {
    try {
        const { clientId, groupId } = req.body;
        
        if (!clientId || !groupId) {
            return res.status(400).json({ error: 'clientId and groupId are required' });
        }

        const client = activeClients[clientId];
        if (!client) {
            return res.status(404).json({ error: 'Client not found or not connected' });
        }

        // Get the specific chat/group
        const chat = await client.getChatById(groupId);
        if (!chat || !chat.isGroup) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Get group participants
        const participants = chat.participants || [];
        const contacts = [];

        for (const participant of participants) {
            try {
                // Get contact info for each participant
                const contact = await client.getContactById(participant.id._serialized);
                
                // Extract phone number (remove @c.us suffix)
                const phoneNumber = participant.id.user;
                
                contacts.push({
                    phone: phoneNumber,
                    name: contact.name || contact.pushname || '',
                    pushname: contact.pushname || '',
                    isMe: participant.id._serialized === client.info.wid._serialized
                });
            } catch (contactError) {
                console.error(`Error getting contact info for ${participant.id._serialized}:`, contactError);
                // Still add the contact with minimal info
                contacts.push({
                    phone: participant.id.user,
                    name: '',
                    pushname: '',
                    isMe: participant.id._serialized === client.info.wid._serialized
                });
            }
        }

        // Filter out the user's own contact
        const filteredContacts = contacts.filter(contact => !contact.isMe);

        res.json({
            success: true,
            groupName: chat.name,
            groupId: groupId,
            contacts: filteredContacts,
            totalContacts: filteredContacts.length
        });

    } catch (error) {
        console.error('Error fetching group contacts:', error);
        res.status(500).json({ error: 'Failed to fetch group contacts' });
    }
});

module.exports = router;