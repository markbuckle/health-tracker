const express = require("express");
const path = require("path");
const hbs = require("hbs");
const mongoose = require("mongoose");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const { registerCollection } = require("./mongodb");
const MongoStore = require('connect-mongo');
const templatePath = path.join(__dirname, '../templates');
const publicPath = path.join(__dirname, '../public');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();
const port = process.env.PORT || 3000;

// express app setup
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Register Handlebars helpers 
hbs.registerHelper('ifEqual', function(arg1, arg2, options) { 
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});
hbs.registerHelper('formatDate', function(date) { 
    if (!date) return ''; 
    return new Date(date).toISOString().split('T')[0]; 
}); 
hbs.registerHelper('eq', function(a, b) { 
    return a === b;
});

hbs.registerHelper('getLast', function(array) { 
    return array[array.length - 1];
});

hbs.registerHelper('json', function(context) { 
    return JSON.stringify(context); 
});

app.set("view engine", 'hbs');
app.set("views", templatePath);

// Partial paths
const partialsPath = path.join(__dirname, '../templates/partials');
hbs.registerPartials(partialsPath)

// Add error handling for static files
app.use(express.static(publicPath));

// Session setup - MUST come before passport middleware
if (!process.env.SESSION_SECRET) {
    console.error('SESSION_SECRET is not set in environment variables');
    process.exit(1);
}
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.DB_STRING,
        ttl: 24 * 60 * 60, // 24 hours
    }),
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        sameSite: 'lax',
        // secure: process.env.NODE_ENV === 'production'
    },
}));

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({
    usernameField: 'uname',  // specify the field names from your form
    passwordField: 'password'
},
async (username, password, done) => {
    try {
        const user = await registerCollection.findOne({ uname: username });
        if (!user) {
            return done(null, false, { message: 'User not found' });
        }
        // In production, use proper password hashing comparison
        if (user.password !== password) {
            return done(null, false, { message: 'Incorrect password' });
        }
        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user._id); // Use _id for MongoDB
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await registerCollection.findById(id);
        done(null, user);
    } catch (error) {
        done(error);
    }
});

// Authentication middleware
function checkAuth(req, res, next) {
    if (req.isAuthenticated()) { // or use your own custom authentication check
        return next();
    } else {
        res.redirect('/login');
    }
}

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/register', (req, res) => {
    res.render('auth/register');
});

app.get('/login', (req, res) => {
    res.render('auth/login');
});

app.get('/how-it-works', (req, res) => {
    res.render('how-it-works');
});

app.get('/demo', (req, res) => {
    res.render('demo');
});

app.get('/', (req, res) => {
     res.render('main');
});

app.get('/profile', checkAuth, (req, res) => {
    res.render('user/profile', { 
        fname: req.user.fname, 
        lname: req.user.lname,
        uname: req.user.uname,
        user: req.user, // passes the entire user object
        profile: req.user.profile || {}, 
        bloodType: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown', 'Other'],
    });
});

app.get('/upload', checkAuth, async (req, res) => {
    try {
        // Fetch the uploaded user document with files
        const user = await registerCollection.findById(req.user._id).lean();
        
        // console.log('User files:', user.files); // Add this for debugging
        
        res.render('user/upload', { 
            naming: user.uname,
            user: user // Make sure you're passing the entire user object
        });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).send('Error loading upload page');
    }
});

app.get('/reports', checkAuth, (req, res) => {
    res.render('user/reports', { naming: req.user.uname });
});

app.get('/dashboard', checkAuth, (req, res) => {
    res.render('user/dashboard', { naming: req.user.uname });
});

// Authentication logic
app.post('/register', async (req, res) => {
    const data = {
        fname: req.body.fname,
        lname: req.body.lname,
        email: req.body.email,
        uname: req.body.uname,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword
    };

    try {
        const existingUser = await registerCollection.findOne({ uname: req.body.uname });

        if (existingUser) {
            return res.status(400).send("Username already exists");
        }

        if (req.body.password !== req.body.confirmPassword) {
            return res.status(400).send("Passwords do not match");
        }

        const newUser = new registerCollection(data);
        await newUser.save();

        res.status(201).render("auth/login", {
            naming: req.body.uname
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred during registration");
    }
});

// Login logic
app.post('/login', (req, res, next) => {
    console.log('Login attempt received for username:', req.body.uname); // Debug log
    
    passport.authenticate('local', {
        successRedirect: '/profile',
        failureRedirect: '/login',
        failureFlash: false
    })(req, res, next);
});

app.post('/update-profile', checkAuth, async (req, res) => {
    try {
        const { fname, lname, birthDate, sex, bloodType, customBloodType, familyCondition, relatives, addNotes, habitType, status, lifestyleNotes, entryId, action} = req.body;

        // Log request body for debugging 
        console.log('Request Body:', req.body);

        // Find the user and update profile
        const user = await registerCollection.findById(req.user._id);
        
        if (!user) {
            console.log('User not found');
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        // Ensure profile is initialized 
        if (!user.profile) { 
            user.profile = {}; 
        }

        // Check if values are provided, if not, update with the specified value 
        // this approach preserves existing values
        if (fname) user.profile.fname = fname;
        if (lname) user.profile.lname = lname;
        if (birthDate) user.profile.birthDate = birthDate;
        if (sex) user.profile.sex = sex;
        
        if (bloodType) {
            if (bloodType === 'Other') { 
                user.profile.bloodType = 'Other'; 
                user.profile.customBloodType = customBloodType; 
            } else { 
                user.profile.bloodType = bloodType; 
                user.profile.customBloodType = null; 
            }
        }
        // Ensure familyHistory is initialized 
        if (!Array.isArray(user.profile.familyHistory)) { 
            user.profile.familyHistory = []; 
        }

        // Handle family history updates
        if (action) {
            switch (action) {
                case 'add':
                    if (familyCondition && relatives) {
                        user.profile.familyHistory.push({
                            familyCondition,
                            relatives: relatives.split(','),
                            addNotes: addNotes || ''
                        });
                    }
                    break;

                case 'edit':
                    if (entryId && familyCondition && relatives) {
                        const entryIndex = user.profile.familyHistory.findIndex(
                            entry => entry._id.toString() === entryId
                        );
                        if (entryIndex !== -1) {
                            user.profile.familyHistory[entryIndex].familyCondition = familyCondition;
                            user.profile.familyHistory[entryIndex].relatives = relatives.split(',');
                            user.profile.familyHistory[entryIndex].addNotes = addNotes || '';
                        }
                    }
                    break;

                case 'delete':
                    if (entryId) {
                        try {
                            console.log('Attempting to delete entry with ID:', entryId);
                            
                            // Find the most recent version of the user
                            const targetUser = await registerCollection.findById(user._id);
                            if (!targetUser) {
                                throw new Error('User not found');
                            }

                            console.log('Family history before:', targetUser.profile.familyHistory);

                            // Remove the family history entry
                            targetUser.profile.familyHistory = targetUser.profile.familyHistory.filter(
                                entry => entry._id.toString() !== entryId
                            );

                            // Use findOneAndUpdate instead of save to avoid version conflicts
                            const updatedUser = await registerCollection.findOneAndUpdate(
                                { _id: user._id },
                                { $set: { 'profile.familyHistory': targetUser.profile.familyHistory } },
                                { new: true } // This option returns the updated document
                            );

                            if (!updatedUser) {
                                throw new Error('Failed to update user');
                            }

                            // Update the local user object to match
                            user.profile.familyHistory = updatedUser.profile.familyHistory;

                            console.log('Delete operation completed');
                            console.log('Family history after:', updatedUser.profile.familyHistory);

                            // No need to call save() again
                        } catch (error) {
                            console.error('Error deleting entry:', error);
                            throw new Error('Failed to delete family history entry: ' + error.message);
                        }
                    }
                    break;
                }
            }
            // Ensure familyHistory is initialized 
            if (!Array.isArray(user.profile.lifestyle)) { 
                user.profile.lifestyle = []; 
            }
             // Handle lifestyle updates
            if (action) {
                switch (action) {
                    case 'add':
                        if (habitType && status) {
                            user.profile.lifestyle.push({
                                habitType,
                                status: status,
                                lifestyleNotes: lifestyleNotes || ''
                            });
                        }
                        break;

                    case 'edit':
                        if (entryId && habitType && status) {
                            const entryIndex = user.profile.lifestyle.findIndex(
                                entry => entry._id.toString() === entryId
                            );
                            if (entryIndex !== -1) {
                                user.profile.lifestyle[entryIndex].habitType = habitType;
                                user.profile.lifestyle[entryIndex].status = status; 
                                user.profile.lifestyle[entryIndex].lifestyleNotes = lifestyleNotes || '';
                            }
                        }
                        break;

                    case 'delete':
                        if (entryId) {
                            try {
                                console.log('Attempting to delete entry with ID:', entryId);
                                
                                // Find the most recent version of the user
                                const targetUser = await registerCollection.findById(user._id);
                                if (!targetUser) {
                                    throw new Error('User not found');
                                }

                                console.log('Lifestyle before:', targetUser.profile.lifestyle);

                                // Remove the family history entry
                                targetUser.profile.lifestyle = targetUser.profile.lifestyle.filter(
                                    entry => entry._id.toString() !== entryId
                                );

                                // Use findOneAndUpdate instead of save to avoid version conflicts
                                const updatedUser = await registerCollection.findOneAndUpdate(
                                    { _id: user._id },
                                    { $set: { 'profile.lifestyle': targetUser.profile.lifestyle } },
                                    { new: true } // This option returns the updated document
                                );

                                if (!updatedUser) {
                                    throw new Error('Failed to update user');
                                }

                                // Update the local user object to match
                                user.profile.lifestyle = updatedUser.profile.lifestyle;

                                console.log('Delete operation completed');
                                console.log('Lifestyle after:', updatedUser.profile.lifestyle);

                                // No need to call save() again
                            } catch (error) {
                                console.error('Error deleting entry:', error);
                                throw new Error('Failed to delete lifestyle entry: ' + error.message);
                            }
                        }
                        break;
                    }
                }
        // Calculate and set age
        user.profile.age = user.calculateAge();

        // Save the updated user
        await user.save();

        res.json({
            success: true,
            age: user.profile.age,
            bloodType: user.profile.bloodType,
            customBloodType: user.profile.customBloodType,
            sex: user.profile.sex,
            familyHistory: user.profile.familyHistory,
            lifestyle: user.profile.lifestyle
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating profile',
            error: error.message
        });
    }
});

// Configure MULTER for file upload 
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Create uploads directory if it doesn't exist
        const uploadDir = path.join(__dirname, '../public/uploads');
        if (!fs.existsSync(uploadDir)){
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create unique filename with original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter to only allow PDFs and images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, JPEG, and PNG files are allowed.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 200 * 1024 * 1024 // 200MB limit
    }
});

app.post('/upload-files', checkAuth, upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No files were uploaded.' 
            });
        }

        // Get the user
        const user = await registerCollection.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Process each uploaded file
        const uploadedFiles = req.files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype,
            uploadDate: new Date()
        }));

        // Add files to user's document storage
        // You'll need to add a files field to your user schema in mongodb.js
        if (!user.files) {
            user.files = [];
        }
        user.files.push(...uploadedFiles);

        await user.save();

        res.json({
            success: true,
            message: 'Files uploaded successfully',
            files: uploadedFiles
        });

    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error processing files',
            error: error.message 
        });
    }
});

// Error handler for multer errors
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File is too large. Maximum size is 200MB.'
            });
        }
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
    next(error);
});

app.post('/delete-file', checkAuth, async (req, res) => {
    try {
      const { fileId } = req.body;
      const user = await registerCollection.findById(req.user._id);
      
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
  
      // Find the file to get its filename
      const file = user.files.id(fileId);
      if (!file) {
        return res.status(404).json({ success: false, message: 'File not found' });
      }
  
      // Delete the physical file
      const filePath = path.join(__dirname, '../public/uploads', file.filename);
      fs.unlink(filePath, (err) => {
        if (err && err.code !== 'ENOENT') {
          console.error('Error deleting file:', err);
        }
      });
  
      // Remove file from user's files array
      user.files.pull(fileId);
      await user.save();
  
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});