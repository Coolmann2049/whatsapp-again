const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const { UserID, Contact, UploadHistory } = require('../models');
const dotenv = require('dotenv');

// Load environment variablFVes
dotenv.config();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        console.log('Multer destination function called');
        const uploadDir = 'uploads/';
        // Create uploads directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            console.log('Creating uploads directory:', uploadDir);
            fs.mkdirSync(uploadDir, { recursive: true });
        } else {
            console.log('Uploads directory already exists:', uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        console.log('Multer filename function called for file:', file.originalname);
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = 'contacts-' + uniqueSuffix + path.extname(file.originalname);
        console.log('Generated filename:', filename);
        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 15 * 1024 * 1024 // 15MB limit
    },
    fileFilter: function (req, file, cb) {
        console.log('Multer fileFilter function called');
        console.log('File details:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size
        });
        
        // Check file extension
        if (path.extname(file.originalname).toLowerCase() !== '.csv') {
            console.error('Invalid file extension:', path.extname(file.originalname));
            return cb(new Error('Only CSV files are allowed'));
        }
        console.log('File validation passed');
        cb(null, true);
    }
});

router.get('/upload-history', async (req, res) => {
    try {
        const uploadHistory = await UploadHistory.findAll({
            where: {
                userId: req.session.userId
            },
            order: [['createdAt', 'DESC']]
        });


        res.json(uploadHistory);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/upload-contacts', upload.single('csvFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const contacts = [];
    let errorCount = 0;

    try {
        // Step 1: Create the UploadHistory record first to get its ID
        const historyRecord = await UploadHistory.create({
            file_name: req.file.originalname,
            status: 'Processing', // Start with a processing status
            userId: req.session.userId
        });
        const uploadHistoryId = historyRecord.id;

        // Step 2: Parse the CSV and add the new uploadHistoryId to each contact
        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv({ skipEmptyLines: true }))
                .on('data', (row) => {
                    const cleanRow = {};
                    Object.keys(row).forEach(key => {
                        const cleanKey = key.trim().toLowerCase();
                        cleanRow[cleanKey] = row[key] ? row[key].trim() : '';
                    });
                    
                    if (cleanRow.phone) {
                        contacts.push({
                            name: cleanRow.name || '',
                            phone: cleanRow.phone,
                            email: cleanRow.email || '',
                            company: cleanRow.company || '',
                            userId: req.session.userId,
                            uploadHistoryId: uploadHistoryId // <-- Add the foreign key here
                        });
                    } else {
                        errorCount++;
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });

        if (contacts.length === 0) {
            await historyRecord.update({ status: 'Failed' });
            return res.status(400).json({ 
                error: 'No valid contacts found. Please ensure your CSV has a "phone" column.' 
            });
        }

        // Step 3: Save contacts to the database using bulkCreate
        await Contact.bulkCreate(contacts, {
            updateOnDuplicate: ["name", "email", "company"] // This will update contacts if a phone+userId combo already exists
        });

        // Step 4: Update the history record with the final counts and status
        await historyRecord.update({
            status: 'Completed',
            total_contacts: contacts.length
        });

        res.json({
            success: true,
            message: `Successfully processed ${contacts.length} contacts. ${errorCount} rows were skipped.`,
            contactsProcessed: contacts.length,
            historyRecord: historyRecord.toJSON()
        });

    } catch (error) {
        console.error('UPLOAD ERROR:', error);
        // If an error occurs, try to update the history record to 'Failed'
        if (historyRecord) {
            await historyRecord.update({ status: 'Failed' }).catch(e => console.error("Failed to update history on error:", e));
        }
        res.status(500).json({ error: 'Failed to process file' });
    } finally {
        // Step 5: Clean up the uploaded file
        await fs.unlink(filePath);
    }
});


module.exports = router;
