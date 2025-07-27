const express = require('express');
const router = express.Router();
const { UserID } = require('../models');
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
            user.count = count++;
            await user.save();

            
        } else if (status === 'disconnected') {
            user.count = count--;
            await user.save();
        }

        io.to(email).emit('device-update', { 
            id: count,
            status,
            name: userName,
            phone: userPhone
        });

        res.status(200).json({ message: 'Status updated successfully' });


    } catch (error) {
        console.error('Error updating QR code:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
})
