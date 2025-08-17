const express = require('express');
const router = express.Router();
const { UserID, AiConfiguration, DialogFlows, Campaign, MessageTemplate, CampaignContacts, Contact, ChatMessage, Conversation } = require('../models');
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
            return res.json(null); // Signal to the worker that the campaign is done
        }
        if (campaign.status !== 'Running') {
            console.log(`Campaign ${campaignId} is not in 'Running' state. Current status: ${campaign.status}. Stopping worker.`);
            // Signal to the worker that the job is done for now.
            return res.json(null);
        }
        
        const sanitizedPhone = sanitizePhoneNumber(campaignContact.Contact.phone);


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
router.post('/process-incoming-message', async (req, res) => {
    console.log('e');
    const { clientId, contactNumber, messageBody, auth} = req.body;
    
    if (auth != process.env.VPS_KEY) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    // Immediately send a 200 OK to the worker so it doesn't have to wait.
    res.sendStatus(200);

    try {
        const userId = clientId.split('_')[0];

        // Step 1: Check if the contact exists in our system at all. If not, ignore.
        const contactExists = await Contact.findOne({ where: { phone: contactNumber, userId: userId } });
        if (!contactExists) {
            console.log(`Ignoring message from ${contactNumber}: Not a known business contact.`);
            return;
        }

        // Step 2: Find or create the single, authoritative conversation thread.
        const [conversation] = await Conversation.findOrCreate({
            where: { userId, contact_phone: contactNumber }
        });

        // Step 3: Check for Manual Mode. If active, stop immediately.
        if (conversation.is_manual_mode) {
            console.log(`Conversation with ${contactNumber} is in manual mode. No reply will be sent.`);
            return;
        }

        // Step 4: Check the user's global reply mode.
        const user = await UserID.findByPk(userId);
        if (user.reply_mode === 'off') {
            console.log(`Auto-reply is turned off for user ${userId}. No reply will be sent.`);
            return;
        }

        // --- At this point, we know we are going to interact. Now we can log. ---
        // Step 5: Log the incoming message.
        await ChatMessage.create({
            conversation_id: conversation.id,
            sender: 'user',
            message_content: messageBody
        });

        let botReply = null;

        if (user.reply_mode === 'ai') {
            console.log('ai mode');
            const aiConfig = await AiConfiguration.findByPk(userId);
            const chatHistory = await ChatMessage.findAll({
                where: {
                    userId: userId,
                    conversation_id: conversation.id
                },
                order: [['timestamp', 'DESC']], // Get the most recent messages
                limit: 10 // Limit to the last 10 messages for context
            });

            // The AI needs the history in chronological order (oldest to newest)
            // so we reverse the array we just fetched.
            const reversedHistory = chatHistory.reverse(); 
            botReply = await generateAiResponse(aiConfig, reversedHistory, messageBody);
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
        console.log(botReply);
        // --- Step 5: Send the Reply (if one was determined) ---
        if (botReply) {
            await ChatMessage.create({
                userId,
                conversation_id: conversation.id,
                sender: 'bot',
                message_content: botReply
            });

            await fetch(`${process.env.VPS_URL}/api/send-message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ clientId, number: contactNumber, message: botReply, auth: process.env.VPS_KEY })
            });
        } else {
            console.log(`No reply action found for message from ${contactNumber}.`);
        }

    } catch (error) {
        console.error('Error processing incoming message webhook:', error);
    }
});




module.exports = router;
