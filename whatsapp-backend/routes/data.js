const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
const argon2 = require('argon2');
const { Campaign, Contact, MessageTemplate, DialogFlows , UserAnalytics, AiConfiguration, UserID, UploadHistory, CampaignContacts} = require('../models'); // Adjust the path as needed
const { generateAiResponse } = require('./services/aiServices');


// Load environment variables
dotenv.config();

// Create new user account
router.post('/create-account', async (req, res) => {
    try {
        const { name, email, password, phone_number, company } = req.body;

        // Validate required fields
        if (!name || !email || !password || !phone_number || !company) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Hash the password using argon2
        const hashedPassword = await argon2.hash(password);

        // Upsert user in UserID table
        const [user, created] = await UserID.upsert({
            email,
            name,
            phone_number,
            company,
            hashed_password: hashedPassword
        }, {
            returning: true,
            conflictFields: ['email'] // Use email as the conflict field for upsert
        });

        if (created) {
            res.status(201).json({ 
                success: true, 
                message: 'Account created successfully',
                userId: user.userId 
            });
        } else {
            res.status(200).json({ 
                success: true, 
                message: 'Account updated successfully',
                userId: user.userId 
            });
        }
    } catch (error) {
        console.error('Error creating/updating account:', error);
        
        // Handle unique constraint violation for email
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ error: 'Email already exists' });
        }
        
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// --- Campaign API Endpoints ---

// Create new campaign
router.post('/campaigns', async (req, res) => {
    try {
        const { name, type, template_id, deviceId, contactFileIds, clientId } = req.body;
        const userId = req.session.userId;

        const newCampaign = await Campaign.create({
            name,
            type: 'Standard', // Or get from body if needed
            template_id,
            deviceId,
            userId,
            status: 'Draft',
            client_id: clientId
        });

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
            await CampaignContacts.bulkCreate(campaignContactsData);

        res.status(201).json({ success: true, campaign: newCampaign });
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});

// GET: Get all campaigns (This is a simplified version, the main data comes from the bundled endpoint)
router.get('/campaigns', async (req, res) => {
    try {
        const userId = req.session.userId;
        const campaigns = await Campaign.findAll({ where: { userId } });
        res.json({ success: true, campaigns });
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch campaigns' });
    }
});


// DELETE: Delete a specific campaign
router.delete('/campaigns/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        // Ensure the user can only delete their own campaigns
        const result = await Campaign.destroy({
            where: { id, userId }
        });

        if (result === 0) {
            return res.status(404).json({ error: 'Campaign not found.' });
        }
        res.status(204).send();
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

        const [updateCount] = await Campaign.update(
            { status: 'Paused' },
            { where: { id: campaignId, userId, status: 'Running' } }
        );

        if (updateCount === 0) {
            return res.status(404).json({ error: 'Running campaign not found.' });
        }

        res.json({ success: true, message: 'Campaign has been paused.' });
    } catch (error) {
        console.error('Error pausing campaign:', error);
        res.status(500).json({ error: 'Failed to pause campaign.' });
    }
});


// PUT: Update an existing campaign
router.put('/campaigns/:id', async (req, res) => {
    try {
        const campaignId = req.params.id;
        const userId = req.session.userId;
        const { name, template_id, clientId, contactFileIds } = req.body;

        const [updateCount] = await Campaign.update({
            name,
            template_id,
            client_id: clientId
        }, {
            where: { id: campaignId, userId }
        });

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
                contact_id: contact.id,
                userId: userId
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

// --- Main Data Endpoint for Campaign Creation Page ---
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

        // --- Corrected Device Data Handling ---
        const devices = user && user.devices_data ? JSON.parse(user.devices_data) : [];
        const deviceNameMap = new Map(devices.map(d => [String(d.id), d.name]));

        const campaignsWithDeviceNames = campaigns.map(campaign => {
            const campaignJSON = campaign.toJSON(); // Get a plain object
            const deviceId = campaignJSON.client_id.split('_')[1];

            const deviceName = deviceNameMap.get(String(deviceId));
            return {
                ...campaignJSON,
                device: { name: deviceName || 'Unknown Device' }
            };
        });

        const devicesWithClientId = devices.map(device => ({
            ...device,
            clientId: `${userId}_${device.id}`
        }));
        // --- End of Correction ---

        res.json({
            success: true,
            data: {
                campaigns: campaignsWithDeviceNames,
                templates,
                devices: devicesWithClientId,
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

// PUT: Update an existing message template
router.put('/templates/:id', async (req, res) => {
    try {
        const templateId = req.params.id;
        const userId = req.session.userId;
        const { name, content, type } = req.body;

        // 1. Safety Check: See if this template is used by any RUNNING campaigns.
        const runningCampaignsCount = await Campaign.count({
            where: {
                template_id: templateId,
                userId: userId,
                status: 'Running'
            }
        });

        if (runningCampaignsCount > 0) {
            return res.status(409).json({ error: 'This template cannot be edited because it is being used by an active campaign. Please pause the campaign first.' });
        }

        // 2. Proceed with the update
        const [updateCount] = await MessageTemplate.update({ name, content, type }, {
            where: { id: templateId, userId }
        });

        if (updateCount === 0) {
            return res.status(404).json({ error: 'Template not found or you do not have permission to edit it.' });
        }

        res.json({ success: true, message: 'Template updated successfully.' });

    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ error: 'Failed to update template.' });
    }
});

// DELETE: Delete a specific message template (Updated)
router.delete('/templates/:id', async (req, res) => {
    try {
        const templateId = req.params.id;
        const userId = req.session.userId;

        // 1. Safety Check: See if this template is used by any RUNNING campaigns.
        const runningCampaignsCount = await Campaign.count({
            where: {
                template_id: templateId,
                userId: userId,
                status: 'Running'
            }
        });

        if (runningCampaignsCount > 0) {
            return res.status(409).json({ error: 'This template cannot be deleted because it is being used by an active campaign. Please pause the campaign first.' });
        }

        // 2. Proceed with the deletion
        const result = await MessageTemplate.destroy({
            where: { id: templateId, userId }
        });

        if (result === 0) {
            return res.status(404).json({ error: 'Template not found.' });
        }
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ error: 'Failed to delete template.' });
    }
});
// DASHBOARD ANALYTICS 

router.get('/dashboard-analytics', async (req, res) => {
    try {
        const userId = req.session.userId;

        // Find the single analytics record for the logged-in user
        const analytics = await UserAnalytics.findByPk(userId);

        if (!analytics) {
            // If no record exists yet, return a default empty state
            return res.json({
                total_messages_sent: 0,
                active_chats_24h: 0,
                response_rate_all_time: 0,
                weekly_message_activity: [],
                weekly_response_rate: []
            });
        }

        res.json(analytics);

    } catch (error) {
        console.error('Error fetching dashboard analytics:', error);
        res.status(500).json({ error: 'Internal server error' });
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


// CSV manual data endpoints: 
router.post('/contacts/manual', async (req, res) => {
    try {
        const { name, phone, company } = req.body;
        const userId = req.session.userId;

        // Validate that the phone number is present
        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required.' });
        }
        
        // Sanitize the phone number
        const sanitizedPhone = sanitizePhoneNumber(phone);
        if (!sanitizedPhone) {
            return res.status(400).json({ error: 'Invalid phone number format provided.' });
        }

        const [manualHistoryRecord] = await UploadHistory.findOrCreate({
            where: {
                userId: userId,
                file_name: 'Manually Added Contacts'
            },
            defaults: {
                userId: userId,
                file_name: 'Manually Added Contacts',
                status: 'Completed',
                total_contacts: 0 // We'll increment this manually
            }
        });

        const existingContact = await Contact.findOne({
            where: { userId, phone: sanitizedPhone }
        });

        if (existingContact) {
            // --- "UN-DELETE" LOGIC ---
            // The contact exists, so we update it and ensure it's active.
            existingContact.name = name || '';
            existingContact.company = company || '';
            existingContact.is_deleted = false; // <-- THE FIX
            await existingContact.save();
            return res.status(200).json(existingContact);
        } else {
            // --- CREATE NEW LOGIC ---
            const newContact = await Contact.create({
                name: name || '',
                phone: sanitizedPhone,
                company: company || '',
                userId: userId,
                uploadHistoryId: manualHistoryRecord.id
            });

        // Step 3: Increment the total contacts count on the history record
            await manualHistoryRecord.increment('total_contacts');
            return res.status(201).json(newContact);
        }
    } catch (error) {
        console.error('Error adding manual contact:', error);
        res.status(500).json({ error: 'Failed to add contact.' });
    }
});

// DELETE: Soft delete a single manual contact
router.delete('/contacts/:id', async (req, res) => {
    try {
        const contactId = req.params.id;
        const userId = req.session.userId;

        // Instead of destroying, we update the is_deleted flag
        const [updateCount] = await Contact.update(
            { is_deleted: true },
            { where: { id: contactId, userId } }
        );

        if (updateCount === 0) {
            return res.status(404).json({ error: 'Contact not found.' });
        }
        
        // Decrement the count on the associated upload history record before deleting
        await UploadHistory.decrement('total_contacts', {
            where: { id: updateCount.uploadHistoryId }
        });

        // Delete the contact
        await updateCount.destroy();

        res.status(204).send(); // Success, no content

    } catch (error) {
        console.error('Error deleting contact:', error);
        res.status(500).json({ error: 'Failed to delete contact.' });
    }
});

// GET: Get all non-deleted manual contacts
router.get('/contacts/manual', async (req, res) => {
    try {
        const userId = req.session.userId;

        // Step 1: Find the specific "Manually Added Contacts" record for this user.
        const manualHistoryRecord = await UploadHistory.findOne({
            where: {
                userId: userId,
                file_name: 'Manually Added Contacts'
            }
        });

        // If no such record exists, it means no manual contacts have been added yet.
        if (!manualHistoryRecord) {
            return res.json([]); // Return an empty array
        }

        // Step 2: Find all contacts that are linked to that specific history record.
        const manualContacts = await Contact.findAll({
            where: {
                userId,
                uploadHistoryId: manualHistoryRecord.id,
                is_deleted: false // <-- THE CHANGE
            },
            order: [['created_at', 'DESC']]
        });

        res.json(manualContacts);
    } catch (error) {
        console.error('Error fetching manual contacts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

function sanitizePhoneNumber(rawPhoneNumber) {
    if (!rawPhoneNumber || typeof rawPhoneNumber !== 'string') {
        return null;
    }
    // Remove all non-digit characters
    const digitsOnly = rawPhoneNumber.replace(/\D/g, '');

    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
        // Already in correct format (e.g., 919876543210)
        return digitsOnly;
    } else if (digitsOnly.length === 10) {
        // Standard 10-digit mobile number, prepend country code
        return '91' + digitsOnly;
    }
    // Invalid length
    return null;
}

// GET: Fetch WhatsApp groups from worker VPS for a specific device
router.get('/groups/:clientId', async (req, res) => {
    try {
        const { clientId } = req.params;
        const { userId } = req.session;

        if (!userId || !clientId) {
            return res.status(400).json({ message: 'User ID and Device ID are required.' });
        }

        // Call worker VPS to get groups
        const response = await fetch(`${process.env.VPS_URL}/api/get-groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientId: clientId,
                auth: process.env.VPS_KEY
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Worker VPS failed to fetch groups: ${errorText}`);
        }

        const groupsData = await response.json();
        res.json(groupsData);

    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: 'Failed to fetch groups from WhatsApp' });
    }
});

// POST: Import contacts from selected WhatsApp groups
router.post('/import-group-contacts', async (req, res) => {
    try {
        const { clientId, groups } = req.body;
        const { userId } = req.session;

        if (!userId || !clientId || !groups || !Array.isArray(groups)) {
            return res.status(400).json({ message: 'User ID, Device ID, and Group IDs are required.' });
        }

        let allContacts = [];
        let groupNames = [];

        // Fetch contacts from each selected group
        for (const groupId of groupIds) {
            const response = await fetch(`${process.env.VPS_URL}/api/get-group-contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: clientId,
                    groupId: groupId,
                    auth: process.env.VPS_KEY
                })
            });

            if (!response.ok) {
                console.error(`Failed to fetch contacts for group ${groupId}`);
                continue;
            }

            const groupData = await response.json();
            if (groupData.contacts && groupData.contacts.length > 0) {
                allContacts = allContacts.concat(groupData.contacts);
                groupNames.push(groupData.groupName || `Group ${groupId}`);
            }
        }

        if (allContacts.length === 0) {
            return res.status(400).json({ message: 'No contacts found in selected groups.' });
        }

        // Create upload history record
        const historyRecord = await UploadHistory.create({
            file_name: `WhatsApp Groups: ${groupNames.join(', ')}`,
            status: 'Processing',
            userId: userId
        });

        // Prepare contacts for database insertion
        const contactsToInsert = allContacts.map(contact => ({
            name: contact.name || contact.pushname || '',
            phone: contact.phone,
            email: '',
            company: '',
            userId: userId,
            uploadHistoryId: historyRecord.id,
            is_deleted: false
        }));

        // Remove duplicates based on phone number
        const uniqueContacts = contactsToInsert.filter((contact, index, self) => 
            index === self.findIndex(c => c.phone === contact.phone)
        );

        // Bulk insert contacts
        await Contact.bulkCreate(uniqueContacts, {
            updateOnDuplicate: ["name", "email", "company", "is_deleted"]
        });

        // Update history record
        await historyRecord.update({
            status: 'Completed',
            total_contacts: uniqueContacts.length
        });

        res.json({
            success: true,
            message: `Successfully imported ${uniqueContacts.length} contacts from ${groupNames.length} groups.`,
            contactsProcessed: uniqueContacts.length,
            groupsProcessed: groupNames.length,
            historyRecord: historyRecord.toJSON()
        });

    } catch (error) {
        console.error('Error importing group contacts:', error);
        res.status(500).json({ error: 'Failed to import contacts from groups' });
    }
});

module.exports = router;

