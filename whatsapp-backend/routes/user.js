const express = require('express');
const router = express.Router();
const argon2 = require('argon2');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const { UserID } = require('../models');
const dotenv = require('dotenv');

// Load environment variablFVes
dotenv.config();

// 1. Configure Cloudinary
// (Make sure to set these in your .env file)
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

// 2. Configure Multer to use memory storage
const upload = multer({ storage: multer.memoryStorage() });

// 3. Define the upload function that wraps the Cloudinary stream upload
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    // Create an upload stream to Cloudinary
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        // Define transformations for the profile photo
        // This will create a 500x500 square image, focusing on the face, and optimizing quality.
        transformation: [
          { width: 500, height: 500, gravity: "face", crop: "fill" },
          { quality: "auto", fetch_format: "auto" }
        ],
        folder: "profile_photos" // Optional: store in a specific folder
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    // Pipe the file buffer into the upload stream
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};


// 4. Define the Express route
router.post('/profile-photo', upload.single('profilePhoto'), async (req, res) => {
  try {
    // Check if a file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    // Upload the file buffer to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer);

    // Extract the secure URL of the uploaded image
    const photoUrl = uploadResult.secure_url;

    // Update the user's record in your database with the new URL
    // // (Assuming you have user ID from an authenticated session)
    const userId = req.session.userId; 
    await UserID.update({ profile_photo_url: photoUrl }, { where: { userId: userId } });
    
    // Send a success response
    res.status(200).json({ 
      message: "Profile photo updated successfully.", 
      photoUrl: photoUrl 
    });

  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    res.status(500).json({ message: "Failed to upload photo." });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Input validation
        if (!email || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        // Find user in database
        const user = await UserID.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Verify password using argon2
;
        const isValidPassword = await argon2.verify(user.hashed_password, password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // === Login Successful ===
        req.session.visited = true;
        req.session.userId = user.userId;
        req.session.email = user.email;

        // Send success response
        res.status(200).json({
            message: 'Login successful',
            user: {
                id: user.userId,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.status(200).json({ message: 'Logout successful' });
});

router.put('/profile', async (req, res) => {
    try {
        const { profile } = req.body;
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: Please log in.' });
        }

        // Update user profile in database
        const user = await UserID.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        user.name = profile.name;
        user.email = profile.email;
        user.phone_number = profile.phone_number;
        user.company = profile.company;
        user.business_hours = JSON.stringify(profile.business_hours);
        user.notification_settings = JSON.stringify(profile.notification_settings);
        await user.save();

        // Send success response
        res.status(200).json({ message: 'Profile updated successfully.' });

    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
async function authMiddleware(req, res, next) {

    if (!req.session || !req.session.userId) {
        console.log('bruh');
        // No session or no userId in session, meaning user is NOT authenticated
        return res.status(401).json({ message: 'Unauthorized: Please log in.' });
    }

    try {
        const user = await UserID.findByPk(req.session.userId);

        if (!user) {
            // User associated with session no longer exists in DB - destroy session
            req.session.destroy();
            return res.status(401).json({ message: 'Unauthorized: Please log in.' });
        }

        req.user = user.toJSON();
        next(); // User is authenticated, proceed to the next middleware/route handler

    } catch (error) {
        console.error("Error in authMiddleware during user lookup:", error);
        return res.status(500).json({ message: 'Internal server error during authentication.' });
    }
}

router.get('/check-auth', authMiddleware, (req, res) => {
    // If we reach this line, authMiddleware has already verified the user.
    // req.user now holds the user data attached by the middleware.
    
    res.status(200).json({
        isLoggedIn: true,
        profile: {
            id: req.user.userId,
            email: req.user.email,
            phone_number: req.user.phone_number,
            name: req.user.name,
            profile_picture: req.user.profile_picture,
            company: req.user.company,
            business_hours: JSON.parse(req.user.business_hours),
            notification_settings: JSON.parse(req.user.notification_settings),
            profile_photo_url: req.user.profile_photo_url
        }
    });
});

module.exports = router;