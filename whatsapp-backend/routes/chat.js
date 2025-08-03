// routes/chat.js

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize'); // Import the 'Op' operator for LIKE queries

// Import the necessary models
const { ChatMessage, Contact, sequelize } = require('../models');

// --- "Reader" Endpoint 1: Get the paginated list of conversations ---
router.get('/conversations', async (req, res) => {
    try {
        const userId = req.session.userId;
        
        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30; // 30 conversations per page
        const offset = (page - 1) * limit;

        // Search
        const searchQuery = req.query.search || '';
        let contactWhereClause = {};

        if (searchQuery) {
            contactWhereClause = {
                [Op.or]: [
                    { name: { [Op.like]: `%${searchQuery}%` } },
                    { phone: { [Op.like]: `%${searchQuery}%` } }
                ]
            };
        }

        // We use findAndCountAll on the Contact model to correctly paginate the filtered results
        const result = await Contact.findAndCountAll({
            limit,
            offset,
            where: {
                userId,
                ...contactWhereClause
            },
            // Only include contacts that have messages
            include: [{
                model: ChatMessage,
                attributes: [], // We don't need the message data here, just the link
                required: true // This performs an INNER JOIN
            }],
            group: ['Contact.id'], // Group by contact to get unique conversations
            order: [
                // Order by the timestamp of the most recent message for that contact
                [sequelize.literal('(SELECT MAX(timestamp) FROM chat_messages WHERE chat_messages.contact_id = Contact.id)'), 'DESC']
            ]
        });

        res.json({
            totalPages: Math.ceil(result.count.length / limit),
            currentPage: page,
            conversations: result.rows
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
                where: { userId, contact_id: contactId },
                order: [['timestamp', 'DESC']], // Get newest messages first for each page
                limit,
                offset
            }),
            Contact.findOne({
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
        const contact = await Contact.findOne({
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


module.exports = router;``