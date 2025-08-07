const express = require('express');
const router = express.Router();
const { UserID, Campaign } = require('../models');
const dotenv = require('dotenv');

// Load environment variablFVes
dotenv.config();

router.delete('/delete-device/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;

        const userId = req.session.userId;
        const email = req.session.email;
        const user = await UserID.findByPk(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        if (!deviceId) {
            return res.status(400).json({ message: 'Client ID is required' });
        }

        const clientId = `${userId}_${email}_${deviceId}`

        fetch(`${process.env.VPS_URL}/api/disconnect-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                clientId: clientId,
                auth: process.env.VPS_KEY,
            }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        })
        .then(data => {
            console.log(data); 
            res.status(200).json('Device deleted successfully')
        })
        .catch(error => {
            console.error('Error disconnecting device:', error);
        });
    } catch (error) {
        console.error('Delete device error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/send-test-message/:deviceId', async (req, res) => {
    const { deviceId } = req.params;
    const { number, message } = req.body;

    const clientId = `${req.session.userId}_${req.session.email}_${deviceId}`

    if (!deviceId || !number || !message) {
        return res.status(400).json({ message: 'clientId, number, and message are required.' });
    }
    console.log(`${process.env.VPS_URL}/api/send-test-message`)
    console.log({ 
            number: number,
            message: message,
            clientId: clientId,
            auth: process.env.VPS_KEY,
        });
    fetch(`${process.env.VPS_URL}/api/send-test-message`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            number: number,
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

        const campaign = await Campaign.findOne({ where: { id: campaignId, userId } });
        if (!campaign) {
            console.log('campaign not found for ', campaignId, userId);
            return res.status(404).json({ error: 'Campaign not found.' });
        }

        const runningCampaign = await Campaign.findOne({
            where: { client_id: campaign.client_id, status: 'Running' }
        });
        if (runningCampaign && runningCampaign.id !== parseInt(campaignId)) {
            return res.status(409).json({ error: 'Another campaign is already running on this device.' });
        }

        await campaign.update({ status: 'Running' });

        const response = await fetch(`${process.env.VPS_URL}/api/process-campaign`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                campaignId: campaign.id,
                clientId: `${userId}_${req.session.email}_${campaign.deviceId}`,
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


module.exports = router;