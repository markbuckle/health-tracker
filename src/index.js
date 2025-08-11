// index.js

const express = require("express");
const path = require("path");
const hbs = require("hbs");
const mongoose = require("mongoose");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const { connectToMongoDB, registerCollection, feedbackCollection, isConnected } = require("./mongodb");
const MongoStore = require("connect-mongo");
const templatePath = path.join(__dirname, "../templates");
const publicPath = path.join(__dirname, "../public");
const multer = require("multer");
const { upload, processUploadedFile, multerErrorHandler, isVercel } = require('./multerConfig');
const fs = require("fs");
require("dotenv").config();
// const EventEmitter = require('events'); // for the processing files modal
// const processEmitter = new EventEmitter(); // for the processing files modal
const WebSocket = require("ws");
const { calculateRangePositions } = require("../public/js/rangeCalculations");
const { biomarkerData, markerCategories, getRecommendableBiomarkers } = require("./parsers/biomarkerData");
const { Resend } = require("resend"); // npm install resend
const ragRoutes = require("./db/routes/ragRoutes");
// const { extractFromPDF } = require('./parsers/PaddleOCR/labParser');
const fetch = require("node-fetch");

// express app setup
const app = express();

if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' 'unsafe-hashes' cdnjs.cloudflare.com d3e54v103j8qbb.cloudfront.net cdn.jsdelivr.net cdn.plot.ly www.gstatic.com apis.google.com; " +
        "style-src 'self' 'unsafe-inline' fonts.googleapis.com cdn.jsdelivr.net cdn.plot.ly; " +
        "img-src 'self' data: blob: *; " +
        "font-src 'self' data: fonts.gstatic.com; " +
        "connect-src 'self' ws: wss: localhost:* cdn.jsdelivr.net cdn.plot.ly huggingface.co api-inference.huggingface.co; " +
        "child-src 'self' blob:; " +
        "worker-src 'self' blob:; " +
        "object-src 'none'; " +
        "media-src 'self'; " +
        "frame-src 'self'; " +
        "base-uri 'self'; " +
        "form-action 'self'"
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");

    res.removeHeader("X-Powered-By");
    res.removeHeader("X-Content-Security-Policy");
    res.removeHeader("X-WebKit-CSP");
    next();
  });
}

// Then create server with app
const server = require("http").createServer(app);


// Database connection middleware - ensure connection before handling requests
app.use(async (req, res, next) => {
  try {
    if (!isConnected()) {
      console.log('🔄 Establishing MongoDB connection...');
      await connectToMongoDB();
    }
    next();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    // In development, we might want to show the error
    if (process.env.NODE_ENV !== "production") {
      return res.status(500).send(`Database connection failed: ${error.message}`);
    }
    
    // In production, show a generic error
    return res.status(500).send('Service temporarily unavailable. Please try again.');
  }
});

// Then create WebSocket server
const wss = new WebSocket.Server({ server });

// Store WebSocket connections
const connections = new Set();

// WebSocket connection handler
wss.on("connection", (ws) => {
  connections.add(ws);

  ws.on("close", () => {
    connections.delete(ws);
  });
});

// Override console.log to broadcast to WebSocket clients
const originalLog = console.log;
console.log = function () {
  originalLog.apply(console, arguments);
  const message = Array.from(arguments).join(" ");

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
hbs.registerHelper("ifEqual", function (arg1, arg2, options) {
  return arg1 == arg2 ? options.fn(this) : options.inverse(this);
});
hbs.registerHelper("formatDate", function (date) {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
});

hbs.registerHelper("getLast", function (array) {
  return array[array.length - 1];
});

hbs.registerHelper("json", function (context) {
  return JSON.stringify(context);
});

hbs.registerHelper("isCurrentFile", function (labResultFilename, currentFiles) {
  // Extract just the filename without path for comparison
  const baseName = path.basename(labResultFilename);
  return currentFiles.some((file) => file.originalName === baseName);
});

hbs.registerHelper("lt", function (a, b) {
  return a < b;
});

hbs.registerHelper("gt", function (a, b) {
  return a > b;
});

// hbs.registerHelper('eq', function(a, b) {
//     a === b;
// });

hbs.registerHelper("eq", function (a, b) {
  if (!a || !b) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
});

// Add a debug helper
hbs.registerHelper("log", function (something) {
  console.log(something);
  return "";
});

hbs.registerHelper("isCategoryEmpty", function (labValues, categoryKey) {
  if (!labValues) return true;
  return !Object.values(labValues).some(
    (value) => value.category === categoryKey
  );
});

hbs.registerHelper("multiply", function (a, b) {
  return a * b;
});

hbs.registerHelper("formatNumber", function (number, decimals = 2) {
  return Number(number).toFixed(decimals);
});

hbs.registerHelper("confidenceClass", function (level) {
  switch (level) {
    case "high":
      return "high-confidence";
    case "medium":
      return "medium-confidence";
    case "low":
      return "low-confidence";
    default:
      return "";
  }
});

hbs.registerHelper("inline", function (options) {
  return ""; // Ignore the content
});

hbs.registerHelper("json", function (context) {
  return JSON.stringify(context);
});

hbs.registerHelper("formatDateString", function (dateString) {
  if (!dateString) return "";
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

// hbs.registerHelper("parseReferenceRange", function (range) {
//   if (!range) {
//     return null;
//   }
//   // Remove all spaces and handle both hyphen types
//   const cleanRange = range.toString().replace(/\s+/g, "").replace("–", "-");
//   const matches = cleanRange.match(/^(\d+\.?\d*)-(\d+\.?\d*)$/);

//   const result = {
//     min: parseFloat(matches[1]),
//     max: parseFloat(matches[2]),
//   };
//   return result;
// });

// hbs.registerHelper("parseReferenceRange", function (range) {
//   if (!range) {
//     return null;
//   }

//   // Remove all spaces and handle both hyphen types
//   const cleanRange = range.toString().replace(/\s+/g, "").replace("–", "-");
//   const matches = cleanRange.match(/^(\d+\.?\d*)-(\d+\.?\d*)$/);

//   // Ensure matches exist before accessing indices
//   if (!matches) {
//     return null; // Or return a default object { min: null, max: null }
//   }

//   return {
//     min: parseFloat(matches[1]),
//     max: parseFloat(matches[2]),
//   };
// });

hbs.registerHelper("parseReferenceRange", function (range) {
  if (!range) {
    console.log("parseReferenceRange: No range provided");
    return null;
  }

  const rangeStr = range.toString().trim();
  console.log("parseReferenceRange: Input range =", rangeStr);
  console.log("parseReferenceRange: Range type =", typeof range);
  
  // Handle "< X.X" format (like "< 1.05" or "Normal result range < 1.05")
  const lessThanMatch = rangeStr.match(/(?:.*<\s*)?(\d+\.?\d*)$/);
  if (rangeStr.includes('<') && lessThanMatch) {
    const result = {
      min: 0,
      max: parseFloat(lessThanMatch[1])
    };
    console.log("parseReferenceRange: Parsed as less-than range:", result);
    return result;
  }
  
  // Handle "> X.X" format
  const greaterThanMatch = rangeStr.match(/(?:.*>\s*)?(\d+\.?\d*)$/);
  if (rangeStr.includes('>') && greaterThanMatch) {
    const minValue = parseFloat(greaterThanMatch[1]);
    const result = {
      min: minValue,
      max: minValue * 3
    };
    console.log("parseReferenceRange: Parsed as greater-than range:", result);
    return result;
  }
  
  // Handle standard "X.X-Y.Y" format
  const cleanRange = rangeStr.replace(/\s+/g, "").replace("–", "-");
  const matches = cleanRange.match(/^(\d+\.?\d*)-(\d+\.?\d*)$/);

  if (!matches) {
    console.log("parseReferenceRange: Could not parse range:", rangeStr);
    return null;
  }

  const result = {
    min: parseFloat(matches[1]),
    max: parseFloat(matches[2])
  };
  console.log("parseReferenceRange: Parsed as standard range:", result);
  return result;
});

// bar chart marker position
hbs.registerHelper("calculateMarkerPosition", function (value, range) {
  if (!value || !range) return 126; // Default position

  const rangeObj =
    typeof range === "string" ? this.parseReferenceRange(range) : range;

  if (!rangeObj) return 126;

  // Calculate position (assuming SVG width of 420)
  const totalWidth = 420;
  const usableWidth = 388; // Adjusting for margins
  const startX = 2; // Left margin

  const position =
    startX +
    (usableWidth * (value - rangeObj.min)) / (rangeObj.max - rangeObj.min);
  return Math.min(Math.max(position, startX), totalWidth - startX);
});

// biomarkerData helpers

hbs.registerHelper("getBiomarkerDescription", function (biomarker) {
  return biomarkerData[biomarker]?.description || "Definition not available";
});

hbs.registerHelper("getBiomarkerUnit", function (biomarker) {
  return biomarkerData[biomarker]?.unit || "Unit not available";
});

hbs.registerHelper("getBiomarkerRange", function (biomarker, rangeType) {
  return (
    biomarkerData[biomarker]?.referenceRanges?.[rangeType] ||
    "Range not available"
  );
});

hbs.registerHelper("toLowerCase", function (str) {
  return str.toLowerCase();
});

hbs.registerHelper("json", function (context) {
  return JSON.stringify(context);
});

hbs.registerHelper("lookup", function (obj, key1, key2) {
  if (!obj || !key1) return null;
  const value = obj[key1];
  if (!value) return null;
  return key2 ? value[key2] : value;
});

hbs.registerHelper("isInCategory", function (biomarker, categoryId) {
  if (!biomarker) return false;
  return biomarker.category === categoryId;
});

hbs.registerHelper("log", function () {
  let args = Array.prototype.slice.call(arguments, 0, -1);
  console.log.apply(console, args);
});

// next 4 helper functions are for the calculateRangePositions function

hbs.registerHelper("add", function (a, b) {
  return a + b;
});

hbs.registerHelper("subtract", function (a, b) {
  return a - b;
});

hbs.registerHelper("multiply", function (a, b) {
  return a * b;
});

hbs.registerHelper("calculateRangeScaling", function (min, max) {
  return calculateRangePositions(parseFloat(min), parseFloat(max));
});

hbs.registerHelper("concat", function (...args) {
  // Remove the last argument (Handlebars options object)
  args.pop();
  // Join all arguments into a single string
  return args.join("");
});

hbs.registerHelper(
  "getBiomarkersForCategory",
  function (biomarkerData, categoryName) {
    return Object.values(biomarkerData).filter(
      (biomarker) =>
        biomarker.category.toLowerCase() === categoryName.toLowerCase() &&
        biomarker.value !== null
    );
  }
);

hbs.registerHelper(
  "hasBiomarkersInCategory",
  function (biomarkerData, categoryName) {
    return Object.values(biomarkerData).some(
      (biomarker) =>
        biomarker.category === categoryName && biomarker.value !== null
    );
  }
);

hbs.registerHelper(
  "hasBiomarkersInFrequency",
  function (biomarkerData, frequency) {
    return Object.values(biomarkerData).some(
      (marker) => marker.frequency === frequency && marker.value !== null
    );
  }
);

hbs.registerHelper("replace", function (str, pattern, replacement) {
  return str.replace(new RegExp(pattern, "g"), replacement);
});

hbs.registerHelper("getUniqueFrequencies", function (biomarkerData) {
  const frequencies = new Set();
  Object.values(biomarkerData).forEach((marker) => {
    if (marker && marker.frequency) {
      frequencies.add(marker.frequency);
    }
  });
  return Array.from(frequencies);
});

hbs.registerHelper("and", function () {
  // Convert arguments to Array and remove the last item (Handlebars options object)
  const args = Array.prototype.slice.call(arguments, 0, -1);
  return args.every(Boolean);
});

hbs.registerHelper("calculateCompletionPercentage", function (inputs) {
  if (!inputs) return 0;
  const totalInputs = Object.keys(inputs).length;
  const completedInputs = Object.values(inputs).filter(Boolean).length;
  return (totalScore = Math.round((completedInputs / totalInputs) * 100));
});

// Helper to get the appropriate URL for each metric
hbs.registerHelper("getMetricUrl", function (metricKey) {
  // Convert to lowercase for consistency
  const key = metricKey.toLowerCase();

  // Map metrics to appropriate URLs
  if (key.includes("blood") || key.includes("heart") || key.includes("sleep")) {
    return "/profile"; // These are in the monitoring section
  } else if (
    key.includes("lab") ||
    key.includes("biomarker") ||
    key.includes("physical")
  ) {
    return "/upload"; // These require uploading files
  } else {
    return "/profile"; // Default to profile
  }
});

// Calculate bar height based on value relative to max value
hbs.registerHelper("calculateBarHeight", function (value, maxValue) {
  if (!value || !maxValue) return 10; // Minimum height for visibility
  
  const percentage = (value / maxValue);
  // Set the maximum height to 180px (matching our CSS)
  const height = Math.max(Math.round(180 * percentage), 10);
  return height;
});


// Count biomarkers in range for a specific file
hbs.registerHelper("countInRange", function (labValues) {
  if (!labValues) return 0;
  
  let count = 0;
  
  // Handle both Map and regular object
  const entries = labValues instanceof Map ? 
    Array.from(labValues.entries()) : 
    Object.entries(labValues);
  
  entries.forEach(([key, value]) => {
    if (!value.referenceRange) return;
    
    // Extract min and max from reference range
    const rangeParts = value.referenceRange.replace(/\s+/g, '').split('-');
    if (rangeParts.length !== 2) return;
    
    const minValue = parseFloat(rangeParts[0]);
    const maxValue = parseFloat(rangeParts[1]);
    const biomarkerValue = parseFloat(value.value);
    
    if (isNaN(minValue) || isNaN(maxValue) || isNaN(biomarkerValue)) return;
    
    // Check if in range
    if (biomarkerValue >= minValue && biomarkerValue <= maxValue) {
      count++;
    }
  });
  
  return count;
});

// Count biomarkers out of range for a specific file
hbs.registerHelper("countOutOfRange", function (labValues) {
  if (!labValues) return 0;
  
  let count = 0;
  
  // Handle both Map and regular object
  const entries = labValues instanceof Map ? 
    Array.from(labValues.entries()) : 
    Object.entries(labValues);
  
  entries.forEach(([key, value]) => {
    if (!value.referenceRange) return;
    
    // Extract min and max from reference range
    const rangeParts = value.referenceRange.replace(/\s+/g, '').split('-');
    if (rangeParts.length !== 2) return;
    
    const minValue = parseFloat(rangeParts[0]);
    const maxValue = parseFloat(rangeParts[1]);
    const biomarkerValue = parseFloat(value.value);
    
    if (isNaN(minValue) || isNaN(maxValue) || isNaN(biomarkerValue)) return;
    
    // Check if out of range
    if (biomarkerValue < minValue || biomarkerValue > maxValue) {
      count++;
    }
  });
  
  return count;
});

// hbs.registerHelper('debug', function(optionalValue) {
//     console.log('Context:', this);
//     if (optionalValue) {
//       console.log('Value:', optionalValue);
//     }
//     return '';
// });

app.set("view engine", "hbs");
app.set("views", templatePath);

// Partial paths
const partialsPath = path.join(__dirname, "../templates/partials");
hbs.registerPartials(partialsPath);

// Add error handling for static files
app.use(express.static(publicPath));

// Session setup - MUST come before passport middleware
if (!process.env.SESSION_SECRET) {
  console.error("SESSION_SECRET is not set in environment variables");
  process.exit(1);
}
// app.use(
//   session({
//     secret: process.env.SESSION_SECRET,
//     resave: false,
//     saveUninitialized: false,
//     store: MongoStore.create({
//       mongoUrl: process.env.DB_STRING,
//       ttl: 24 * 60 * 60, // 24 hours
//     }),
//     cookie: {
//       maxAge: 24 * 60 * 60 * 1000, // 24 hours
//       httpOnly: true,
//       sameSite: "lax",
//       // secure: process.env.NODE_ENV === 'production'
//     },
//   })
// );

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.DB_STRING,
      touchAfter: 24 * 3600,
      mongoOptions: {
        maxPoolSize: process.env.VERCEL ? 1 : 10,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
      },
      // Add these options for better serverless compatibility
      autoRemove: 'native',
      autoRemoveInterval: 10,
      ttl: 24 * 60 * 60 // 24 hours in seconds
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      secure: process.env.NODE_ENV === "production" && process.env.VERCEL,
      httpOnly: true,
      sameSite: 'lax'
    },
    rolling: true,
    proxy: true
  })
);

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

// old strategy
// passport.use(
//   new LocalStrategy(
//     {
//       usernameField: "uname", // specify the field names from your form
//       passwordField: "password",
//     },
//     async (username, password, done) => {
//       try {
//         const user = await registerCollection.findOne({ uname: username });
//         if (!user) {
//           return done(null, false, { message: "User not found" });
//         }
//         // In production, use proper password hashing comparison
//         if (user.password !== password) {
//           return done(null, false, { message: "Incorrect password" });
//         }
//         return done(null, user);
//       } catch (error) {
//         return done(error);
//       }
//     }
//   )
// );

// new strategy
passport.use(
  new LocalStrategy(
    {
      usernameField: 'uname',
      passwordField: 'password'
    },
    async (username, password, done) => {
      try {
        // Ensure connection
        if (!isConnected()) {
          await connectToMongoDB();
        }
        
        const user = await registerCollection.findOne({ uname: username });
        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }
        if (user.password !== password) {
          return done(null, false, { message: "Incorrect password." });
        }
        return done(null, user);
      } catch (error) {
        console.error('Authentication error:', error);
        return done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user._id); // Use _id for MongoDB
});

passport.deserializeUser(async (id, done) => {
  try {
    // Ensure connection
    if (!isConnected()) {
      await connectToMongoDB();
    }
    
    const user = await registerCollection.findById(id);
    done(null, user);
  } catch (error) {
    console.error('Deserialization error:', error);
    done(error, null);
  }
});

// Authentication middleware
function checkAuth(req, res, next) {
  if (req.isAuthenticated()) {
    // or use your own custom authentication check
    return next();
  } else {
    res.redirect("/login");
  }
}

// Routes
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/register", (req, res) => {
  res.render("auth/register");
});

app.get("/login", (req, res) => {
  res.render("auth/login");
});

app.get("/demo", (req, res) => {
  res.render("demo");
});

app.get("/how-it-works", (req, res) => {
  res.render("how-it-works");
});

app.get("/learning", (req, res) => {
  res.render("learning");
});

app.get("/", (req, res) => {
  res.render("main");
});

app.get("/welcome", (req, res) => {
  res.render("user/welcome");
});

app.get("/credits", (req, res) => {
  res.render("credits");
});

app.get("/profile", checkAuth, (req, res) => {
  res.render("user/profile", {
    fname: req.user.fname,
    lname: req.user.lname,
    uname: req.user.uname,
    user: req.user, // passes the entire user object
    profile: req.user.profile || {},
    bloodType: [
      "A+",
      "A-",
      "B+",
      "B-",
      "O+",
      "O-",
      "AB+",
      "AB-",
      "Unknown",
      "Other",
    ],
  });
});

app.get("/upload", checkAuth, async (req, res) => {
  try {
    // Fetch the uploaded user document with files
    const user = await registerCollection.findById(req.user._id).lean();

    console.log("User data for upload page:", {
      files: user.files?.map((f) => ({
        id: f._id,
        name: f.originalName,
        hasLabValues: !!f.labValues,
        labValueCount: f.labValues ? Object.keys(f.labValues).length : 0,
      })),
    });

    res.render("user/upload", {
      naming: user.uname,
      user: user,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).send("Error loading upload page");
  }
});

app.get("/reports", checkAuth, async (req, res) => {
  try {
    console.log("=== REPORTS ROUTE DEBUG ===");
    
    // Get the user's latest lab results
    const user = await registerCollection.findById(req.user._id);
    console.log(`User ID: ${user._id}`);

    // Get all files with lab values and sort by test date
    const filesWithLabValues = user.files
      .filter((file) => file.labValues && Object.entries(file.labValues).length > 0)
      .sort((a, b) => new Date(b.testDate) - new Date(a.testDate));

    console.log(`Found ${filesWithLabValues.length} files with lab values`);

    // Track all values for each biomarker
    const biomarkerHistory = {};

    // ENHANCED Helper function to find biomarker by any of its names
    function findBiomarkerMatch(testName) {
      console.log(`\n🔍 Trying to match: "${testName}"`);
      
      if (!testName) {
        console.log("❌ No test name provided");
        return null;
      }
      
      const testNameLower = testName.toLowerCase().trim();
      console.log(`Normalized: "${testNameLower}"`);

      // Check all biomarkers in biomarkerData
      for (const [standardName, data] of Object.entries(biomarkerData)) {
        // Direct name match
        if (standardName.toLowerCase() === testNameLower) {
          console.log(`✅ DIRECT MATCH: "${testName}" → "${standardName}"`);
          return [standardName, data];
        }

        // Check alternate names
        if (data.alternateNames && Array.isArray(data.alternateNames)) {
          for (const altName of data.alternateNames) {
            if (altName.toLowerCase() === testNameLower) {
              console.log(`✅ ALTERNATE MATCH: "${testName}" → "${standardName}" (via "${altName}")`);
              return [standardName, data];
            }
          }
        }
      }

      // Fuzzy matching for partial names
      for (const [standardName, data] of Object.entries(biomarkerData)) {
        const standardLower = standardName.toLowerCase();
        
        // Check if test name is contained in standard name or vice versa (min 4 chars)
        if (testNameLower.length >= 4 && standardLower.includes(testNameLower)) {
          console.log(`✅ PARTIAL MATCH: "${testName}" → "${standardName}" (partial)`);
          return [standardName, data];
        }
        
        if (standardLower.length >= 4 && testNameLower.includes(standardLower)) {
          console.log(`✅ PARTIAL MATCH: "${testName}" → "${standardName}" (reverse partial)`);
          return [standardName, data];
        }
      }

      console.log(`❌ NO MATCH found for: "${testName}"`);
      return null;
    }

    // When processing lab values
    filesWithLabValues.forEach((file, fileIndex) => {
      console.log(`\n📁 Processing file ${fileIndex + 1}: ${file.originalName}`);
      
      // Handle both Map and Object formats for labValues
      let labValuesEntries;
      if (file.labValues instanceof Map) {
        labValuesEntries = Array.from(file.labValues.entries());
        console.log("Lab values format: Map");
      } else {
        labValuesEntries = Object.entries(file.labValues);
        console.log("Lab values format: Object");
      }
      
      console.log(`Found ${labValuesEntries.length} lab values in this file:`);
      labValuesEntries.forEach(([name, value]) => {
        console.log(`  - "${name}": ${value.value} ${value.unit || ''}`);
      });
      
      labValuesEntries.forEach(([labTestName, value]) => {
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
            filename: file.originalName,
          });
          
          console.log(`📊 Added to history: ${standardName} = ${value.value} ${value.unit || ''}`);
        }
      });
    });

    console.log(`\n📈 Total biomarkers in history: ${Object.keys(biomarkerHistory).length}`);
    console.log("Biomarkers found:", Object.keys(biomarkerHistory));

    // Merge static biomarker data with lab values
    const enrichedBiomarkerData = {};

    for (const [biomarkerName, biomarkerInfo] of Object.entries(biomarkerData)) {
      const allValues = biomarkerHistory[biomarkerName] || [];
      const sortedValues = allValues.sort((a, b) => new Date(b.testDate) - new Date(a.testDate));
      const mostRecent = sortedValues[0];

      enrichedBiomarkerData[biomarkerName] = {
        ...biomarkerInfo,
        value: mostRecent?.value || null,
        unit: mostRecent?.unit || null,
        referenceRange: mostRecent?.referenceRange || null,
        history: sortedValues,
      };
    }

    // Debug category distribution
    console.log("\n🏷️ CATEGORY ANALYSIS:");
    const categoryCount = {};
    const biomarkersWithValues = [];
    
    for (const [biomarkerName, data] of Object.entries(enrichedBiomarkerData)) {
      if (data.value !== null) {
        biomarkersWithValues.push(biomarkerName);
        const category = data.category;
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      }
    }
    
    console.log("Biomarkers with values:", biomarkersWithValues);
    console.log("Category distribution:", categoryCount);
    
    if (biomarkersWithValues.length === 0) {
      console.log("🚨 NO BIOMARKERS HAVE VALUES! This is why categories are empty.");
    }

    // Create initialData script with sanitized file data
    const filesForClient = filesWithLabValues.map((file) => ({
      testDate: file.testDate,
      labValues: Object.fromEntries(file.labValues),
    }));

    console.log("\n✅ Rendering reports page...");
    console.log("markerCategories:", Object.keys(markerCategories || {}));
    console.log("enrichedBiomarkerData keys:", Object.keys(enrichedBiomarkerData).slice(0, 10));

    res.render("user/reports", {
      markerCategories: Object.values(markerCategories),
      biomarkerData: enrichedBiomarkerData,
      initialData: `<script>window.__INITIAL_DATA__ = ${JSON.stringify({
        files: user.files,
        biomarkers: Object.keys(biomarkerData),
        biomarkerInfo: biomarkerData,
      })};</script>`,
    });
  } catch (error) {
    console.error("Error in /reports route:", error);
    res.status(500).send("Error generating report");
  }
});

app.get("/insights", checkAuth, async (req, res) => {
  try {
    const user = await registerCollection.findById(req.user._id);

    // Define biomarkers from your existing biomarkerData
    const biomarkers = Object.keys(biomarkerData);

    // Now this will work
    const biomarkerSummary = calculateBiomarkerSummary(user.files, biomarkers);

    // Calculate all inputs in one object
    const inputs = {
      bloodType: user.profile && user.profile.bloodType ? user.profile.bloodType.length > 0 : false,
      familyHistory: user.profile && user.profile.familyHistory ? user.profile.familyHistory.length > 0 : false,
      personalHistory: user.profile && user.profile.personalHistory ? user.profile.personalHistory.length > 0 : false,
      bloodPressure: user.profile && user.profile.monitoring ? user.profile.monitoring.some(m => m && m.bloodPressure) : false,
      heartRate: user.profile && user.profile.monitoring ? user.profile.monitoring.some(m => m && m.restingHeartRate) : false,
      sleep: user.profile && user.profile.monitoring ? user.profile.monitoring.some(m => m && m.sleep) : false,
      lifestyle: user.profile && user.profile.lifestyle ? user.profile.lifestyle.length > 0 : false,
      labTrends: user.files ? user.files.length > 0 : false,
      bloodwork: user.files ? user.files.length > 0 : false,
      biomarkers: user.files ? user.files.some(f => f && f.labValues && Object.keys(f.labValues).length > 0) : false,
      physical: user.files ? user.files.some(f => 
        f && f.testDate && new Date(f.testDate) > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      ) : false
    };

    // Calculate completion percentage
    const totalInputs = Object.keys(inputs).length;
    const completedInputs = Object.values(inputs).filter(Boolean).length;
    const completionPercentage = Math.round(
      (completedInputs / totalInputs) * 100
    );

    // Update the total score in the category header
    const totalScore = completionPercentage;

    // Get recommendations based on missing data (existing function)
    const profileRecommendations = createRecommendations(inputs);

    // Get biomarker-specific recommendations (new function)
    const biomarkerRecommendations = generateBiomarkerRecommendations(user.files);

    // Combine all recommendations
    const allRecommendations = [...biomarkerRecommendations, ...profileRecommendations];
  
    // Get recent files for labs summary tab
    const recentFiles = getRecentFiles(user.files, 5);

    res.render("user/insights", {
      naming: req.user.uname,
      scores: { inputs },
      totalScore,
      recommendations: allRecommendations,
      biomarkerSummary,
      recentFiles
    });
  } catch (error) {
    console.error("Error generating insights:", error);
    res.status(500).send("Error loading insights page");
  }
});

// Test endpoint for database connections
app.get("/api/test-connections", async (req, res) => {
  const results = {
    mongodb: { status: 'unknown' },
    postgresql: { status: 'unknown' }
  };
  
  // Test MongoDB
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      results.mongodb.status = 'connected';
    } else {
      results.mongodb.status = 'disconnected';
    }
  } catch (error) {
    results.mongodb.status = 'error';
    results.mongodb.error = error.message;
  }
  
  // Test PostgreSQL
  try {
    const { testConnection } = require('./db/pgConnector');
    const pgResult = await testConnection();
    results.postgresql.status = 'connected';
    results.postgresql.info = pgResult;
  } catch (error) {
    results.postgresql.status = 'error';
    results.postgresql.error = error.message;
  }
  
  res.json(results);
});

// Helper to check if user has minimal data
hbs.registerHelper('hasMinimalData', function(recentFiles, totalScore) {
  // Check if user has no files AND low profile completion
  const hasNoFiles = !recentFiles || recentFiles.length === 0;
  const hasLowProfileScore = totalScore < 30; // Adjust threshold as needed
  
  return hasNoFiles && hasLowProfileScore;
});

// Alternative helper that provides more granular control
hbs.registerHelper('shouldShowNoDataState', function(user, totalScore, recentFiles) {
  // More sophisticated logic - check if user truly has no meaningful data
  const hasNoFiles = !recentFiles || recentFiles.length === 0;
  const hasVeryLowScore = totalScore < 20; // Very low threshold
  
  // Check if user has any meaningful profile data
  const hasBasicProfile = user && user.profile && (
    (user.profile.familyHistory && user.profile.familyHistory.length > 0) ||
    (user.profile.personalHistory && user.profile.personalHistory.length > 0) ||
    (user.profile.lifestyle && user.profile.lifestyle.length > 0) ||
    (user.profile.monitoring && user.profile.monitoring.length > 0) ||
    user.profile.bloodType
  );
  
  return hasNoFiles && (hasVeryLowScore || !hasBasicProfile);
});

// Helper to check if recommendation is biomarker-related
hbs.registerHelper('isBiomarkerRecommendation', function(recommendation) {
  // Handle both new structured format and legacy string format
  if (typeof recommendation === 'object' && recommendation.type) {
    return recommendation.type === 'biomarker';
  }
  // Legacy support for string-based recommendations
  return recommendation && (
    recommendation.includes('Consider testing') ||
    recommendation.includes('ApoB') || 
    recommendation.includes('Lp(a)')
  );
});

// Helper to check if there are any biomarker recommendations
hbs.registerHelper('hasBiomarkerRecommendations', function(recommendations) {
  if (!recommendations || !Array.isArray(recommendations)) return false;
  return recommendations.some(rec => {
    if (typeof rec === 'object' && rec.type) {
      return rec.type === 'biomarker';
    }
    // Legacy string checking
    return rec.includes('Consider testing') || rec.includes('ApoB') || rec.includes('Lp(a)');
  });
});

// Helper to get priority class for styling
hbs.registerHelper('getPriorityClass', function(recommendation) {
  if (typeof recommendation === 'object' && recommendation.priority) {
    return `${recommendation.priority}-priority`;
  }
  // Legacy support - detect priority from emoji indicators
  if (typeof recommendation === 'string') {
    if (recommendation.includes('🔴')) return 'high-priority';
    if (recommendation.includes('🟡')) return 'medium-priority';
    if (recommendation.includes('⚪')) return 'low-priority';
  }
  return '';
});

// Helper to format recommendation text (handles both legacy and new formats)
hbs.registerHelper('formatRecommendationText', function(recommendation) {
  if (typeof recommendation === 'object' && recommendation.text) {
    return recommendation.text;
  }
  if (typeof recommendation === 'string') {
    // Remove priority indicators for legacy format
    return recommendation.replace(/^[🔴🟡⚪]\s*/, '');
  }
  return recommendation;
});

// Helper to get icon based on category
hbs.registerHelper('getCategoryIcon', function(category) {
  const iconMap = {
    'Cardiovascular Risk': '❤️',
    'Metabolic Health': '🩺',
    'Inflammation': '🔥',
    'Nutritional Status': '🥗',
    'Preventive Care': '🏥',
    'Monitoring': '📊',
    'Profile Information': '👤'
  };
  return iconMap[category] || '💡';
});

// Helper to group recommendations by type and category
hbs.registerHelper('groupRecommendations', function(recommendations) {
  if (!recommendations || !Array.isArray(recommendations)) return {};
  
  const grouped = {
    biomarker: {},
    profile: {}
  };
  
  recommendations.forEach(rec => {
    // Handle both new structured format and legacy strings
    let type, category, processedRec;
    
    if (typeof rec === 'object' && rec.type) {
      type = rec.type;
      category = rec.category || 'Other';
      processedRec = rec;
    } else {
      // Legacy string handling - FIXED: removed extra closing parenthesis
      if (rec.includes('Consider testing') || rec.includes('ApoB') || rec.includes('Lp(a)')) {
        type = 'biomarker';
        category = 'Lab Tests';
      } else {
        type = 'profile';
        category = 'General Health';
      }
      processedRec = {
        type: type,
        category: category,
        text: rec,
        priority: 'medium' // default priority for legacy items
      };
    }
    
    if (!grouped[type][category]) {
      grouped[type][category] = [];
    }
    grouped[type][category].push(processedRec);
  });
  
  return grouped;
});

// Helper to check if object has any properties
hbs.registerHelper('hasProperties', function(obj) {
  return obj && Object.keys(obj).length > 0;
});

// Helper to get object keys
hbs.registerHelper('getKeys', function(obj) {
  return obj ? Object.keys(obj) : [];
});

hbs.registerHelper('typeof', function(value) {
  return typeof value;
});

// Helper function to calculate biomarker summary
function calculateBiomarkerSummary(files, biomarkers) {
  // Add defensive check at the beginning
  if (!biomarkers || !Array.isArray(biomarkers) || !files || !Array.isArray(files)) {
    console.warn("Invalid input to calculateBiomarkerSummary");
    return {
      inRange: 0,
      outOfRange: 0,
      improving: 0,
      declining: 0
    };
  }

  // Initialize counters
  let inRangeCount = 0;
  let outOfRangeCount = 0;
  let improvingCount = 0;
  let decliningCount = 0;

  // First, collect all biomarker values from all files
  const allBiomarkerValues = [];

  files.forEach(file => {
    if (!file.labValues || !file.testDate) return;

    // Check whether labValues is a Map or a regular object
    const entries = file.labValues.entries && typeof file.labValues.entries === 'function' 
      ? Array.from(file.labValues.entries())
      : Object.entries(file.labValues);
    
    entries.forEach(([biomarkerName, value]) => {
      if (!value || !value.value) return;
      
      // Parse the biomarker value
      const numValue = parseFloat(value.value);
      if (isNaN(numValue)) return;
      
      // Parse reference range if available
      let isInRange = null;
      let minRef = null;
      let maxRef = null;
      
      if (value.referenceRange && value.referenceRange.includes('-')) {
        const cleanRange = value.referenceRange.replace(/\s+/g, '');
        [minRef, maxRef] = cleanRange.split('-').map(parseFloat);
        
        if (!isNaN(minRef) && !isNaN(maxRef)) {
          isInRange = numValue >= minRef && numValue <= maxRef;
        }
      }
      
      // Add to all values array with metadata
      allBiomarkerValues.push({
        name: biomarkerName,
        value: numValue,
        date: new Date(file.testDate),
        inRange: isInRange,
        minRef,
        maxRef,
        fileName: file.originalName || file.filename
      });
    });
  });
  
  // Count in-range and out-of-range values across all files
  allBiomarkerValues.forEach(item => {
    if (item.inRange === true) {
      inRangeCount++;
    } else if (item.inRange === false) {
      outOfRangeCount++;
    }
  });
  
  // Group biomarkers by name to analyze trends
  const biomarkersByName = {};
  
  allBiomarkerValues.forEach(item => {
    if (!biomarkersByName[item.name]) {
      biomarkersByName[item.name] = [];
    }
    biomarkersByName[item.name].push(item);
  });
  
  // Analyze trends for each biomarker
  Object.entries(biomarkersByName).forEach(([name, values]) => {
    // Need at least 2 points for trend analysis
    if (values.length < 2) return;
    
    // Sort by date (oldest to newest)
    values.sort((a, b) => a.date - b.date);
    
    // Simple trend detection
    const oldestValue = values[0].value;
    const newestValue = values[values.length - 1].value;
    
    // If newest value is in range, we don't count it as improving/declining
    if (values[values.length - 1].inRange === true) {
      // Already counted in inRangeCount
      return;
    }
    
    // If oldest value is out of range and newest is closer to range
    if (values[0].inRange === false) {
      const oldest = values[0];
      const newest = values[values.length - 1];
      
      // If below range and increasing
      if (oldest.value < oldest.minRef && newest.value > oldest.value) {
        improvingCount++;
      }
      // If above range and decreasing
      else if (oldest.value > oldest.maxRef && newest.value < oldest.value) {
        improvingCount++;
      }
      // Otherwise, it's either out of range or declining
      else if (newest.value < oldest.value && oldest.value < oldest.minRef) {
        decliningCount++;
      }
      else if (newest.value > oldest.value && oldest.value > oldest.maxRef) {
        decliningCount++;
      }
      else {
        // Count as out of range (already counted)
      }
    }
  });
  
  console.log("Biomarker counts:", {
    inRange: inRangeCount,
    outOfRange: outOfRangeCount,
    improving: improvingCount,
    declining: decliningCount
  });
  
  return {
    inRange: inRangeCount,
    outOfRange: outOfRangeCount,
    improving: improvingCount,
    declining: decliningCount
  };
}

// Helper to check if all biomarker summary values are zero
hbs.registerHelper("allZero", function (summary) {
  if (!summary) return true;
  
  // Handle both object and primitive types safely
  const inRange = typeof summary.inRange === 'number' ? summary.inRange : 0;
  const improving = typeof summary.improving === 'number' ? summary.improving : 0;
  const outOfRange = typeof summary.outOfRange === 'number' ? summary.outOfRange : 0;
  const declining = typeof summary.declining === 'number' ? summary.declining : 0;
  
  return (inRange === 0 && improving === 0 && outOfRange === 0 && declining === 0);
});

hbs.registerHelper("isZero", function (value) {
  // Simple zero check that works with strings, numbers, null, etc.
  return !value || value === 0 || value === "0";
});

// Helper function to get most recent files
function getRecentFiles(files, limit = 5) {
  if (!files || files.length === 0) return [];

  return files
    .filter(file => file.labValues && Object.keys(file.labValues).length > 0)
    .sort((a, b) => new Date(b.testDate) - new Date(a.testDate))
    .slice(0, limit)
    .map(file => ({
      _id: file._id,
      originalName: file.originalName,
      testDate: file.testDate,
      labValues: file.labValues
    }));
}

// Updated generateBiomarkerRecommendations function using your biomarkerData
function generateBiomarkerRecommendations(userFiles) {
  const recommendations = [];
  
  // Get all biomarkers that have been tested across all user's files
  const testedBiomarkers = new Set();
  
  if (userFiles && Array.isArray(userFiles)) {
    userFiles.forEach(file => {
      if (file.labValues) {
        // Handle both Map and regular object structures
        const entries = file.labValues instanceof Map 
          ? Array.from(file.labValues.entries()) 
          : Object.entries(file.labValues);
        
        entries.forEach(([biomarkerName, _]) => {
          testedBiomarkers.add(biomarkerName.toLowerCase());
        });
      }
    });
  }

  // Get biomarkers that have recommendation data
  const recommendableBiomarkers = getRecommendableBiomarkers();

  // Check for missing biomarkers
  Object.entries(recommendableBiomarkers).forEach(([biomarkerKey, biomarkerInfo]) => {
    const recommendation = biomarkerInfo.recommendation;
    
    // Check if any alias of this biomarker has been tested
    const isPresent = recommendation.aliases.some(alias => 
      Array.from(testedBiomarkers).some(tested => 
        tested.includes(alias) || alias.includes(tested)
      )
    );

    if (!isPresent) {
      recommendations.push({
        type: 'biomarker',
        priority: recommendation.priority,
        category: recommendation.category,
        text: `Consider testing ${biomarkerKey} - ${recommendation.explanation}`,
        biomarker: biomarkerKey,
        displayName: biomarkerKey
      });
    }
  });

  return recommendations;
}

// Helper function to generate recommendations
function createRecommendations(inputs) {
  const recommendations = [];
  
    if (inputs.bloodType === false) {
    recommendations.push({
      type: 'profile',
      priority: 'medium',
      category: 'Profile Information',
      text: "Add your blood type to your profile"
    });
  }
  if (inputs.personalHistory === false) {
    recommendations.push({
      type: 'profile',
      priority: 'medium',
      category: 'Profile Information',
      text: "Add personal history information"
    });
  }
  if (inputs.familyHistory === false) {
    recommendations.push({
      type: 'profile',
      priority: 'medium',
      category: 'Profile Information',
      text: "Add family history information"
    });
  }
  if (inputs.bloodPressure === false) {
    recommendations.push({
      type: 'profile',
      priority: 'medium',
      category: 'Monitoring',
      text: "Start tracking your blood pressure regularly"
    });
  }
  if (inputs.physical === false) {
    recommendations.push({
      type: 'profile',
      priority: 'high',
      category: 'Preventive Care',
      text: "Schedule your annual physical examination"
    });
  }
  
  return recommendations;
}

// Helper function to generate recommendations based on incomplete inputs
// function createRecommendations(inputs) {
//   if (!inputs) return [];
  
//   const recommendations = [];
//   for (const [key, completed] of Object.entries(inputs)) {
//     if (!completed) {
//       switch (key) {
//         case "physical":
//           recommendations.push("Schedule your annual physical examination");
//           break;
//         case "bloodPressure":
//           recommendations.push("Start tracking your blood pressure");
//           break;
//         case "weight":
//           recommendations.push("Begin regular weight monitoring");
//           break;
//         // Add cases for other inputs
//       }
//     }
//   }
//   return recommendations;
// }

// Helper function to generate recommendations based on incomplete inputs
// function generateRecommendations(inputs) {
//   if (!inputs) return [];

//   console.log("Scores data:", { inputs });
//   console.log("Recommendations:", generateRecommendations(inputs));
  
//   const recommendations = [];
//   for (const [key, completed] of Object.entries(inputs)) {
//     if (!completed) {
//       switch (key) {
//         case "physical":
//           recommendations.push("Schedule your annual physical examination");
//           break;
//         case "bloodPressure":
//           recommendations.push("Start tracking your blood pressure");
//           break;
//         // Add cases for other inputs
//       }
//     }
//   }
//   return recommendations;
// }

// Helper function to generate recommendations based on incomplete inputs
// function generateRecommendations(inputs) {
//   const recommendations = [];
//   for (const [key, completed] of Object.entries(inputs)) {
//     if (!completed) {
//       switch (key) {
//         case "physical":
//           recommendations.push("Schedule your annual physical examination");
//           break;
//         case "bloodPressure":
//           recommendations.push("Start tracking your blood pressure");
//           break;
//         case "weight":
//           recommendations.push("Begin regular weight monitoring");
//           break;
//         // Add cases for other inputs
//       }
//     }
//   }
//   return recommendations;
// }


// Authentication logic

app.post("/register", async (req, res) => {
  const data = {
    fname: req.body.fname,
    lname: req.body.lname,
    email: req.body.email,
    uname: req.body.uname,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
  };

  try {
    const existingUser = await registerCollection.findOne({
      uname: req.body.uname,
    });

    if (existingUser) {
      return res.status(400).send("Username already exists");
    }

    if (req.body.password !== req.body.confirmPassword) {
      return res.status(400).send("Passwords do not match");
    }

    const newUser = new registerCollection(data);
    await newUser.save();

    res.status(201).render("auth/login", {
      naming: req.body.uname,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred during registration");
  }
});

// Login logic
app.post("/login", (req, res, next) => {
  console.log("Login attempt received for username:", req.body.uname);
  
  passport.authenticate("local", (err, user, info) => {
    console.log("Passport auth result:", { err, user: user ? 'exists' : 'null', info });
    
    if (err) { 
      console.error("Login error:", err);
      return next(err); 
    }
    if (!user) { 
      console.log("User not found or incorrect password");
      return res.redirect('/login'); 
    }
    
    req.logIn(user, function(err) {
      if (err) { 
        console.error("Session login error:", err);
        return next(err); 
      }
      console.log("Login successful for user:", user.uname);
      return res.redirect('/welcome');
    });
  })(req, res, next);
});

app.post("/update-profile", checkAuth, async (req, res) => {
  try {
    const {
      fname,
      lname,
      birthDate,
      sex,
      bloodType,
      customBloodType,
      personalCondition,
      personalNotes,
      familyCondition,
      relatives,
      addNotes,
      weight,
      bloodPressure,
      restingHeartRate,
      sleep,
      monitoringNotes,
      habitType,
      status,
      lifestyleNotes,
      medicine,
      supplement,
      medsAndSupsNotes,
      medSupType,
      name,
      dosage,
      frequency,
      notes,
      entryId,
      action,
    } = req.body;

    // Log request body for debugging
    console.log("Received update request:", {
      body: req.body,
      action: req.body.action,
      entryId: req.body.entryId,
      type: req.body.type,
    });

    // Find the user and update profile
    const user = await registerCollection.findById(req.user._id);

    if (!user) {
      console.log("User not found");
      return res.status(404).json({
        success: false,
        message: "User not found",
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
      if (bloodType === "Other") {
        user.profile.bloodType = "Other";
        user.profile.customBloodType = customBloodType;
      } else {
        user.profile.bloodType = bloodType;
        user.profile.customBloodType = null;
      }
    }

    // ADD THIS - Initialize personalHistory array
    if (!Array.isArray(user.profile.personalHistory)) {
      user.profile.personalHistory = [];
    }

    // Ensure familyHistory is initialized
    if (!Array.isArray(user.profile.familyHistory)) {
      user.profile.familyHistory = [];
    }

    // Handle add, edit and delete actions
    if (action) {
      switch (action) {
        case "add":
          if (personalCondition) {
            user.profile.personalHistory.push({
              personalCondition,
              personalNotes: personalNotes || "",
            });
          }
          if (familyCondition && relatives) {
            user.profile.familyHistory.push({
              familyCondition,
              relatives: relatives.split(","),
              addNotes: addNotes || "",
            });
          }
          if (weight && bloodPressure) {
            user.profile.monitoring.push({
              weight,
              bloodPressure,
              restingHeartRate,
              sleep,
              monitoringNotes: monitoringNotes || "",
            });
          }
          if (medSupType && name) {
            user.profile.medsandsups.push({
              type: medSupType,        // Map medSupType to type
              name: name,              // Use name directly
              dosage: dosage || "",
              frequency: frequency || "",
              notes: notes || ""       // Use notes instead of medsAndSupsNotes
            });
          }
          // if (medicine || supplement) {
          //   user.profile.medsandsups.push({
          //     medicine,
          //     supplement,
          //     medsAndSupsNotes: medsAndSupsNotes || "",
          //   });
          // }
          break;

        case "edit":
          // Existing family history edit case
          if (entryId && personalCondition) {
            const personalEntryIndex = user.profile.personalHistory.findIndex(
              (entry) => entry._id.toString() === entryId
            );
            if (personalEntryIndex !== -1) {
              user.profile.personalHistory[personalEntryIndex].personalCondition = personalCondition;
              user.profile.personalHistory[personalEntryIndex].personalNotes = personalNotes || "";
            }
          }
          // Existing family history edit case
          if (entryId && familyCondition && relatives) {
            const entryIndex = user.profile.familyHistory.findIndex(
              (entry) => entry._id.toString() === entryId
            );
            if (entryIndex !== -1) {
              user.profile.familyHistory[entryIndex].familyCondition =
                familyCondition;
              user.profile.familyHistory[entryIndex].relatives =
                relatives.split(",");
              user.profile.familyHistory[entryIndex].addNotes = addNotes || "";
            }
          }
          console.log("Processing edit action");
          // Add monitoring edit case
          if (entryId && weight && bloodPressure) {
            console.log("Attempting to edit monitoring entry:", entryId);
            const monitoringIndex = user.profile.monitoring.findIndex(
              (entry) => entry._id.toString() === entryId
            );
            if (monitoringIndex !== -1) {
              console.log(
                "Before update:",
                user.profile.monitoring[monitoringIndex]
              );
              user.profile.monitoring[monitoringIndex].weight = weight;
              user.profile.monitoring[monitoringIndex].bloodPressure =
                bloodPressure;
              user.profile.monitoring[monitoringIndex].restingHeartRate =
                restingHeartRate;
              user.profile.monitoring[monitoringIndex].sleep = sleep;
              user.profile.monitoring[monitoringIndex].monitoringNotes =
                monitoringNotes || "";
              console.log(
                "After update:",
                user.profile.monitoring[monitoringIndex]
              );
            }
          }
          // Add meds & sups edit case
          if (entryId && (medicine || supplement)) {
            const medsAndSupsIndex = user.profile.medsandsups.findIndex(
              (entry) => entry._id.toString() === entryId
            );
            if (medsAndSupsIndex !== -1) {
              user.profile.medsandsups[medsAndSupsIndex].medicine = medicine;
              user.profile.medsandsups[medsAndSupsIndex].supplement =
                supplement;
              user.profile.medsandsups[medsAndSupsIndex].medsAndSupsNotes =
                medsAndSupsNotes || "";
            }
          }
          break;

        case "delete":
          if (entryId) {
            try {
              console.log("Attempting to delete entry with ID:", entryId);

              // Find the most recent version of the user
              const targetUser = await registerCollection.findById(user._id);
              if (!targetUser) {
                throw new Error("User not found");
              }

              let updateField;
              let targetArray;

              // Determine which array to update based on the type
              switch (req.body.type) {
                case "monitoring":
                  updateField = "profile.monitoring";
                  targetArray = targetUser.profile.monitoring;
                  break;
                case "medsandsups":
                  updateField = "profile.medsandsups";
                  targetArray = targetUser.profile.medsandsups;
                  break;
                case "personalHistory":
                  updateField = "profile.personalHistory";
                  targetArray = targetUser.profile.personalHistory;
                  break;
                default:
                  updateField = "profile.familyHistory";
                  targetArray = targetUser.profile.familyHistory;
              }

              // // Remove the family history entry
              // targetUser.profile.familyHistory = targetUser.profile.familyHistory.filter(
              //     entry => entry._id.toString() !== entryId
              // );

              // Filter out the entry to be deleted
              const filteredArray = targetArray.filter(
                (entry) => entry._id.toString() !== entryId
              );

              // Use findOneAndUpdate instead of save to avoid version conflicts
              const updatedUser = await registerCollection.findOneAndUpdate(
                { _id: user._id },
                { $set: { [updateField]: filteredArray } },
                // { $set: { 'profile.familyHistory': targetUser.profile.familyHistory } },
                { new: true } // This option returns the updated document
              );

              if (!updatedUser) {
                throw new Error("Failed to update user");
              }

              // Update the local user object to match
              user.profile[updateField.split(".")[1]] =
                updatedUser.profile[updateField.split(".")[1]];
              // user.profile.familyHistory = updatedUser.profile.familyHistory;

              console.log("Delete operation completed");
              console.log(
                `${updateField} after:`,
                updatedUser.profile[updateField.split(".")[1]]
              );
              // console.log('Family history after:', updatedUser.profile.familyHistory);

              // No need to call save() again
            } catch (error) {
              console.error("Error deleting entry:", error);
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
        case "add":
          if (habitType && status) {
            user.profile.lifestyle.push({
              habitType,
              status: status,
              lifestyleNotes: lifestyleNotes || "",
            });
          }
          break;

        case "edit":
          if (entryId && habitType && status) {
            const entryIndex = user.profile.lifestyle.findIndex(
              (entry) => entry._id.toString() === entryId
            );
            if (entryIndex !== -1) {
              user.profile.lifestyle[entryIndex].habitType = habitType;
              user.profile.lifestyle[entryIndex].status = status;
              user.profile.lifestyle[entryIndex].lifestyleNotes =
                lifestyleNotes || "";
            }
          }
          break;

        case "delete":
          if (entryId) {
            try {
              console.log("Attempting to delete entry with ID:", entryId);

              // Find the most recent version of the user
              const targetUser = await registerCollection.findById(user._id);
              if (!targetUser) {
                throw new Error("User not found");
              }

              console.log("Lifestyle before:", targetUser.profile.lifestyle);

              // Remove the family history entry
              targetUser.profile.lifestyle =
                targetUser.profile.lifestyle.filter(
                  (entry) => entry._id.toString() !== entryId
                );

              // Use findOneAndUpdate instead of save to avoid version conflicts
              const updatedUser = await registerCollection.findOneAndUpdate(
                { _id: user._id },
                { $set: { "profile.lifestyle": targetUser.profile.lifestyle } },
                { new: true } // This option returns the updated document
              );

              if (!updatedUser) {
                throw new Error("Failed to update user");
              }

              // Update the local user object to match
              user.profile.lifestyle = updatedUser.profile.lifestyle;

              console.log("Delete operation completed");
              console.log("Lifestyle after:", updatedUser.profile.lifestyle);

              // No need to call save() again
            } catch (error) {
              console.error("Error deleting entry:", error);
              throw new Error(
                "Failed to delete lifestyle entry: " + error.message
              );
            }
          }
          break;
      }
    }

    // Handle meds & sups updates
    // if (action) {
    //   switch (action) {
    //     case "add":
    //       if (medSupType && name) {  // Use the correct field names
    //         user.profile.medsandsups.push({
    //           type: medSupType,        // Map medSupType to type
    //           name: name,              // Use name directly
    //           dosage: dosage || "",
    //           frequency: frequency || "",
    //           notes: notes || ""       // Use notes (not medsAndSupsNotes)
    //         });
    //       }
    //       break;

    //     case "edit":
    //       if (entryId && medSupType && name) {  // Use correct field names
    //         const medsAndSupsIndex = user.profile.medsandsups.findIndex(
    //           (entry) => entry._id.toString() === entryId
    //         );
    //         if (medsAndSupsIndex !== -1) {
    //           user.profile.medsandsups[medsAndSupsIndex].type = medSupType;      // Map correctly
    //           user.profile.medsandsups[medsAndSupsIndex].name = name;            // Use name directly
    //           user.profile.medsandsups[medsAndSupsIndex].dosage = dosage || "";
    //           user.profile.medsandsups[medsAndSupsIndex].frequency = frequency || "";
    //           user.profile.medsandsups[medsAndSupsIndex].notes = notes || "";    // Use notes
    //         }
    //       }
    //       break;

    //     case "delete":
    //       if (entryId) {
    //         try {
    //           console.log("Attempting to delete entry with ID:", entryId);

    //           // Find the most recent version of the user
    //           const targetUser = await registerCollection.findById(user._id);
    //           if (!targetUser) {
    //             throw new Error("User not found");
    //           }

    //           let updateField;
    //           let targetArray;

    //           // Determine which array to update based on the type
    //           switch (req.body.type) {
    //             case "monitoring":
    //               updateField = "profile.monitoring";
    //               targetArray = targetUser.profile.monitoring;
    //               break;
    //             case "medsandsups":
    //               updateField = "profile.medsandsups";
    //               targetArray = targetUser.profile.medsandsups;
    //               break;
    //             default:
    //               updateField = "profile.familyHistory";
    //               targetArray = targetUser.profile.familyHistory;
    //           }

    //           // Filter out the entry to be deleted
    //           const filteredArray = targetArray.filter(
    //             (entry) => entry._id.toString() !== entryId
    //           );

    //           // Use findOneAndUpdate instead of save to avoid version conflicts
    //           const updatedUser = await registerCollection.findOneAndUpdate(
    //             { _id: user._id },
    //             { $set: { [updateField]: filteredArray } },
    //             { new: true }
    //           );

    //           if (!updatedUser) {
    //             throw new Error("Failed to update user");
    //           }

    //           // Update the local user object to match
    //           user.profile[updateField.split(".")[1]] =
    //             updatedUser.profile[updateField.split(".")[1]];

    //           console.log("Delete operation completed");
    //           console.log(
    //             `${updateField} after:`,
    //             updatedUser.profile[updateField.split(".")[1]]
    //           );
    //         } catch (error) {
    //           console.error("Error deleting entry:", error);
    //           throw new Error(`Failed to delete entry: ${error.message}`);
    //         }
    //       }
    //       break;
    //   }
    // }

    // Calculate and set age
    user.profile.age = user.calculateAge();

    // Before saving:
    console.log("About to save user with updated profile:", {
      monitoring: user.profile.monitoring,
    });

    // Save the updated user
    await user.save();

    // After saving:
    console.log("Save completed successfully");

    res.json({
      success: true,
      age: user.profile.age,
      bloodType: user.profile.bloodType,
      customBloodType: user.profile.customBloodType,
      sex: user.profile.sex,
      personalHistory: user.profile.personalHistory,
      familyHistory: user.profile.familyHistory,
      lifestyle: user.profile.lifestyle,
      monitoring: user.profile.monitoring,
      medsandsups: user.profile.medsandsups,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
});

// Configure MULTER for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(__dirname, "../public/uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter to only allow PDFs and images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only PDF, JPEG, and PNG files are allowed."
      ),
      false
    );
  }
};

// const upload = multer({
//   storage: storage,
//   fileFilter: fileFilter,
//   limits: {
//     fileSize: 200 * 1024 * 1024, // 200MB limit
//   },
// });

// This import will automatically use whichever OCR implementation is configured
const { extractFromPDF } = require('./parsers');

app.post(
  "/upload-files",
  checkAuth,
  upload.array("files"),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No files were uploaded.",
        });
      }

      const user = await registerCollection.findById(req.user._id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const uploadedFiles = [];
      const totalFiles = req.files.length;

      console.log(`Processing ${totalFiles} files in ${isVercel ? 'Vercel' : 'local'} environment`);

      for (let fileIndex = 0; fileIndex < req.files.length; fileIndex++) {
        console.log(`Processing file ${fileIndex + 1} of ${totalFiles}`);

        const file = req.files[fileIndex];
        
        try {
          // Use the hybrid processing function
          const fileObject = await processUploadedFile(file, extractFromPDF);
          uploadedFiles.push(fileObject);

        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
          
          uploadedFiles.push({
            filename: file.filename || file.originalname,
            originalName: file.originalname,
            path: isVercel ? null : (file.path || null),
            size: file.size,
            mimetype: file.mimetype,
            uploadDate: new Date(),
            testDate: null,
            labValues: {},
            extractionMethod: "failed",
            processingErrors: [error.message],
          });
        }
      }

      // Save to database
      if (!user.files) {
        user.files = [];
      }

      user.files.push(...uploadedFiles);
      console.log("Saving files count:", uploadedFiles.length);

      await user.save();
      console.log("Files saved successfully");

      // Return success response with environment info
      res.json({
        success: true,
        message: "Files uploaded and processed successfully",
        files: uploadedFiles,
        environment: isVercel ? 'production' : 'development',
        processedCount: uploadedFiles.filter(f => f.extractionMethod !== 'failed').length,
        failedCount: uploadedFiles.filter(f => f.extractionMethod === 'failed').length
      });

    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({
        success: false,
        message: "Error processing files",
        error: error.message,
        environment: isVercel ? 'production' : 'development'
      });
    }
  }
);

// Add this route to src/index.js
app.post("/delete-selected-files", checkAuth, async (req, res) => {
  try {
    const { fileIds } = req.body;
    
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ success: false, message: "No file IDs provided" });
    }
    
    const user = await registerCollection.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Get the files to delete their physical files
    const filesToDelete = user.files.filter(file => fileIds.includes(file._id.toString()));
    
    // Delete physical files
    filesToDelete.forEach(file => {
      const filePath = path.join(__dirname, "../public/uploads", file.filename);
      fs.unlink(filePath, (err) => {
        if (err && err.code !== "ENOENT") {
          console.error(`Error deleting file ${file.filename}:`, err);
        }
      });
    });
    
    // Remove files from user's files array
    user.files = user.files.filter(file => !fileIds.includes(file._id.toString()));
    
    await user.save();
    
    res.json({ success: true, message: `${fileIds.length} files deleted successfully` });
  } catch (error) {
    console.error("Error deleting files:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Use the enhanced error handler
app.use(multerErrorHandler);

// production version
app.post("/delete-file", checkAuth, async (req, res) => {
  try {
    const { fileId } = req.body;
    const user = await registerCollection.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Find the file to get its filename
    const fileToDelete = user.files.id(fileId);
    if (!fileToDelete) {
      return res.status(404).json({ 
        success: false, 
        message: "File not found" 
      });
    }

    // Only try to delete physical files in local environment
    if (!isVercel && fileToDelete.path) {
      const filePath = path.join(__dirname, "../public/uploads", fileToDelete.filename);
      fs.unlink(filePath, (err) => {
        if (err && err.code !== "ENOENT") {
          console.error(`Error deleting file ${fileToDelete.filename}:`, err);
        } else {
          console.log(`Successfully deleted file: ${fileToDelete.filename}`);
        }
      });
    } else {
      console.log(`Skipping physical file deletion in Vercel environment`);
    }

    // Remove file from user's files array (this always works)
    user.files.pull(fileId);
    await user.save();

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// local version
// app.post("/delete-file", checkAuth, async (req, res) => {
//   try {
//     const { fileId } = req.body;
//     const user = await registerCollection.findById(req.user._id);

//     if (!user) {
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });
//     }

//     // Find the file to get its filename
//     const fileToDelete = user.files.id(fileId);
//     if (!fileToDelete) {
//       return res
//         .status(404)
//         .json({ success: false, message: "File not found" });
//     }

//     // Delete the physical file
//     const filePath = path.join(
//       __dirname,
//       "../public/uploads",
//       fileToDelete.filename
//     );
//     fs.unlink(filePath, (err) => {
//       if (err && err.code !== "ENOENT") {
//         console.error("Error deleting file:", err);
//       }
//     });

//     // Remove file from user's files array
//     user.files.pull(fileId);

//     await user.save();

//     res.json({ success: true });
//   } catch (error) {
//     console.error("Error deleting file:", error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

app.post("/update-biomarker", checkAuth, async (req, res) => {
  try {
    const { fileId, biomarkerName, value, unit, referenceRange } = req.body;
    console.log("Update biomarker request:", {
      fileId,
      biomarkerName,
      value,
      unit,
      referenceRange,
    });

    const user = await registerCollection.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const file = user.files.id(fileId);
    if (!file) {
      console.log("File not found with ID:", fileId);
      console.log(
        "Available files:",
        user.files.map((f) => f._id)
      );
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
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
          confidenceLevel: "high",
        },
      },
    };

    const result = await registerCollection.findOneAndUpdate(
      {
        _id: user._id,
        "files._id": fileId,
      },
      updateQuery,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!result) {
      throw new Error("Failed to update document");
    }

    console.log("Biomarker updated successfully");

    res.json({
      success: true,
      message: "Biomarker updated successfully",
    });
  } catch (error) {
    console.error("Error updating biomarker:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.post("/delete-biomarker", checkAuth, async (req, res) => {
  try {
    const { fileId, biomarkerName } = req.body;
    console.log("Delete biomarker request:", { fileId, biomarkerName });

    const user = await registerCollection.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const file = user.files.id(fileId);
    if (!file) {
      console.log("File not found with ID:", fileId);
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    // Delete the biomarker using MongoDB's unset operator
    const updateQuery = {
      $unset: {
        [`files.$.labValues.${biomarkerName}`]: 1,
      },
    };

    const result = await registerCollection.findOneAndUpdate(
      {
        _id: user._id,
        "files._id": fileId,
      },
      updateQuery,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!result) {
      throw new Error("Failed to update document");
    }

    console.log("Biomarker deleted successfully");

    res.json({
      success: true,
      message: "Biomarker deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting biomarker:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.post("/update-file-details", checkAuth, async (req, res) => {
  try {
    const { fileId, fileName, uploadDate, testDate } = req.body;
    console.log("Update file details request:", {
      fileId,
      fileName,
      uploadDate,
      testDate,
    });

    const user = await registerCollection.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const file = user.files.id(fileId);
    if (!file) {
      console.log("File not found with ID:", fileId);
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    // Update file details
    file.originalName = fileName;
    file.uploadDate = new Date(uploadDate);
    file.testDate = new Date(testDate);

    await user.save();
    console.log("File details updated successfully");

    res.json({
      success: true,
      message: "File details updated successfully",
    });
  } catch (error) {
    console.error("Error updating file details:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Feedback API endpoint
app.post("/api/feedback", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    // Create new feedback entry
    const feedback = new feedbackCollection({
      name,
      email,
      message,
    });

    // Save to database
    await feedback.save();

    // Send email notification using Resend
    const { data, error } = await resend.emails.send({
      from: "HealthLync <onboarding@resend.dev>", // Use this during testing
      //from: "HealthLync Feedback <feedback@yourdomain.com>", // Use your verified domain in Resend
      to: ["markbuckle92@gmail.com"],
      subject: "New HealthLync Feedback Received",
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e6f0; border-radius: 8px;">
          <h2 style="color: #5cb15d;">New Feedback Received</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Message:</strong> ${message}</p>
          <hr style="border: none; border-top: 1px solid #e1e6f0; margin: 20px 0;">
          <p style="color: #888; font-size: 12px;">This is an automated message from your HealthLync feedback system.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend API error:", error);
      // Still return success to the user if the feedback was saved to DB
      // You might want to log this error or handle it differently
      return res.status(201).json({ success: true, emailSent: false });
    }

    res.status(201).json({ success: true, emailSent: true });
  } catch (error) {
    console.error("Error processing feedback:", error);
    res
      .status(500)
      .json({ success: false, message: "Error processing feedback" });
  }
});

// Update the user context endpoint
app.post('/api/rag/context', checkAuth, async (req, res) => {
  console.log('🔍 USER CONTEXT ENDPOINT CALLED');
  console.log('🔍 User ID:', req.user._id);
  
  try {
    const user = await registerCollection.findById(req.user._id);
    console.log('🔍 User found:', !!user);
    
    if (!user) {
      console.log('❌ User not found in database');
      return res.status(404).json({ error: 'User not found' });
    }
    
    let personalHistoryDetails = [];
    if (user.profile?.personalHistory && Array.isArray(user.profile.personalHistory)) {
      personalHistoryDetails = user.profile.personalHistory
        .filter(item => item && item.personalCondition)
        .map(item => ({
          condition: item.personalCondition,
          notes: item.personalNotes || 'No notes'
        }));
    }

    // Extract family history with full details
    let familyHistoryDetails = [];
    if (user.profile?.familyHistory && Array.isArray(user.profile.familyHistory)) {
      familyHistoryDetails = user.profile.familyHistory
        .filter(item => item && item.familyCondition)
        .map(item => ({
          condition: item.familyCondition,
          relatives: item.relatives || 'Not specified',
          notes: item.addNotes || 'No notes'
        }));
    }
    
    // Extract lifestyle with full details
    let lifestyleDetails = [];
    if (user.profile?.lifestyle && Array.isArray(user.profile.lifestyle)) {
      lifestyleDetails = user.profile.lifestyle
        .filter(item => item && item.habitType)
        .map(item => ({
          habitType: item.habitType,
          status: item.status || 'Not specified',
          notes: item.lifestyleNotes || 'No notes'
        }));
    }
    
    // Extract medications with full details
    let medicationDetails = [];
    if (user.profile?.medsandsups && Array.isArray(user.profile.medsandsups)) {
      medicationDetails = user.profile.medsandsups
        .filter(item => item && (item.medicine || item.supplement || item.name))
        .map(item => ({
          name: item.medicine || item.supplement || item.name,
          type: item.medSupType || (item.medicine ? 'Medicine' : 'Supplement'),
          dosage: item.dosage || 'Not specified',
          frequency: item.frequency || 'Not specified',
          notes: item.medsAndSupsNotes || item.notes || 'No notes'
        }));
    }
    
    // Extract monitoring with full details
    let monitoringDetails = [];
    if (user.profile?.monitoring && Array.isArray(user.profile.monitoring)) {
      monitoringDetails = user.profile.monitoring
        .filter(item => item)
        .map(item => ({
          weight: item.weight || 'Not specified',
          bloodPressure: item.bloodPressure || 'Not specified',
          restingHeartRate: item.restingHeartRate || 'Not specified',
          sleep: item.sleep || 'Not specified',
          notes: item.monitoringNotes || 'No notes'
        }));
    }
    
    console.log('🔍 Detailed family history:', familyHistoryDetails);
    console.log('🔍 Detailed lifestyle:', lifestyleDetails);
    console.log('🔍 Detailed medications:', medicationDetails);
    console.log('🔍 Detailed monitoring:', monitoringDetails);
    
    // Extract relevant user data for RAG
    const userContext = {
      userId: user._id,
      profile: {
        age: user.profile?.age,
        sex: user.profile?.sex,
        bloodType: user.profile?.bloodType,
        familyHistoryDetails: familyHistoryDetails,
        personalHistoryDetails: personalHistoryDetails,
        lifestyleDetails: lifestyleDetails,
        medicationDetails: medicationDetails,
        monitoringDetails: monitoringDetails
      },
      recentLabValues: extractRecentLabValues(user.files || []),
      healthConcerns: identifyHealthConcerns(user)
    };
    
    console.log('🔍 User context prepared:', JSON.stringify(userContext, null, 2));
    res.json({ userContext });
  } catch (error) {
    console.error('❌ Error in user context endpoint:', error);
    res.status(500).json({ error: 'Failed to prepare user context', details: error.message });
  }
});

// Helper function to extract recent lab values
function extractRecentLabValues(files) {
  try {
    if (!files || files.length === 0) return {};
    
    const recentFiles = files
      .filter(f => f.labValues && Object.keys(f.labValues).length > 0)
      .sort((a, b) => new Date(b.testDate) - new Date(a.testDate))
      .slice(0, 3); // Last 3 lab results
      
    const labSummary = {};
    recentFiles.forEach(file => {
      try {
        // Handle both Map and Object formats for labValues
        const entries = file.labValues instanceof Map ? 
          Array.from(file.labValues.entries()) : 
          Object.entries(file.labValues);
          
        entries.forEach(([key, value]) => {
          labSummary[key] = {
            value: value.value,
            unit: value.unit,
            referenceRange: value.referenceRange,
            date: file.testDate
          };
        });
      } catch (fileError) {
        console.error('Error processing file:', fileError);
      }
    });
    
    return labSummary;
  } catch (error) {
    console.error('Error extracting lab values:', error);
    return {};
  }
}

// Helper function to identify health concerns
function identifyHealthConcerns(user) {
  try {
    const concerns = [];
    
    if (user.profile?.familyHistory?.length > 0) {
      concerns.push('family_history_risk');
    }
    
    // Add more concern identification logic here
    
    return concerns;
  } catch (error) {
    console.error('Error identifying health concerns:', error);
    return [];
  }
}

app.get('/api/test-endpoint', (req, res) => {
  console.log('🧪 Test endpoint called successfully!');
  res.json({ message: 'Test endpoint working' });
});

app.use("/api/rag", ragRoutes);

server.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
  
  // Test Together AI status
  const { checkTogetherAIStatus } = require('./db/chatService');
  const togetherStatus = await checkTogetherAIStatus();
  
  if (togetherStatus.working) {
    console.log("✅ Together AI is working");
    console.log(`🤖 Using model: ${togetherStatus.model}`);
  } else {
    console.log("❌ Together AI error:", togetherStatus.error);
    console.log("💡 Check your TOGETHER_API_KEY in .env file");
  }
});

// Add this function after your imports but before server.listen
// async function testHuggingFaceToken() {
//   try {
//     const response = await fetch("https://huggingface.co/api/whoami", {
//       headers: {
//         Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
//       },
//     });
    
//     const result = await response.text();
//     console.log("Token test status:", response.status);
//     console.log("Token test result:", result);
    
//     return response.ok;
//   } catch (error) {
//     console.error("Token test failed:", error);
//     return false;
//   }
// }

// Change from app.listen to server.listen at the end of the file
// server.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });

// app.listen(port, () => {
//     console.log(`Server is running on port ${port}`);
// });
