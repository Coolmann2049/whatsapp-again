const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
const { Campaign, Contact, MessageTemplate, DialogFlows , WelcomeMessage, AiConfiguration, UserID, UploadHistory, CampaignContacts} = require('../models'); // Adjust the path as needed
const { generateAiResponse } = require('./services/aiServices');


// Load environment variables
dotenv.config();

// --- Campaign API Endpoints ---

// Create new campaign
router.post('/campaigns', async (req, res) => {
    try {
        const { name, type, template_id, deviceId, contactFileIds, clientId } = req.body;
        const userId = req.session.userId;

        // Step 1: Create the main campaign record to get its ID
        const newCampaign = await Campaign.create({
            name,
            type: 'Standard', // Or get from body if needed
            template_id,
            deviceId,
            userId,
            status: 'Draft',
            client_id: clientId
        });

        // Step 2: Find all contacts that belong to the selected upload files
        const contactsToInclude = await Contact.findAll({
            where: {
                userId: userId,
                uploadHistoryId: contactFileIds // This is an array of IDs from the frontend
            },
            attributes: ['id'] // We only need the contact IDs
        });

        if (contactsToInclude.length === 0) {
            // It's a valid campaign, just with no contacts yet. This is fine.
            return res.status(201).json({ success: true, campaign: newCampaign });
        }

        // Step 3: Prepare the data for the linking table
        const campaignContactsData = contactsToInclude.map(contact => ({
            campaign_id: newCampaign.id,
            contact_id: contact.id,
            userId: userId,

            // Status defaults to 'pending'
        }));

        // Step 4: Bulk insert all the links into the campaign_contacts table
        await CampaignContacts.bulkCreate(campaignContactsData);

        res.status(201).json({ success: true, campaign: newCampaign });

    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
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


// PUT: Pause a running campaign
router.put('/campaigns/:id/pause', async (req, res) => {
    try {
        const campaignId = req.params.id;
        const userId = req.session.userId;

        // Find the campaign to ensure it's in a 'Running' state
        const campaign = await Campaign.findOne({
            where: {
                id: campaignId,
                userId: userId,
                status: 'Running' // Only allow pausing of running campaigns
            }
        });

        if (!campaign) {
            return res.status(404).json({ error: 'Running campaign not found or you do not have permission to pause it.' });
        }

        // Update the status to 'Paused'
        await campaign.update({ status: 'Paused' });

        res.json({ success: true, message: 'Campaign has been paused.' });

    } catch (error) {
        console.error('Error pausing campaign:', error);
        res.status(500).json({ error: 'Failed to pause campaign.' });
    }
});

router.put('/campaigns/:id', async (req, res) => {
    try {
        const campaignId = req.params.id;
        const userId = req.session.userId;
        const { name, template_id, clientId, contactFileIds } = req.body;

        // Step 1: Update the main campaign details
        // We also check that the campaign belongs to the logged-in user
        const [updateCount] = await Campaign.update({
            name,
            template_id,
            client_id: clientId
        }, {
            where: { id: campaignId, userId }
        });

        // If no rows were updated, the campaign was not found for this user
        if (updateCount === 0) {
            return res.status(404).json({ error: 'Campaign not found or you do not have permission to edit it.' });
        }

        // Step 2: "Destroy and Recreate" the contact list for this campaign.
        // This is the most robust way to handle edits.

        // First, delete all existing contact links for this campaign.
        await CampaignContacts.destroy({
            where: { campaign_id: campaignId }
        });

        // Then, find all contacts that belong to the newly selected upload files.
        const contacts = await Contact.findAll({
            where: {
                userId,
                uploadHistoryId: contactFileIds // Find contacts from the selected upload batches
            },
            attributes: ['id'] // We only need their IDs for the linking table
        });

        // Prepare the new data for the linking table
        const campaignContactsData = contacts.map(contact => ({
            campaign_id: campaignId,
            contact_id: contact.id
        }));

        // Bulk insert the new links into the campaign_contacts table.
        if (campaignContactsData.length > 0) {
            await CampaignContacts.bulkCreate(campaignContactsData);
        }

        res.json({ success: true, message: 'Campaign updated successfully.' });

    } catch (error) {
        console.error('Error updating campaign:', error);
        res.status(500).json({ error: 'Failed to update campaign.' });
    }
});

router.get('/campaign-creation-data', async (req, res) => {
    try {
        const userId = req.session.userId;

        // Use Promise.all to fetch all data concurrently for better performance
        const [campaigns, templates, user, contacts] = await Promise.all([
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
                attributes: ['devices_data','email'] // Only select the column we need
            }),
            UploadHistory.findAll({
                where: {
                    userId: userId
                },
                order: [['createdAt', 'DESC']]
                })
        ]);

        // Safely parse the devices_data JSON string
        const devices = user && user.devices_data ? JSON.parse(user.devices_data) : [];
        const devicesWithClientId = devices.map(device => {
            return {
                ...device, // Keep all original device properties (id, name, status, etc.)
                clientId: `${userId}_${user.email}_${device.id}` // Add the correctly formatted clientId
            };
        }); 

        const deviceNameMap = new Map();
        devices.forEach(device => {
            deviceNameMap.set(String(device.id), device.name); // Ensure IDs are strings for matching
        });

        // Step 3: Manually attach the device name to each campaign
        const campaignsWithDeviceNames = campaigns.map(campaign => {
            const campaignJSON = campaign.toJSON(); // Get a plain object
            const deviceId = campaignJSON.client_id.split('_')[2];

            const deviceName = deviceNameMap.get(String(deviceId));
            return {
                ...campaignJSON,
                device: { // Add a 'device' object to match the frontend's expectation
                    name: deviceName || 'Unknown Device'
                }
            };
        });

        
        // 4. Send all data back in a single, organized response
        res.json({
            success: true,
            data: {
                campaigns: campaignsWithDeviceNames,
                templates,
                devices:devicesWithClientId,
                contacts
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

// // POST: Create a new welcome message
// router.post('/welcome-messages', async (req, res) => {
//     try {
//         const { title, content, is_active } = req.body;
//         const userId = req.session.userId;

//         const newMessage = await WelcomeMessage.create({
//             title,
//             content,
//             is_active,
//             userId
//         });
//         res.status(201).json(newMessage);
//     } catch (error) {
//         console.error('Error creating welcome message:', error);
//         res.status(500).json({ error: 'Failed to create welcome message' });
//     }
// });

// // GET: Get all welcome messages for the user
// router.get('/welcome-messages', async (req, res) => {
//     try {
//         const userId = req.session.userId;
//         const messages = await WelcomeMessage.findAll({
//             where: { userId },
//             order: [['created_at', 'DESC']]
//         });
//         res.json(messages);
//     } catch (error) {
//         console.error('Error fetching welcome messages:', error);
//         res.status(500).json({ error: 'Failed to fetch welcome messages' });
//     }
// });

// // DELETE: Delete a specific welcome message
// router.delete('/welcome-messages/:id', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const userId = req.session.userId;

//         // Ensure the user can only delete their own messages
//         const result = await WelcomeMessage.destroy({
//             where: { id, userId }
//         });

//         if (result === 0) {
//             return res.status(404).json({ error: 'Message not found or you do not have permission to delete it' });
//         }
//         res.status(204).send(); // 204 No Content is standard for a successful delete
//     } catch (error) {
//         console.error('Error deleting welcome message:', error);
//         res.status(500).json({ error: 'Failed to delete welcome message' });
//     }
// });

// --- Dialog Flow Endpoints ---

// POST: Create a new dialog flow
router.post('/dialog-flows', async (req, res) => {
    try {
        const { trigger_message, response_message, parent_id } = req.body;
        const userId = req.session.userId;

        const newFlow = await DialogFlows.create({
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
        const flows = await DialogFlows.findAll({
            where: { userId },
            order: [['created_at', 'ASC']]
        });

        const user = await UserID.findByPk(userId);
        const reply_mode = user.reply_mode;

        res.json({
            flows,
            reply_mode,

        });
    } catch (error) {
        console.error('Error fetching dialog flows:', error);
        res.status(500).json({ error: 'Failed to fetch dialog flows' });
    }
});

router.put('/reply-mode', async (req, res) => {
    try {
        const { reply_mode } = req.body;
        const userId = req.session.userId;

        // Validate the incoming data
        if (!['ai', 'keyword', 'off'].includes(reply_mode)) {
            return res.status(400).json({ error: 'Invalid reply mode specified.' });
        }

        const user = await UserID.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Update the user's reply mode
        await user.update({ reply_mode });

        res.json({ success: true, message: 'Reply mode updated successfully.' });

    } catch (error) {
        console.error('Error updating reply mode:', error);
        res.status(500).json({ error: 'Failed to update reply mode.' });
    }
});

// DELETE: Delete a specific dialog flow
router.delete('/dialog-flows/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const result = await DialogFlows.destroy({
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

// Authenticated by user session
router.post('/ai/test-chat', async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.session.userId;

        // Get the user's saved AI configuration
        const aiConfig = await AiConfiguration.findByPk(userId);
        if (!aiConfig) {
            return res.status(404).json({ error: 'AI configuration not found.' });
        }

        // Call the shared service with an empty history
        const reply = await generateAiResponse(aiConfig, [], message);

        res.json({ reply: reply });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate test response.' });
    }
});

module.exports = router;

