const express = require('express');
const router = express.Router();
const { UserID } = require('../models');
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
            return response.json();
        })
        .then(data => {
            console.log(data); 
            res.status(200).json('Device deleted successfully')
        })
        .catch(error => {
            console.error('Error fetching QR code:', error);
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
})

module.exports = router;