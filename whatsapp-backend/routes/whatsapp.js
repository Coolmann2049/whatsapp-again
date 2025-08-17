const express = require('express');
const router = express.Router();
const { UserID, Campaign, CampaignContacts } = require('../models');
const dotenv = require('dotenv');

// Load environment variablFVes
dotenv.config();

router.delete('/delete-device/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { userId, email } = req.session; // Assuming authMiddleware provides this

        const user = await UserID.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
``
        const clientId = `${userId}_${deviceId}`;

        try {
            // --- Call the Worker VPS ---
            const response = await fetch(`${process.env.VPS_URL}/api/disconnect-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: clientId,
                    auth: process.env.VPS_KEY,
                }),
            });

            // --- Handle Worker's Response ---
            // Treat a 404 (Not Found) from the worker as a success for cleanup.
            if (!response.ok && response.status !== 404) {
                const errorText = await response.text();
                throw new Error(`Worker VPS failed to disconnect: ${errorText}`);
            }

        } catch (workerError) {
            // If the worker is down or sends a 500 error, notify the frontend.
            console.error('Error commanding worker to disconnect:', workerError);
            return res.status(502).json({ message: 'Could not communicate with the device server. Please try again.' });
        }

        // --- Database Cleanup on Main Backend ---
        // This runs if the worker call was successful OR returned a 404.
        let devices = user.devices_data ? JSON.parse(user.devices_data) : [];
        const updatedDevices = devices.filter(device => device.id !== deviceId);
        
        user.devices_data = JSON.stringify(updatedDevices);
        user.count = updatedDevices.length;
        await user.save();

        res.status(200).json({ message: 'Device deleted successfully' });

    } catch (error) {
        console.error('Delete device error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.post('/send-test-message/:deviceId', async (req, res) => {
    const { deviceId } = req.params;
    const { number, message } = req.body;
    const clientId = `${req.session.userId}_${deviceId}`

    if (!deviceId || !number || !message) {
        return res.status(400).json({ message: 'clientId, number, and message are required.' });
    }
    console.log({ 
            number: number,
            message: message,
            clientId: clientId,
            auth: process.env.VPS_KEY,
        });
        
    const sanitizedNumber = sanitizePhoneNumber(number);

    if (!sanitizedNumber) {
        return res.status(400).json({ message: `Invalid phone number format provided. ${number}` });
    }

    fetch(`${process.env.VPS_URL}/api/send-message`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            number: sanitizedNumber, // <-- Use the sanitized number
            message: message,
            clientId: clientId,
            auth: process.env.VPS_KEY,
        }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log(data); 
        res.status(200).json('Message sent successfully')
    })
    .catch(error => {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Internal server error' });
    });
});

router.get('/get-device-data', async (req, res) => {

    const userId = req.session.userId;

    const user = await UserID.findByPk(userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    const devices = JSON.parse(user.devices_data);
    res.status(200).json(devices);
});


// POST: Start a specific campaign
router.post('/campaigns/:id/start', async (req, res) => {
    try {
        const campaignId = req.params.id;
        const userId = req.session.userId;

        // --- Step 1: Fetch all necessary data in parallel ---
        const campaign = await Campaign.findOne({ where: { id: campaignId, userId } });
        const user = await UserID.findByPk(userId, { attributes: ['devices_data'] });

        if (!campaign) {
            console.log('campaign not found for ', campaignId, userId);
            return res.status(404).json({ error: 'Campaign not found.' });
        }

        // --- Step 2: Pre-Flight Safety Checks ---

        // Check 1: Does the campaign have a template?
        if (!campaign.template_id) {
            return res.status(400).json({ error: 'This campaign cannot be started because its message template has been deleted. Please edit the campaign and select a new template.' });
        }

        // Check 2: Is the selected device connected?
        const devices = user && user.devices_data ? JSON.parse(user.devices_data) : [];
        const selectedDevice = devices.find(d => String(d.clientId) === String(campaign.client_id));
        if (!selectedDevice || selectedDevice.status !== 'connected') {
            return res.status(400).json({ error: 'The device for this campaign is disconnected. Please reconnect it on the Manage Devices page to start this campaign.' });
        }

        // Check 3: Does the campaign have any contacts to send to?
        const contactCount = await CampaignContacts.count({ where: { campaign_id: campaignId } });
        if (contactCount === 0) {
            return res.status(400).json({ error: 'This campaign has no contacts. Please edit the campaign and add a contact list.' });
        }

        // --- Step 3: Check for other running campaigns (as before) ---
        const runningCampaign = await Campaign.findOne({
            where: { client_id: campaign.client_id, status: 'Running' }
        });
        if (runningCampaign && runningCampaign.id !== parseInt(campaignId)) {
            return res.status(409).json({ error: 'Another campaign is already running on this device.' });
        }
        
        // Check the usage
        const { usage } = await checkAndResetUsage(userId);
        if (usage.campaign_messages_sent >= user.daily_campaign_limit) {
            return res.status(429).json({ 
                error: `You have reached your daily limit of ${user.daily_campaign_limit} campaign messages. This campaign will resume automatically when your limit resets.` 
            });
        }

        // --- Step 4: If all checks pass, proceed ---
        await campaign.update({ status: 'Running' });

        const response = await fetch(`${process.env.VPS_URL}/api/process-campaign`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                campaignId: campaign.id,
                clientId: `${campaign.client_id}`,
                auth: process.env.VPS_KEY
            })
        });

        if (!response.ok) {
            await campaign.update({ status: 'Draft' });
            throw new Error('The worker failed to start the campaign process.');
        }

        res.json({ success: true, message: 'Campaign has been started.' });
    } catch (error) {
        console.error('Error starting campaign:', error);
        res.status(500).json({ error: 'Failed to start campaign.' });
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


module.exports = router;