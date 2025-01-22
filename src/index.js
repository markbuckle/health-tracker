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
// const EventEmitter = require('events'); // for the processing files modal
// const processEmitter = new EventEmitter(); // for the processing files modal
const WebSocket = require('ws');
const { biomarkerData } = require('./data/biomarkerData');
const { calculateRangePositions } = require('../public/js/rangeCalculations');

// express app setup
const app = express();

app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        // Note: unsafe-eval is required for Plotly
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' cdnjs.cloudflare.com d3e54v103j8qbb.cloudfront.net cdn.jsdelivr.net cdn.plot.ly www.gstatic.com apis.google.com; " +
        "style-src 'self' 'unsafe-inline' fonts.googleapis.com cdn.jsdelivr.net cdn.plot.ly; " +
        "img-src 'self' data: blob: *; " +
        "font-src 'self' data: fonts.gstatic.com; " +
        "connect-src 'self' ws: wss: localhost:* cdn.jsdelivr.net; " +
        "object-src 'none'; " +
        "media-src 'self'; " +
        "frame-src 'self'; " +
        "worker-src 'self' blob:; " +
        "base-uri 'self'; " +
        "form-action 'self'"
    );

    res.removeHeader('X-Content-Security-Policy');
    next();
});

// Then create server with app
const server = require('http').createServer(app);

// Then create WebSocket server
const wss = new WebSocket.Server({ server });

// Store WebSocket connections
const connections = new Set();

// WebSocket connection handler
wss.on('connection', (ws) => {
    connections.add(ws);

    ws.on('close', () => {
        connections.delete(ws);
    });
});

// Override console.log to broadcast to WebSocket clients
const originalLog = console.log;
console.log = function () {
    originalLog.apply(console, arguments);
    const message = Array.from(arguments).join(' ');

    connections.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
};

const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Register Handlebars helpers 
hbs.registerHelper('ifEqual', function (arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});
hbs.registerHelper('formatDate', function (date) {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
});
hbs.registerHelper('eq', function (a, b) {
    return a === b;
});

hbs.registerHelper('getLast', function (array) {
    return array[array.length - 1];
});

hbs.registerHelper('json', function (context) {
    return JSON.stringify(context);
});

hbs.registerHelper('isCurrentFile', function (labResultFilename, currentFiles) {
    // Extract just the filename without path for comparison
    const baseName = path.basename(labResultFilename);
    return currentFiles.some(file => file.originalName === baseName);
});

hbs.registerHelper('lt', function (a, b) {
    return a < b;
});

hbs.registerHelper('gt', function (a, b) {
    return a > b;
});

hbs.registerHelper('eq', function (a, b) {
    return a === b;
});

hbs.registerHelper('multiply', function (a, b) {
    return a * b;
});

hbs.registerHelper('formatNumber', function (number, decimals = 2) {
    return Number(number).toFixed(decimals);
});

hbs.registerHelper('confidenceClass', function (level) {
    switch (level) {
        case 'high': return 'high-confidence';
        case 'medium': return 'medium-confidence';
        case 'low': return 'low-confidence';
        default: return '';
    }
});

hbs.registerHelper('inline', function (options) {
    return '';  // Ignore the content
});

hbs.registerHelper('json', function (context) {
    return JSON.stringify(context);
});

hbs.registerHelper('formatDateString', function (dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString();
});

// grab reference ranges for bar charts
hbs.registerHelper('parseReferenceRange', function(range) {
    if (!range) return null;
    
    // Parse reference range string (assuming format like "0.40-1.05")
    const matches = range.match(/(\d*\.?\d+)-(\d*\.?\d+)/);
    if (!matches) return null;
    
    return {
        min: parseFloat(matches[1]),
        max: parseFloat(matches[2])
    };
});

// bar chart marker position
hbs.registerHelper('calculateMarkerPosition', function(value, range) {
    if (!value || !range) return 126; // Default position
    
    const rangeObj = typeof range === 'string' ? 
        this.parseReferenceRange(range) : range;
    
    if (!rangeObj) return 126;
    
    // Calculate position (assuming SVG width of 420)
    const totalWidth = 420;
    const usableWidth = 388; // Adjusting for margins
    const startX = 2; // Left margin
    
    const position = startX + (usableWidth * (value - rangeObj.min) / (rangeObj.max - rangeObj.min));
    return Math.min(Math.max(position, startX), totalWidth - startX);
});

// biomarkerData helpers

hbs.registerHelper('getBiomarkerDescription', function(biomarker) {
    return biomarkerData[biomarker]?.description || 'Definition not available';
});

hbs.registerHelper('getBiomarkerUnit', function(biomarker) {
    return biomarkerData[biomarker]?.unit || 'Unit not available';
});

hbs.registerHelper('getBiomarkerRange', function(biomarker, rangeType) {
    return biomarkerData[biomarker]?.referenceRanges?.[rangeType] || 'Range not available';
});

hbs.registerHelper('toLowerCase', function(str) {
    return str.toLowerCase();
});

// next 4 helper functions are for the calculateRangePositions function
hbs.registerHelper('calculateRangeScaling', function(min, max) {
    return calculateRangePositions(min, max);
});

hbs.registerHelper('add', function(a, b) {
    return a + b;
});

hbs.registerHelper('subtract', function(a, b) {
    return a - b;
});

hbs.registerHelper('multiply', function(a, b) {
    return a * b;
});

hbs.registerHelper('calculateRangeScaling', function(min, max) {
    return calculateRangePositions(parseFloat(min), parseFloat(max));
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

        console.log('User data for upload page:', {
            files: user.files?.map(f => ({
                id: f._id,
                name: f.originalName,
                hasLabValues: !!f.labValues,
                labValueCount: f.labValues ? Object.keys(f.labValues).length : 0
            }))
        });

        const labResults = user.labResults || [];

        res.render('user/upload', {
            naming: user.uname,
            user: user,
            labResults: labResults
        });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).send('Error loading upload page');
    }
});

app.get('/reports', checkAuth, async (req, res) => {
    try {
        const user = await registerCollection.findById(req.user._id).lean();
        
        // Get all lab values with their dates
        const labData = user.files
            .filter(f => f.labValues && Object.keys(f.labValues).length > 0)
            .sort((a, b) => new Date(b.testDate) - new Date(a.testDate));

        // Get the most recent file for backward compatibility
        const recentFile = labData[0];

        // Get unique biomarkers
        const biomarkers = new Set();
        labData.forEach(file => {
            Object.keys(file.labValues).forEach(marker => biomarkers.add(marker));
        });

        res.render('user/reports', { 
            naming: req.user.uname,
            user: user,
            recentLabValues: recentFile?.labValues || {}, // Add this back
            initialData: `<script>window.__INITIAL_DATA__ = ${JSON.stringify({
                files: user.files,
                biomarkers: Array.from(biomarkers)
            })};</script>`
        });
    } catch (error) {
        console.error('Error fetching reports data:', error);
        res.status(500).send('Error loading reports page');
    }
});

app.get('/insights', checkAuth, (req, res) => {
    res.render('user/insights', { naming: req.user.uname });
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
        const { fname, lname, birthDate, sex, bloodType, customBloodType, familyCondition, relatives, addNotes, habitType, status, lifestyleNotes, entryId, action } = req.body;

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
        if (!fs.existsSync(uploadDir)) {
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

const { extractFromPDF, extractFromImage } = require('./utils/labParser');

app.post('/upload-files', checkAuth, upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files were uploaded.'
            });
        }

        const user = await registerCollection.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const uploadedFiles = [];
        const totalFiles = req.files.length;

        for (let fileIndex = 0; fileIndex < req.files.length; fileIndex++) {
            console.log(`Processing file ${fileIndex + 1} of ${totalFiles}`);

            const file = req.files[fileIndex];
            try {
                // Extract lab values and date in a single call
                const extractedData = await extractFromPDF(file.path);
                console.log('Extracted data:', {
                    numLabValues: Object.keys(extractedData).length,
                    testDate: extractedData.testDate,
                    sampleLabValues: Object.keys(extractedData).slice(0, 3)
                });

                const fileObject = {
                    filename: file.filename,
                    originalName: file.originalname,
                    path: file.path,
                    size: file.size,
                    mimetype: file.mimetype,
                    uploadDate: new Date(),
                    testDate: extractedData.testDate ? new Date(extractedData.testDate) : null,
                    labValues: extractedData.labValues || {},
                    extractionMethod: 'tesseract',
                    processingErrors: []
                };

                console.log('Final file object:', {
                    filename: fileObject.filename,
                    hasLabValues: !!fileObject.labValues,
                    labValueCount: Object.keys(fileObject.labValues || {}).length,
                    testDate: fileObject.testDate
                });

                uploadedFiles.push(fileObject);
            } catch (error) {
                console.error(`Error processing file ${file.originalname}:`, error);
                uploadedFiles.push({
                    filename: file.filename,
                    originalName: file.originalname,
                    path: file.path,
                    size: file.size,
                    mimetype: file.mimetype,
                    uploadDate: new Date(),
                    testDate: null,
                    labValues: {},
                    extractionMethod: 'failed',
                    processingErrors: [error.message]
                });
            }
        }

        if (!user.files) {
            user.files = [];
        }

        user.files.push(...uploadedFiles);
        console.log('Saving files count:', uploadedFiles.length);

        await user.save();
        console.log('Files saved successfully');

        res.json({
            success: true,
            message: 'Files uploaded and processed successfully',
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
        const fileToDelete = user.files.id(fileId);
        if (!fileToDelete) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        // Delete the physical file
        const filePath = path.join(__dirname, '../public/uploads', fileToDelete.filename);
        fs.unlink(filePath, (err) => {
            if (err && err.code !== 'ENOENT') {
                console.error('Error deleting file:', err);
            }
        });

        // Remove file from user's files array
        user.files.pull(fileId);

        // Remove corresponding lab results
        if (user.labResults) {
            user.labResults = user.labResults.filter(result =>
                result.filename !== fileToDelete.originalName
            );
        }

        await user.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/update-biomarker', checkAuth, async (req, res) => {
    try {
        const { fileId, biomarkerName, value, unit, referenceRange } = req.body;
        console.log('Update biomarker request:', { fileId, biomarkerName, value, unit, referenceRange });

        const user = await registerCollection.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const file = user.files.id(fileId);
        if (!file) {
            console.log('File not found with ID:', fileId);
            console.log('Available files:', user.files.map(f => f._id));
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        // Initialize labValues if it doesn't exist
        if (!file.labValues) {
            file.labValues = new Map();
            // file.labValues = {};
        }

        // Update the biomarker using MongoDB's dot notation for nested updates
        const updateQuery = {
            $set: {
                [`files.$.labValues.${biomarkerName}`]: {
                    value: parseFloat(value),
                    unit: unit,
                    referenceRange: referenceRange,
                    confidence: 1,
                    confidenceLevel: 'high'
                }
            }
        };

        const result = await registerCollection.findOneAndUpdate(
            {
                _id: user._id,
                'files._id': fileId
            },
            updateQuery,
            {
                new: true,
                runValidators: true
            }
        );

        if (!result) {
            throw new Error('Failed to update document');
        }

        console.log('Biomarker updated successfully');

        res.json({
            success: true,
            message: 'Biomarker updated successfully'
        });

    } catch (error) {
        console.error('Error updating biomarker:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.post('/delete-biomarker', checkAuth, async (req, res) => {
    try {
        const { fileId, biomarkerName } = req.body;
        console.log('Delete biomarker request:', { fileId, biomarkerName });

        const user = await registerCollection.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const file = user.files.id(fileId);
        if (!file) {
            console.log('File not found with ID:', fileId);
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        // Delete the biomarker using MongoDB's unset operator
        const updateQuery = {
            $unset: {
                [`files.$.labValues.${biomarkerName}`]: 1
            }
        };

        const result = await registerCollection.findOneAndUpdate(
            {
                _id: user._id,
                'files._id': fileId
            },
            updateQuery,
            {
                new: true,
                runValidators: true
            }
        );

        if (!result) {
            throw new Error('Failed to update document');
        }

        console.log('Biomarker deleted successfully');

        res.json({
            success: true,
            message: 'Biomarker deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting biomarker:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.post('/update-file-details', checkAuth, async (req, res) => {
    try {
        const { fileId, fileName, uploadDate, testDate } = req.body;
        console.log('Update file details request:', { fileId, fileName, uploadDate, testDate });

        const user = await registerCollection.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const file = user.files.id(fileId);
        if (!file) {
            console.log('File not found with ID:', fileId);
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        // Update file details
        file.originalName = fileName;
        file.uploadDate = new Date(uploadDate);
        file.testDate = new Date(testDate);

        await user.save();
        console.log('File details updated successfully');

        res.json({
            success: true,
            message: 'File details updated successfully'
        });

    } catch (error) {
        console.error('Error updating file details:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Change from app.listen to server.listen at the end of the file
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// app.listen(port, () => {
//     console.log(`Server is running on port ${port}`);
// });