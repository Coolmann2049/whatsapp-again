const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs'); // For synchronous methods like existsSync
const fsPromises = require('fs').promises; // For async/await methods like unlink
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
// GET: Get all non-archived upload history records
router.get('/upload-history', async (req, res) => {
    try {
        const uploadHistory = await UploadHistory.findAll({
            where: {
                userId: req.session.userId,
                is_archived: false // <-- THE CHANGE
            },
            order: [['createdAt', 'DESC']]
        });
        res.json(uploadHistory);
    } catch (error) {
        console.error('Error fetching upload history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE: Soft delete (archive) an upload history record
router.delete('/upload-history/:id', async (req, res) => {
    try {
        const historyId = req.params.id;
        const userId = req.session.userId;

        // Instead of destroying, we update the is_archived flag to true
        const [updateCount] = await UploadHistory.update(
            { is_archived: true }, 
            {
                where: {
                    id: historyId,
                    userId: userId
                }
            }
        );

        if (updateCount === 0) {
            return res.status(404).json({ error: 'Upload record not found.' });
        }

        res.status(204).json({ message: 'Upload record deleted successfully.' });

    } catch (error) {
        console.error('Error archiving upload history:', error);
        res.status(500).json({ error: 'Failed to delete upload history.' });
    }
});

router.post('/upload-contacts', upload.single('csvFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const contacts = [];
    let errorCount = 0;
    let historyRecord; // Define here to be accessible in catch/finally

    try {
        historyRecord = await UploadHistory.create({
            file_name: req.file.originalname,
            status: 'Processing',
            userId: req.session.userId
        });
        const uploadHistoryId = historyRecord.id;

        await new Promise((resolve, reject) => {
            fs.createReadStream(req.file.path) // Use req.file.path directly
                .pipe(csv({ skipEmptyLines: true }))
                .on('data', (row) => {
                    const cleanRow = {};
                    Object.keys(row).forEach(key => {
                        const cleanKey = key.trim().toLowerCase();
                        cleanRow[cleanKey] = row[key] ? row[key].trim() : '';
                    });
                    
                    const rawPhone = cleanRow.phone;
                    const sanitizedPhone = sanitizePhoneNumber(rawPhone);

                    if (sanitizedPhone) {
                        contacts.push({
                            name: cleanRow.name || '',
                            phone: sanitizedPhone,
                            email: cleanRow.email || '',
                            company: cleanRow.company || '',
                            userId: req.session.userId,
                            uploadHistoryId: uploadHistoryId,
                            is_deleted: false // <-- Set is_deleted to false for all uploaded contacts
                        });
                    } else {
                        console.log(`Row skipped - invalid phone number found: ${rawPhone}`);
                        errorCount++;
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });

        if (contacts.length === 0) {
            await historyRecord.update({ status: 'Failed' });
            return res.status(400).json({ 
                error: 'No valid contacts found. Please ensure your CSV has a "phone" column with valid numbers.' 
            });
        }

        // The updateOnDuplicate array now includes is_deleted
        await Contact.bulkCreate(contacts, {
            updateOnDuplicate: ["name", "email", "company", "is_deleted"] // <-- THE FIX
        });

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
        if (historyRecord) {
            await historyRecord.update({ status: 'Failed' }).catch(e => console.error("Failed to update history on error:", e));
        }
        res.status(500).json({ error: 'Failed to process file' });
    } finally {
        await fsPromises.unlink(filePath);
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


module.exports = router;
