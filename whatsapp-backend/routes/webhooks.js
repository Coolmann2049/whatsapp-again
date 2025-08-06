const express = require('express');
const router = express.Router();
const { UserID, AiConfiguration,DialogFlows, Campaign, MessageTemplate, CampaignContacts, Contact, ChatMessage } = require('../models');
const { generateAiResponse } = require('./services/aiServices');
const dotenv = require('dotenv');

// Load environment variablFVes
dotenv.config();

// Webhook route
router.post('/whatsapp-qr-update', async (req, res) => {
    const { clientId, qrCode, auth } = req.body;

    if (auth != process.env.VPS_KEY) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {

        const userId = clientId.split('_')[0];
        const email = clientId.split('_')[1];
        const count = clientId.split('_')[2];

        // Find the user by clientId
        const user = await UserID.findOne({ where: { userId } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const io = req.io;                    // Access the io instance

        //Send to the correct room
        io.to(email).emit('qr-code-update', { qrCode: qrCode });

        // Update the database that there be a new instance
        res.status(200).json({ message: 'QR code updated successfully' });
    } catch (error) {
        console.error('Error updating QR code:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/whatsapp-status-update', async (req, res) => {
    const { clientId, status, userName, userPhone, auth } = req.body;

    if (auth != process.env.VPS_KEY) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const userId = clientId.split('_')[0];
        const email = clientId.split('_')[1];
        const count = clientId.split('_')[2];

        // Find the user by clientId
        const user = await UserID.findOne({ where: { userId } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (status === 'connected') {

            user.count++;
            
            const deviceData = {
                clientId,
                id: count,
                name: userName,
                status,
                phone: userPhone
            };
            let devices = JSON.parse(user.devices_data);
            devices.push(deviceData);
            user.devices_data = JSON.stringify(devices);

            console.log(devices);

            await user.save();

        } else if (status === 'disconnected') {

            console.log(user.count);

            user.count--;

            console.log(user.count);
            const deviceData = {
                clientId,
                id: count,
                name: userName,
                status,
                phone: userPhone
            };
            let devices = JSON.parse(user.devices_data);
            devices = devices.filter(device => device.id !== deviceData.id);
            user.devices_data = JSON.stringify(devices);

            await user.save();
        }

        const io = req.io;                    // Access the io instance

        io.to(email).emit('device-update', { 
            id: count,
            status,
            name: userName,
            phone: userPhone
        });
        console.log ('yay');
        res.status(200).json({ message: 'Status updated successfully' });


    } catch (error) {
        console.error('Error updating QR code:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
})

// In your webhooksRouter.js



router.post('/get-all-clients',  async (req, res) => {
    try {
        console.log('Worker is requesting list of clients to restore...');

        const auth = req.body.auth;
        if (auth != process.env.VPS_KEY) {
            console.log(auth);
            return res.status(401).json({ message: 'Unauthorized' });
        }
        
        // 1. Fetch all users from the database
        const users = await UserID.findAll({
            attributes: ['devices_data'] // We only need the devices_data column
        });

        const allClientIds = [];

        // 2. Loop through each user
        for (const user of users) {
            // Safely parse the devices_data JSON string
            if (user.devices_data) {
                try {
                    const devices = JSON.parse(user.devices_data);
                    // 3. Loop through the devices for that user
                    for (const device of devices) {
                        // 4. Add the clientId to our master list
                        if (device.clientId) {
                            allClientIds.push(device.clientId);
                        }
                    }
                } catch (parseError) {
                    console.error('Failed to parse devices_data for a user:', parseError);
                }
            }
        }

        console.log(`Found ${allClientIds.length} total clients to restore.`);
        // 5. Respond with the flat array of clientIds
        res.json(allClientIds);

    } catch (error) {
        console.error('Error fetching client list for worker:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// GET: Worker VPS uses this to get the next contact to message
router.post('/next-contact/:campaignId', async (req, res) => {
    try {

        const auth = req.body.auth;
        if (auth != process.env.VPS_KEY) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { campaignId } = req.params;

        // Find the campaign and its template
        const campaign = await Campaign.findByPk(campaignId, {
            include: [{ model: MessageTemplate, as: 'template' }]
        });
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found.' });
        }

        // Find the next pending contact for this campaign
        const campaignContact = await CampaignContacts.findOne({
            where: { campaign_id: campaignId, status: 'pending' },
            include: [{ model: Contact }], // Include the contact details
            order: [['id', 'ASC']]
        });

        if (!campaignContact) {
            // No more pending contacts
            await campaign.update({ status: 'Completed' });
            return res.json(null); // Signal to the worker that the campaign is done
        }

        // Send back all necessary data for the worker
        res.json({
            campaignContactId: campaignContact.id,
            contact: campaignContact.Contact,
            templateContent: campaign.template.content
        });
    } catch (error) {
        console.error('Error fetching next contact for worker:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST: Worker VPS uses this to update a contact's status after sending
router.post('/worker/update-status', async (req, res) => {
    try {
        const { campaignContactId, status , auth} = req.body; // status will be 'sent' or 'failed'
        
        if (auth != process.env.VPS_KEY) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        await CampaignContacts.update(
            { status: status, sent_at: new Date() },
            { where: { id: campaignContactId } }
        );

        res.sendStatus(200);
    } catch (error) {
        console.error('Error updating contact status from worker:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/running-campaigns', async (req, res) => {
    try {

        const auth = req.body.auth;
        if (auth != process.env.VPS_KEY) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        console.log('Worker is requesting list of running campaigns to resume...');
        
        // Find all campaigns with status 'Running'
        const runningCampaigns = await Campaign.findAll({
            where: { status: 'Running' },
            // We must include the UserID model to get the user's email
            // This assumes you have set up the association between Campaign and UserID
            include: [{
                model: UserID,
                as: 'user', // Make sure you have an alias set up in your association
                attributes: ['email'] // We only need the email to reconstruct the clientId
            }]
        });

        console.log(`Found ${runningCampaigns.length} campaigns to resume.`);
        res.json(runningCampaigns);

    } catch (error) {
        console.error('Error fetching running campaigns for worker:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// In routes/webhooks.js on your MAIN BACKEND

/**
 * This is the master webhook for processing all incoming messages from the worker.
 * It decides whether to attribute a reply to a campaign, use the AI, or use the keyword bot.
 */
router.post('/process-incoming-message', async (req, res) => {
    const { clientId, contactNumber, messageBody, auth} = req.body;
    
    if (auth != process.env.VPS_KEY) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    // Immediately send a 200 OK to the worker so it doesn't have to wait.
    res.sendStatus(200);

    try {
        // --- Step 1: Identify the User and Contact ---
        const userId = clientId.split('_')[0];
        const deviceId = clientId.split('_')[2];
        
        const [user, contact] = await Promise.all([
            UserID.findByPk(userId),
            Contact.findOne({ where: { phone: contactNumber, userId: userId } })
        ]);

        if (!user || !contact) {
            console.log(`Ignoring message from ${contactNumber}: User or contact not found in our system.`);
            return;
        }

        // --- Step 2: Log the Incoming Message ---
        await ChatMessage.create({
            userId,
            contact_id: contact.id,
            sender: 'user',
            message_content: messageBody
        });

        // --- Step 3: Check for an Active Campaign Reply ---
        const campaignContact = await CampaignContacts.findOne({
            where: { contact_id: contact.id, status: 'sent' },
            include: [{ model: Campaign, where: { deviceId: deviceId, status: 'Running' } }],
            order: [['sent_at', 'DESC']]
        });

        if (campaignContact) {
            await campaignContact.update({ status: 'replied', replied_at: new Date() });
            console.log(`Attributed reply from ${contactNumber} to campaign ID ${campaignContact.campaign_id}`);
        }

        // --- Step 4: Decide on the Reply Strategy (AI vs. Keyword vs. Off) ---
        
        // NEW: Check if auto-replies are turned off completely.
        if (user.reply_mode === 'off') {
            console.log(`Auto-reply is turned off for user ${userId}. No reply will be sent.`);
            return; // Stop processing
        }

        let botReply = null;

        if (user.reply_mode === 'ai') {
            const aiConfig = await AiConfiguration.findByPk(userId);
            const chatHistory = []; // We would fetch this in a real scenario
            botReply = await generateAiResponse(aiConfig, chatHistory, messageBody);
        } else if (user.reply_mode === 'keyword') {
            // Keyword Bot Logic
            const dialogFlows = await DialogFlows.findAll({ where: { userId } });
            for (const flow of dialogFlows) {
                if (messageBody.toLowerCase().includes(flow.trigger_message.toLowerCase())) {
                    botReply = flow.response_message;
                    break;
                }
            }
        }

        // --- Step 5: Send the Reply (if one was determined) ---
        if (botReply) {
            await ChatMessage.create({
                userId,
                contact_id: contact.id,
                sender: 'bot',
                message_content: botReply
            });

            await fetch(`${process.env.VPS_URL}/api/send-message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-vps-auth-key': process.env.VPS_KEY
                },
                body: JSON.stringify({ clientId, number: contactNumber, message: botReply })
            });
        } else {
            console.log(`No reply action found for message from ${contactNumber}.`);
        }

    } catch (error) {
        console.error('Error processing incoming message webhook:', error);
    }
});




module.exports = router;
