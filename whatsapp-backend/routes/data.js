const express = require('express');
const router = express.Router();
const { UserID } = require('../models');
const dotenv = require('dotenv');
const { Campaign, MessageTemplate, UserID } = require('../models'); // Adjust the path as needed


// Load environment variables
dotenv.config();

// --- Campaign API Endpoints ---

// Create new campaign
router.post('/campaigns', async (req, res) => {
    try {
        const { name, type, template_id } = req.body;
        const userId = req.session.userId; // Get user ID from session

        // Use Sequelize's .create() method
        const newCampaign = await Campaign.create({
            name,
            type,
            template_id,
            userId // Add the foreign key
        });

        res.status(201).json({ success: true, campaign: newCampaign });
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ success: false, error: 'Failed to create campaign' });
    }
});

// Get all campaigns for the logged-in user
router.get('/campaigns', async (req, res) => {
    try {
        const userId = req.session.userId;

        // Use .findAll() with an 'include' to perform the JOIN
        const campaigns = await Campaign.findAll({
            where: { userId: userId }, // Filter campaigns by the logged-in user
            include: [{
                model: MessageTemplate,
                as: 'template', // Use an alias for the included model
                attributes: ['name', 'content'] // Only include specific template fields
            }],
            order: [['created_at', 'DESC']] // Sort by creation date
        });

        res.json({ success: true, campaigns });
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch campaigns' });
    }
});

router.delete('/campaigns/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        // Ensure the user can only delete their own campaigns
        const result = await Campaign.destroy({
            where: { id, userId }
        });

        if (result === 0) {
            return res.status(404).json({ error: 'Campaign not found or you do not have permission to delete it' });
        }
        res.status(204).send(); // Success, no content to return
    } catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ error: 'Failed to delete campaign' });
    }
});


router.get('/campaign-creation-data', async (req, res) => {
    try {
        const userId = req.session.userId;

        // Use Promise.all to fetch all data concurrently for better performance
        const [campaigns, templates, user] = await Promise.all([
            // 1. Get all campaigns (with their template names)
            Campaign.findAll({
                where: { userId: userId },
                include: [{
                    model: MessageTemplate,
                    as: 'template',
                    attributes: ['name']
                }],
                order: [['created_at', 'DESC']]
            }),
            // 2. Get all available message templates
            MessageTemplate.findAll({
                where: { userId: userId },
                order: [['name', 'ASC']]
            }),
            // 3. Get the user to parse their device data
            UserID.findByPk(userId, {
                attributes: ['devices_data'] // Only select the column we need
            })
        ]);

        // Safely parse the devices_data JSON string
        const devices = user && user.devices_data ? JSON.parse(user.devices_data) : [];

        // 4. Send all data back in a single, organized response
        res.json({
            success: true,
            data: {
                campaigns,
                templates,
                devices
            }
        });

    } catch (error) {
        console.error('Error fetching campaign creation data:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch required data' });
    }
});

// --- Template API Endpoints ---

// Create new template
router.post('/templates', async (req, res) => {
    try {
        const { name, content, type, variables } = req.body;
        const userId = req.session.userId;

        const newTemplate = await MessageTemplate.create({
            name,
            content,
            type,
            variables,
            userId
        });

        res.status(201).json({ success: true, template: newTemplate });
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ success: false, error: 'Failed to create template' });
    }
});

// Get all templates for the logged-in user
router.get('/templates', async (req, res) => {
    try {
        const userId = req.session.userId;

        const templates = await MessageTemplate.findAll({
            where: { userId: userId },
            order: [['created_at', 'DESC']]
        });

        res.json({ success: true, templates });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch templates' });
    }
});

// DELETE: Delete a specific message template
router.delete('/templates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        // Ensure the user can only delete their own templates
        const result = await MessageTemplate.destroy({
            where: { id, userId }
        });

        if (result === 0) {
            return res.status(404).json({ error: 'Template not found or you do not have permission to delete it' });
        }
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});


// --- Welcome Message Endpoints ---

// POST: Create a new welcome message
router.post('/welcome-messages', async (req, res) => {
    try {
        const { title, content, is_active } = req.body;
        const userId = req.session.userId;

        const newMessage = await WelcomeMessage.create({
            title,
            content,
            is_active,
            userId
        });
        res.status(201).json(newMessage);
    } catch (error) {
        console.error('Error creating welcome message:', error);
        res.status(500).json({ error: 'Failed to create welcome message' });
    }
});

// GET: Get all welcome messages for the user
router.get('/welcome-messages', async (req, res) => {
    try {
        const userId = req.session.userId;
        const messages = await WelcomeMessage.findAll({
            where: { userId },
            order: [['created_at', 'DESC']]
        });
        res.json(messages);
    } catch (error) {
        console.error('Error fetching welcome messages:', error);
        res.status(500).json({ error: 'Failed to fetch welcome messages' });
    }
});

// DELETE: Delete a specific welcome message
router.delete('/welcome-messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        // Ensure the user can only delete their own messages
        const result = await WelcomeMessage.destroy({
            where: { id, userId }
        });

        if (result === 0) {
            return res.status(404).json({ error: 'Message not found or you do not have permission to delete it' });
        }
        res.status(204).send(); // 204 No Content is standard for a successful delete
    } catch (error) {
        console.error('Error deleting welcome message:', error);
        res.status(500).json({ error: 'Failed to delete welcome message' });
    }
});

// --- Dialog Flow Endpoints ---

// POST: Create a new dialog flow
router.post('/dialog-flows', async (req, res) => {
    try {
        const { trigger_message, response_message, parent_id } = req.body;
        const userId = req.session.userId;

        const newFlow = await DialogFlow.create({
            trigger_message,
            response_message,
            parent_id,
            userId
        });
        res.status(201).json(newFlow);
    } catch (error) {
        console.error('Error creating dialog flow:', error);
        res.status(500).json({ error: 'Failed to create dialog flow' });
    }
});

// GET: Get all dialog flows for the user
router.get('/dialog-flows', async (req, res) => {
    try {
        const userId = req.session.userId;
        const flows = await DialogFlow.findAll({
            where: { userId },
            order: [['created_at', 'ASC']]
        });
        res.json(flows);
    } catch (error) {
        console.error('Error fetching dialog flows:', error);
        res.status(500).json({ error: 'Failed to fetch dialog flows' });
    }
});

// DELETE: Delete a specific dialog flow
router.delete('/dialog-flows/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const result = await DialogFlow.destroy({
            where: { id, userId }
        });

        if (result === 0) {
            return res.status(404).json({ error: 'Dialog flow not found or you do not have permission to delete it' });
        }
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting dialog flow:', error);
        res.status(500).json({ error: 'Failed to delete dialog flow' });
    }
});

// --- AI Configuration Endpoints ---

// POST: Create or Update the user's AI configuration
router.post('/ai-configuration', async (req, res) => {
    try {
        const userId = req.session.userId;
        const configData = req.body;

        // Use .upsert() which creates a new record or updates an existing one
        const [config, created] = await AiConfiguration.upsert({
            userId,
            ...configData
        });

        res.json(config);
    } catch (error) {
        console.error('Error saving AI configuration:', error);
        res.status(500).json({ error: 'Failed to save AI configuration' });
    }
});

// GET: Get the user's AI configuration
router.get('/ai-configuration', async (req, res) => {
    try {
        const userId = req.session.userId;
        const config = await AiConfiguration.findByPk(userId);

        if (!config) {
            // It's okay if a config doesn't exist yet, return a default or empty object
            return res.json(null); 
        }
        res.json(config);
    } catch (error) {
        console.error('Error fetching AI configuration:', error);
        res.status(500).json({ error: 'Failed to fetch AI configuration' });
    }
});


module.exports = router;

