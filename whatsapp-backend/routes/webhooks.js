const express = require('express');
const router = express.Router();
const { UserID, AiConfiguration, DialogFlows, UserUsage, Campaign, MessageTemplate, CampaignContacts, Contact, ChatMessage, Conversation } = require('../models');
const { generateAiResponse, sendEmail } = require('./services/aiServices');
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
        const deviceId = clientId.split('_')[1];

        // Find the user by clientId
        const user = await UserID.findByPk(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const io = req.io;                    // Access the io instance

        //Send to the correct room
        io.to(userId).emit('qr-code-update', { qrCode: qrCode });

        // Update the database that there be a new instance
        res.status(200).json({ message: 'QR code updated successfully' });
    } catch (error) {
        console.error('Error updating QR code:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/whatsapp-status-update', async (req, res) => {
    const { clientId, status, userName, userPhone, auth } = req.body;

    if (auth !== process.env.VPS_KEY) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const userId = clientId.split('_')[0];
        const deviceId = clientId.split('_')[1];

        const user = await UserID.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const email = user.email;

        let devices = user.devices_data ? JSON.parse(user.devices_data) : [];
        const existingDeviceIndex = devices.findIndex(d => d.id === deviceId);
        let deviceName = userName; 

        if (status === 'connected') {
            const deviceData = {
                id: deviceId,
                clientId,
                name: userName,
                status: 'connected',
                phone: userPhone,
                lastActive: new Date().toISOString()
            };

            if (existingDeviceIndex > -1) {
                // --- UPDATE THE EXISTING DEVICE ---
                console.log(`Device ${deviceId} reconnected. Updating its status.`);
                devices[existingDeviceIndex] = deviceData;
            } else {
                // --- ADD A NEW DEVICE ---
                console.log(`New device ${deviceId} connected. Adding to the list.`);
                devices.push(deviceData);
                // Only increment the user's total device count when a new one is added
                user.count++; 
            }
        } else if (status === 'disconnected') {
            // --- MARK THE DEVICE AS DISCONNECTED ---
            if (existingDeviceIndex > -1) {
                console.log(`Device ${deviceId} disconnected. Updating status.`);
                devices[existingDeviceIndex].status = 'disconnected';
                deviceName = devices[existingDeviceIndex].name; 
            }

            // 1. Pause all active campaigns for this device
            console.log(`Pausing all running campaigns for device ID: ${deviceId}`);
            const [updatedCampaignsCount] = await Campaign.update(
                { status: 'Paused' },
                {
                    where: {
                        userId: userId,
                        client_id: clientId,
                        status: 'Running'
                    }
                }
            );
            console.log(`${updatedCampaignsCount} campaigns were paused.`);
            
            if (req.body.userLogout) {
                const updatedDevices = devices.filter(device => device.clientId !== clientId);
                user.count = updatedDevices.length;
                return;
            }
            // 2. Send an email notification to the user
            const subject = 'Alert: Your WhatsApp Device Has Disconnected';
            const htmlBody = `
                <p>Hello ${user.name},</p>
                <p>This is an automated alert to inform you that your WhatsApp device named "<b>${deviceName}</b>" has been disconnected from our platform.</p>
                <p>All active campaigns running on this device have been automatically paused to prevent any issues.</p>
                <p>Please log in to your dashboard to reconnect the device and resume your campaigns.</p>
                <p>Thank you,<br>The Blulink Team</p>
            `;
            // We call sendEmail but don't wait for it to finish, to keep the response fast
            sendEmail(email, subject, htmlBody);

            // --- NEW LOGIC ENDS HERE ---
        }

        // Save the updated devices array
        user.devices_data = JSON.stringify(devices);
        await user.save();
        
        // Notify the frontend via Socket.IO
        const io = req.io;
        io.to(userId).emit('device-update', { devices });
        
        res.status(200).json({ message: 'Status updated successfully' });

    } catch (error) {
        console.error('Error updating device status:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// In your webhooksRouter.js



router.post('/get-all-clients', async (req, res) => {
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
                        // 4. Add the clientId to our master list ONLY IF it's connected
                        if (device.clientId && device.status === 'connected') { // <-- THIS IS THE FIX
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
router.get('/next-contact/:campaignId', async (req, res) => {
    try {

        const auth = req.query.auth;
        if (auth != process.env.VPS_KEY) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        console.log('reached here');
        const { campaignId } = req.params;

        // Find the campaign and its template
        const campaign = await Campaign.findByPk(campaignId, {
            include: [{ model: MessageTemplate, as: 'template' }]
        });
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found.' });
        }

        const userId = campaign.userId;

        const user = await UserID.findByPk(userId);

        // --- NEW RATE LIMITING LOGIC ---
        const usage = await UserUsage.findByPk(userId);
        
        if (usage && usage.campaign_messages_sent >= user.daily_campaign_limit) {
            console.log(`User ${userId} has reached their daily campaign limit of ${campaign.user.daily_campaign_limit}. Pausing campaign ${campaignId}.`);
            await campaign.update({ status: 'Paused_Limit' });
            return res.json(null); // Signal to the worker to stop
        }

        // Find the next pending contact for this campaign
        const campaignContact = await CampaignContacts.findOne({
            where: { campaign_id: campaignId, status: 'pending' },
            include: [{ model: Contact }], // Include the contact details
            order: [['id', 'ASC']]
        });

        if (!campaignContact) {
            console.log('Didnt find next contact');

            // No more pending contacts
            await campaign.update({ status: 'Completed' });
            
            // Send email notification to user about campaign completion
            const subject = `Campaign "${campaign.name}" Completed Successfully`;
            const htmlBody = `
                <p>Hello ${user.name},</p>
                <p>Great news! Your campaign "<b>${campaign.name}</b>" has been completed successfully.</p>
                <p>All contacts in this campaign have been processed. You can now start a new campaign from your dashboard.</p>
                <p>Thank you for using our platform!</p>
                <p>Best regards,<br>The Blulink Team</p>
            `;
            // Send email notification (non-blocking)
            sendEmail(user.email, subject, htmlBody);
            
            return res.json(null); // Signal to the worker that the campaign is done
        }
        if (campaign.status !== 'Running') {
            console.log(`Campaign ${campaignId} is not in 'Running' state. Current status: ${campaign.status}. Stopping worker.`);
            // Signal to the worker that the job is done for now.
            return res.json(null);
        }
        
        const sanitizedPhone = sanitizePhoneNumber(campaignContact.Contact.phone);

        await UserUsage.increment('campaign_messages_sent', { where: { userId } });

        // Send back all necessary data for the worker
        res.json({
            campaignContactId: campaignContact.id,
            contact: campaignContact.Contact,
            phone: sanitizedPhone,
            templateContent: campaign.template.content
        });
    } catch (error) {
        console.error('Error fetching next contact for worker:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



function sanitizePhoneNumber(rawPhoneNumber) {
    if (!rawPhoneNumber || typeof rawPhoneNumber !== 'string') {
        return null;
    }

    // 1. Remove all non-digit characters (+, spaces, dashes, etc.)
    const digitsOnly = rawPhoneNumber.replace(/\D/g, '');

    // 2. Handle the different formats for Indian numbers
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
        // Already in the correct format (e.g., 919876543210)
        return digitsOnly;
    } else if (digitsOnly.length === 10) {
        // Standard 10-digit mobile number, prepend the country code
        return '91' + digitsOnly;
    }

    // If it doesn't match a known valid length, it's an invalid number
    return null;
}

// POST: Worker VPS uses this to update a contact's status after sending
router.post('/update-status', async (req, res) => {
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

router.post('/running-campaigns', async (req, res) => {
    try {

        const auth = req.body.auth;
        if (auth != process.env.VPS_KEY) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        console.log('Worker is requesting list of running campaigns to resume...');
        
        // Find all campaigns with status 'Running'
        const runningCampaigns = await Campaign.findAll({
            where: { status: 'Running' }
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
// In your webhooksRouter.js on the MAIN BACKEND

router.post('/process-incoming-message', async (req, res) => {
    const { clientId, contactNumber, messageBody } = req.body;
    
    // Immediately acknowledge the request so the worker can move on.
    res.sendStatus(200);

    try {
        const userId = clientId.split('_')[0];
        const deviceId = clientId.split('_')[1];
        
        // --- Step 1: The Safety Net ---
        // Check if this contact exists in the user's database at all. If not, ignore.
        const contactRecord = await Contact.findOne({ 
            where: { phone: contactNumber, userId: userId },
            order: [['created_at', 'DESC']] // Get the most recent record if duplicates exist
        });

        if (!contactRecord) {
            console.log(`Ignoring message from ${contactNumber}: Not a known business contact.`);
            return;
        }

        // --- Step 2: Get the Authoritative Conversation Thread ---
        // Find or create the single conversation record for this person.
        const [conversation] = await Conversation.findOrCreate({
            where: { 
                userId, 
                contact_phone: contactNumber 
            },
            // The 'defaults' object provides the values to use ONLY if a new record is being created.
            // If an existing conversation is found, this object is ignored.
            defaults: {
                userId,
                contact_phone: contactNumber,
                name: contactRecord.name || '',
                company: contactRecord.company || '',
                is_manual_mode: false
            }
        });

        // --- Step 3: The Manual Mode Check ---
        // Check the flag on the conversation record. If active, stop immediately.
        if (conversation.is_manual_mode) {
            console.log(`Conversation with ${contactNumber} is in manual mode. No reply will be sent.`);
            return;
        }
        
        // --- Step 4: The Global Reply Mode Check ---
        const user = await UserID.findByPk(userId);
        if (user.reply_mode === 'off') {
            console.log(`Auto-reply is turned off for user ${userId}. No reply will be sent.`);
            return;
        }

        // --- At this point, we know we are going to interact. Now we log. ---
        // Step 5: Log the incoming message, linking it to the conversation.
        await ChatMessage.create({
            conversation_id: conversation.id,
            sender: 'user',
            message_content: messageBody,
            userId: userId
        });

        // --- NEW: Daily Bot Reply Limit Check ---
        const usage = await UserUsage.findOne({ where: { userId } });
        if (usage && usage.bot_replies_sent >= user.daily_reply_limit) {
            console.log(`User ${userId} has reached their daily bot reply limit of ${user.daily_reply_limit}. No reply will be sent.`);
            // Optionally, send a one-time email notification here
            return; // Stop processing
        }

        // Step 6: Best-Guess Attribution for Campaign Reply
        const campaignContact = await CampaignContacts.findOne({
            where: { contact_id: contactRecord.id, status: 'sent' },
            include: [{ model: Campaign, where: { client_id: clientId, status: 'Running' } }],
            order: [['sent_at', 'DESC']]
        });
        if (campaignContact) {
            await ChatMessage.update({ campaign_id: campaignContact.campaign_id }, { where: { conversation_id: conversation.id } })
            await campaignContact.update({ status: 'replied', replied_at: new Date() });
        }

        // Step 7: Determine the bot's reply.
        let botReply = null;

        if (user.reply_mode === 'ai') {
            // AI LIMIT LOGIC: Only apply the 10-reply limit if it's a campaign reply.
            if (campaignContact && campaignContact.ai_reply_count >= 10) {
                console.log(`AI reply limit reached for contact ${contactRecord.id} in campaign ${campaignContact.campaign_id}.`);
                return; // Stop processing
            }
            
            const aiConfig = await AiConfiguration.findByPk(userId);
            const chatHistory = await ChatMessage.findAll({ 
                where: { conversation_id: conversation.id }, 
                order: [['timestamp', 'DESC']], 
                limit: 10 
            });
            
            botReply = await generateAiResponse(aiConfig, chatHistory.reverse(), messageBody);

        } else if (user.reply_mode === 'keyword') {
            const dialogFlows = await DialogFlows.findAll({ where: { userId } });
            for (const flow of dialogFlows) {
                if (messageBody.toLowerCase().includes(flow.trigger_message.toLowerCase())) {
                    botReply = flow.response_message;
                    break;
                }
            }
        }

        // Step 8: If a reply was generated, log it, increment counters, and send it.
        if (botReply) {
            // Increment the daily reply counter
            await UserUsage.increment('bot_replies_sent', { where: { userId } });
            
            // If it was a campaign-related AI reply, increment that specific counter
            if (user.reply_mode === 'ai' && campaignContact) {
                await campaignContact.increment('ai_reply_count');
            }

            // Log the bot's reply
            await ChatMessage.create({
                conversation_id: conversation.id,
                sender: 'bot',
                message_content: botReply,
                userId: userId
            });

            // Command the worker to send the message
            await fetch(`${process.env.VPS_URL}/api/send-message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    number: contactNumber, // <-- Use the sanitized number
                    message: botReply,
                    clientId: clientId,
                    auth: process.env.VPS_KEY,
                }),
            });
        }

    } catch (error) {
        console.error('Error processing incoming message webhook:', error);
    }
});



module.exports = router;
