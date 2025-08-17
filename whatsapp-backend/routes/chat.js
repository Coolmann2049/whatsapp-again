// routes/chat.js

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize'); // Import the 'Op' operator for LIKE queries

// Import the necessary models
const { ChatMessage, Contact, sequelize, Conversation } = require('../models');

// --- "Reader" Endpoint 1: Get the paginated list of conversations ---
router.get('/conversations', async (req, res) => {
    try {
        const userId = req.session.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const offset = (page - 1) * limit;
        const searchQuery = req.query.search || '';

        // The query is now correctly on the Conversation model.
        const result = await Conversation.findAndCountAll({
            limit,
            offset,
            where: {
                userId,
                // Search the phone number directly on the conversation table.
                contact_phone: { [Op.like]: `%${searchQuery}%` }
            },
            order: [['updated_at', 'DESC']] // Order by the most recent interaction.
        });

        // To get the most recent contact name for display, we do a second, efficient query.
        const contactPhones = result.rows.map(convo => convo.contact_phone);
        let contactNameMap = new Map();

        if (contactPhones.length > 0) {
            const contacts = await Contact.findAll({
                where: {
                    userId,
                    phone: contactPhones
                },
                // Get the most recent record for each phone number.
                order: [['created_at', 'DESC']],
            });
            // Create a map so we only get the latest name for each phone number.
            contacts.forEach(c => {
                if (!contactNameMap.has(c.phone)) {
                    contactNameMap.set(c.phone, c.name);
                }
            });
        }

        // Combine the conversation data with the contact names.
        const conversationsWithNames = result.rows.map(convo => ({
            ...convo.toJSON(),
            contact_name: contactNameMap.get(convo.contact_phone) || convo.contact_phone
        }));

        res.json({
            totalPages: Math.ceil(result.count / limit),
            currentPage: page,
            conversations: conversationsWithNames
        });

    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// --- "Reader" Endpoint 2: Get the paginated message history for a contact ---
router.get('/chat-history/:contactId', async (req, res) => {
    try {
        const { contactId } = req.params;
        const userId = req.session.userId;
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50; // 50 messages per page
        const offset = (page - 1) * limit;

        // Fetch both the messages and the contact's current manual mode status
        const [history, contact] = await Promise.all([
            ChatMessage.findAndCountAll({
                where: { userId, conversation_id: contactId },
                order: [['timestamp', 'DESC']], // Get newest messages first for each page
                limit,
                offset
            }),
            Conversation.findOne({
                where: { id: contactId, userId },
                attributes: ['is_manual_mode']
            })
        ]);

        if (!contact) {
            return res.status(404).json({ error: 'Contact not found.' });
        }

        res.json({
            totalPages: Math.ceil(history.count / limit),
            currentPage: page,
            is_manual_mode: contact.is_manual_mode,
            messages: history.rows
        });

    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// --- "State Changer" Endpoint: Toggle manual mode for a conversation ---
router.put('/conversations/:contactId/toggle-manual', async (req, res) => {
    try {
        const { contactId } = req.params;
        const userId = req.session.userId;

        // Find the contact to ensure it belongs to the user
        const contact = await Conversation.findOne({
            where: { id: contactId, userId }
        });

        if (!contact) {
            return res.status(404).json({ error: 'Contact not found or you do not have permission to modify it.' });
        }

        // Flip the boolean value and save
        const newMode = !contact.is_manual_mode;
        await contact.update({ is_manual_mode: newMode });

        res.json({ success: true, is_manual_mode: newMode });

    } catch (error) {
        console.error('Error toggling manual mode:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


module.exports = router;