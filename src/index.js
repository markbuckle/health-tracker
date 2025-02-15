// index.js

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
const { calculateRangePositions } = require('../public/js/rangeCalculations');
const { biomarkerData, markerCategories } = require('./data/biomarkerData');

// express app setup
const app = express();

if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-eval' 'unsafe-inline' 'unsafe-hashes' cdnjs.cloudflare.com d3e54v103j8qbb.cloudfront.net cdn.jsdelivr.net cdn.plot.ly www.gstatic.com apis.google.com; " +
            "style-src 'self' 'unsafe-inline' fonts.googleapis.com cdn.jsdelivr.net cdn.plot.ly; " +
            "img-src 'self' data: blob: *; " +
            "font-src 'self' data: fonts.gstatic.com; " +
            "connect-src 'self' ws: wss: localhost:* cdn.jsdelivr.net cdn.plot.ly; " +
            "child-src 'self' blob:; " +
            "worker-src 'self' blob:; " +
            "object-src 'none'; " +
            "media-src 'self'; " +
            "frame-src 'self'; " +
            "base-uri 'self'; " +
            "form-action 'self'"
        );
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('X-XSS-Protection', '1; mode=block');

        res.removeHeader('X-Powered-By');
        res.removeHeader('X-Content-Security-Policy');
        res.removeHeader('X-WebKit-CSP');
        next();
    });
}

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

// hbs.registerHelper('eq', function(a, b) {
//     a === b;
// });

hbs.registerHelper('eq', function(a, b) {
    if (!a || !b) return false;
    return String(a).toLowerCase() === String(b).toLowerCase();
  });

// Add a debug helper
hbs.registerHelper('log', function(something) {
    console.log(something);
    return '';
  });

hbs.registerHelper('isCategoryEmpty', function(labValues, categoryKey) {
    if (!labValues) return true;
    return !Object.values(labValues).some(value => value.category === categoryKey);
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
// hbs.registerHelper('parseReferenceRange', function(range) {

//     if (!range) {
//         return null;
//     }

//     // Remove all spaces and handle both hyphen types
//     const cleanRange = range.toString().replace(/\s+/g, '').replace('–', '-');
    
//     // Parse reference range string (assuming format like "0.40-1.05")
//     const matches = cleanRange.match(/^(\d+\.?\d*)-(\d+\.?\d*)$/);

//     // if (!matches) {
//     //     console.warn('Could not parse reference range:', range);
//     //     return null;
//     // }
    
//     const result = {
//         min: parseFloat(matches[1]),
//         max: parseFloat(matches[2])
//       };
      
//     return result;
// });

hbs.registerHelper('parseReferenceRange', function(range) {
    if (!range) {
        return null;
    }
    // Remove all spaces and handle both hyphen types
    const cleanRange = range.toString().replace(/\s+/g, '').replace('–', '-');
    const matches = cleanRange.match(/^(\d+\.?\d*)-(\d+\.?\d*)$/);
    
    const result = {
        min: parseFloat(matches[1]),
        max: parseFloat(matches[2])
    };
    return result;
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

hbs.registerHelper('json', function(context) {
    return JSON.stringify(context);
});

hbs.registerHelper('lookup', function(obj, key1, key2) {
    if (!obj || !key1) return null;
    const value = obj[key1];
    if (!value) return null;
    return key2 ? value[key2] : value;
});

hbs.registerHelper('isInCategory', function(biomarker, categoryId) {
    if (!biomarker) return false;
    return biomarker.category === categoryId;
});

hbs.registerHelper('log', function() {
    let args = Array.prototype.slice.call(arguments, 0, -1);
    console.log.apply(console, args);
});

// next 4 helper functions are for the calculateRangePositions function

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

hbs.registerHelper('concat', function(...args) {
    // Remove the last argument (Handlebars options object)
    args.pop();
    // Join all arguments into a single string
    return args.join('');
});

hbs.registerHelper('getBiomarkersForCategory', function(biomarkerData, categoryName) {
    return Object.values(biomarkerData).filter(biomarker => 
      biomarker.category.toLowerCase() === categoryName.toLowerCase() && 
      biomarker.value !== null
    );
});

hbs.registerHelper('hasBiomarkersInCategory', function(biomarkerData, categoryName) {
    return Object.values(biomarkerData).some(biomarker => 
      biomarker.category === categoryName && 
      biomarker.value !== null
    );
});

hbs.registerHelper('hasBiomarkersInFrequency', function(biomarkerData, frequency) {
    return Object.values(biomarkerData).some(marker => 
        marker.frequency === frequency && 
        marker.value !== null
    );
});

hbs.registerHelper('replace', function(str, pattern, replacement) {
    return str.replace(new RegExp(pattern, 'g'), replacement);
});

hbs.registerHelper('getUniqueFrequencies', function(biomarkerData) {
    const frequencies = new Set();
    Object.values(biomarkerData).forEach(marker => {
        if (marker && marker.frequency) {
            frequencies.add(marker.frequency);
        }
    });
    return Array.from(frequencies);
});

hbs.registerHelper('and', function() {
    // Convert arguments to Array and remove the last item (Handlebars options object)
    const args = Array.prototype.slice.call(arguments, 0, -1);
    return args.every(Boolean);
});

// hbs.registerHelper('debug', function(optionalValue) {
//     console.log('Context:', this);
//     if (optionalValue) {
//       console.log('Value:', optionalValue);
//     }
//     return '';
// });

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

        res.render('user/upload', {
            naming: user.uname,
            user: user,
        });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).send('Error loading upload page');
    }
});

app.get('/reports', checkAuth, async (req, res) => {
    try {
      // Get the user's latest lab results
      const user = await registerCollection.findById(req.user._id);

      // Get all files with lab values and sort by test date
      const filesWithLabValues = user.files
       .filter(file => file.labValues && Object.entries(file.labValues).length > 0)
       .sort((a, b) => new Date(b.testDate) - new Date(a.testDate));

      // Track all values for each biomarker
      const biomarkerHistory = {};

      // Helper function to find biomarker by any of its names
      function findBiomarkerMatch(testName) {
            return Object.entries(biomarkerData).find(([key, data]) => {
            const possibleNames = [key, ...(data.alternateNames || [])];
            return possibleNames.some(name => 
                name.toLowerCase() === testName.toLowerCase()
            );
            });
      }
      
      // When processing lab values
      filesWithLabValues.forEach(file => {
        Array.from(file.labValues.entries()).forEach(([labTestName, value]) => {
          const biomarkerMatch = findBiomarkerMatch(labTestName);
          if (biomarkerMatch) {
            const [standardName, biomarkerInfo] = biomarkerMatch;
            
            if (!biomarkerHistory[standardName]) {
              biomarkerHistory[standardName] = [];
            }
  
            biomarkerHistory[standardName].push({
              value: value.value,
              unit: value.unit,
              referenceRange: value.referenceRange,
              testDate: file.testDate,
              filename: file.originalName
            });
          }
        });
      });
      
      // Get list of all biomarkers
      const biomarkers = Object.keys(biomarkerHistory);

      // Merge static biomarker data with lab values
      const enrichedBiomarkerData = {};
      
      for (const [biomarkerName, biomarkerInfo] of Object.entries(biomarkerData)) {
        // Access lab value directly from the converted object
        const allValues = biomarkerHistory[biomarkerName] || [];
        // Sort by date to get the most recent value
        const sortedValues = allValues.sort((a, b) => 
            new Date(b.testDate) - new Date(a.testDate)
          );
        const mostRecent = sortedValues[0];

        enrichedBiomarkerData[biomarkerName] = {
            ...biomarkerInfo,
            value: mostRecent?.value || null,
            unit: mostRecent?.unit || null,
            referenceRange: mostRecent?.referenceRange || null,
            history: sortedValues
            };
        }

        // Create initialData script with sanitized file data
        const filesForClient = filesWithLabValues.map(file => ({
            testDate: file.testDate,
            labValues: Object.fromEntries(file.labValues)
        }));

        const util = require('util');

        res.render('user/reports', {
            markerCategories: Object.values(markerCategories),
            biomarkerData: enrichedBiomarkerData,
            initialData: `<script>window.__INITIAL_DATA__ = ${JSON.stringify({
                files: user.files,
                biomarkers: Object.keys(biomarkerData),
                biomarkerInfo: biomarkerData
            })};</script>`
        });
    } catch (error) {
      console.error('Error in /reports route:', error);
      res.status(500).send('Error generating report');
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
        const { fname, lname, birthDate, sex, bloodType, customBloodType, familyCondition, relatives, addNotes, weight, bloodPressure, restingHeartRate, sleep, monitoringNotes, habitType, status, lifestyleNotes, medicine, supplement, entryId, medsAndSupsNotes, action } = req.body;

        // Log request body for debugging 
        console.log('Received update request:', {
            body: req.body,
            action: req.body.action,
            entryId: req.body.entryId,
            type: req.body.type
        });

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

        // Handle add, edit and delete actions
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
                    if (weight && bloodPressure) {
                        user.profile.monitoring.push({
                            weight,
                            bloodPressure,
                            restingHeartRate,
                            sleep,
                            monitoringNotes: monitoringNotes || ''
                        });
                    }
                    if (medicine || supplement) {
                        user.profile.medsandsups.push({
                            medicine,
                            supplement,
                            medsAndSupsNotes: medsAndSupsNotes || ''
                        });
                    }
                    break;

                case 'edit':
                    // Existing family history edit case
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
                    console.log('Processing edit action');
                    // Add monitoring edit case
                    if (entryId && weight && bloodPressure) {
                        console.log('Attempting to edit monitoring entry:', entryId);
                        const monitoringIndex = user.profile.monitoring.findIndex(
                            entry => entry._id.toString() === entryId
                        );
                        if (monitoringIndex !== -1) {
                            console.log('Before update:', user.profile.monitoring[monitoringIndex]);
                            user.profile.monitoring[monitoringIndex].weight = weight;
                            user.profile.monitoring[monitoringIndex].bloodPressure = bloodPressure;
                            user.profile.monitoring[monitoringIndex].restingHeartRate = restingHeartRate;
                            user.profile.monitoring[monitoringIndex].sleep = sleep;
                            user.profile.monitoring[monitoringIndex].monitoringNotes = monitoringNotes || '';
                            console.log('After update:', user.profile.monitoring[monitoringIndex]);
                        }
                    }
                    // Add meds & sups edit case
                    if (entryId && (medicine || supplement)) {
                        const medsAndSupsIndex = user.profile.medsandsups.findIndex(
                            entry => entry._id.toString() === entryId
                        );
                        if (medsAndSupsIndex !== -1) {
                            user.profile.medsandsups[medsAndSupsIndex].medicine = medicine;
                            user.profile.medsandsups[medsAndSupsIndex].supplement = supplement;
                            user.profile.medsandsups[medsAndSupsIndex].medsAndSupsNotes = medsAndSupsNotes || '';
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
                            
                            let updateField;
                            let targetArray;

                              // Determine which array to update based on the type
                            switch (req.body.type) {
                                case 'monitoring':
                                    updateField = 'profile.monitoring';
                                    targetArray = targetUser.profile.monitoring;
                                    break;
                                case 'medsandsups':
                                    updateField = 'profile.medsandsups';
                                    targetArray = targetUser.profile.medsandsups;
                                    break;
                                default:
                                    updateField = 'profile.familyHistory';
                                    targetArray = targetUser.profile.familyHistory;
                            }

                            // // Remove the family history entry
                            // targetUser.profile.familyHistory = targetUser.profile.familyHistory.filter(
                            //     entry => entry._id.toString() !== entryId
                            // );

                            // Filter out the entry to be deleted
                            const filteredArray = targetArray.filter(
                                entry => entry._id.toString() !== entryId
                            );

                            // Use findOneAndUpdate instead of save to avoid version conflicts
                            const updatedUser = await registerCollection.findOneAndUpdate(
                                { _id: user._id },
                                { $set: { [updateField]: filteredArray } },
                                // { $set: { 'profile.familyHistory': targetUser.profile.familyHistory } },
                                { new: true } // This option returns the updated document
                            );

                            if (!updatedUser) {
                                throw new Error('Failed to update user');
                            }

                            // Update the local user object to match
                            user.profile[updateField.split('.')[1]] = updatedUser.profile[updateField.split('.')[1]];
                            // user.profile.familyHistory = updatedUser.profile.familyHistory;

                            console.log('Delete operation completed');
                            console.log(`${updateField} after:`, updatedUser.profile[updateField.split('.')[1]]);
                            // console.log('Family history after:', updatedUser.profile.familyHistory);

                            // No need to call save() again
                        } catch (error) {
                            console.error('Error deleting entry:', error);
                            throw new Error(`Failed to delete entry: ${error.message}`);
                            // throw new Error('Failed to delete family history entry: ' + error.message);
                        }
                    }
                    break;
            }
        }

        // Initialize Monitoring array
        if (!Array.isArray(user.profile.monitoring)) {
            user.profile.monitoring = [];
        }
        // Initialize lifestyle array
        if (!Array.isArray(user.profile.lifestyle)) {
            user.profile.lifestyle = [];
        }
        if (!Array.isArray(user.profile.medsandsups)) {
            user.profile.medsandsups = [];
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

        // Before saving:
        console.log('About to save user with updated profile:', {
            monitoring: user.profile.monitoring
        });

        // Save the updated user
        await user.save();

        // After saving:
        console.log('Save completed successfully');

        res.json({
            success: true,
            age: user.profile.age,
            bloodType: user.profile.bloodType,
            customBloodType: user.profile.customBloodType,
            sex: user.profile.sex,
            familyHistory: user.profile.familyHistory,
            lifestyle: user.profile.lifestyle,
            monitoring: user.profile.monitoring,
            medsandsups: user.profile.medsandsups
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