// mongoDB.js

const mongoose = require("mongoose");

// Environment detection
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;
const isProduction = process.env.NODE_ENV === "production";

const mongoURI = process.env.DB_STRING || "mongodb://localhost:27017/HealthLyncDatabase";

console.log(`🌍 Environment: ${isVercel ? 'Vercel' : 'Local'} | Production: ${isProduction}`);

// Optimized connection options for serverless
const connectionOptions = {
  maxPoolSize: isVercel ? 1 : 10,
  minPoolSize: 0,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  retryReads: true,
  autoIndex: !isProduction,
  autoCreate: !isProduction,
};

// Connection management
let isConnected = false;
let connectionPromise = null;

async function connectToMongoDB() {
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('✅ Using existing MongoDB connection');
    return mongoose.connection;
  }

  if (connectionPromise) {
    console.log('⏳ Awaiting existing connection attempt...');
    return connectionPromise;
  }

  console.log('🔌 Attempting new MongoDB connection...');
  
  connectionPromise = mongoose.connect(mongoURI, connectionOptions);
  
  try {
    await connectionPromise;
    isConnected = true;
    console.log('✅ MongoDB connected successfully');
    
    // Only set up listeners once
    if (!mongoose.connection.listeners('error').length) {
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err.message);
        isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('📡 MongoDB disconnected');
        isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconnected');
        isConnected = true;
      });
    }
    
    return mongoose.connection;
    
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    isConnected = false;
    connectionPromise = null;
    
    // Don't exit process in serverless environment
    if (!isVercel) {
      throw error;
    }
    
    // In serverless, we want to retry on next request
    console.log('🔄 Connection will be retried on next request');
    throw error;
  }
}

// Initialize connection (but don't await it at module level)
if (!isVercel) {
  // Only auto-connect in local development
  connectToMongoDB().catch(err => {
    console.error('Initial MongoDB connection failed:', err.message);
    if (!isVercel) {
      process.exit(1);
    }
  });
}

const personalHistorySchema = new mongoose.Schema(
  {
    personalCondition: {
      type: String,
      default: null,
    },
    personalNotes: {
      type: String,
      default: null,
    },
  },
  { _id: true }
);

const familyHistorySchema = new mongoose.Schema(
  {
    familyCondition: {
      type: String,
      default: null,
    },
    relatives: [
      {
        type: String,
        default: null,
      },
    ],
    addNotes: {
      type: String,
      default: null,
    },
  },
  { _id: true }
);

const monitoringSchema = new mongoose.Schema(
  {
    weight: {
      type: String,
      default: null,
    },
    bloodPressure: {
      type: String,
      default: null,
    },
    restingHeartRate: {
      type: String,
      default: null,
    },
    sleep: {
      type: String,
      default: null,
    },
    monitoringNotes: {
      type: String,
      default: null,
    },
  },
  { _id: true }
);

const lifestyleSchema = new mongoose.Schema(
  {
    habitType: {
      type: String,
      default: null,
    },
    status: [
      {
        type: String,
        default: null,
      },
    ],
    lifestyleNotes: {
      type: String,
      default: null,
    },
  },
  { _id: true }
);

const medsAndSupsSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Medication", "Supplement"],
      required: true
    },
    name: {
      type: String,
      required: true
    },
    dosage: {
      type: String,
      default: null
    },
    frequency: {
      type: String,
      default: null
    },
    notes: {
      type: String,
      default: null
    }
  },
  { _id: true }
);

const profileSchema = new mongoose.Schema(
  {
    birthDate: {
      type: Date,
      default: null,
    },
    sex: {
      type: String,
      enum: ["Male", "Female", "Other"],
      default: null,
    },
    bloodType: {
      type: String,
      enum: [
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
      default: null,
    },
    customBloodType: {
      type: String,
      default: null,
    },
    age: {
      type: Number,
      default: null,
    },
    personalHistory: {
      type: [personalHistorySchema],
      default: [],
    },
    familyHistory: {
      type: [familyHistorySchema],
      default: [],
    },
    lifestyle: {
      type: [lifestyleSchema],
      default: [],
    },
    monitoring: {
      type: [monitoringSchema],
      default: [],
    },
    medsandsups: {
      type: [medsAndSupsSchema],
      default: [],
    },
  },
  { _id: false }
);

const labValueSchema = new mongoose.Schema(
  {
    value: Number,
    unit: String,
    rawText: String,
    referenceRange: String,
    confidence: Number,
    loincCode: String, // For future LOINC implementation
    normalizedValue: Number, // For future unit normalization
    normalizedUnit: String,
  },
  { _id: false }
);

const fileSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  path: String,
  size: Number,
  mimetype: String,
  uploadDate: {
    type: Date,
    default: Date.now,
  },
  testDate: {
    // Add this field
    type: Date,
    default: null,
  },
  extractionMethod: String, // 'pdfjs', 'doctr', or 'tesseract'
  labValues: {
    type: Map,
    of: labValueSchema,
  },
  processingErrors: [String],
});

// User Schema
const registerSchema = new mongoose.Schema(
  {
    fname: {
      type: String,
      required: true,
    },
    lname: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    uname: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    profile: {
      type: profileSchema,
      default: () => ({}),
    },
    files: [fileSchema],
  },
  {
    timestamps: false, // Adds createdAt and updatedAt field
  }
);

// Add indexes for frequently queried fields
registerSchema.index({ email: 1 });
registerSchema.index({ uname: 1 });

// Method to calculate age
registerSchema.methods.calculateAge = function () {
  if (!this.profile.birthDate) return null;

  const birthDate = new Date(this.profile.birthDate);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
};

// const registerCollection = mongoose.model("users", registerSchema);
const registerCollection = mongoose.model("User", registerSchema);


const feedbackSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const feedbackCollection = mongoose.model("Feedback", feedbackSchema);

module.exports = {
  connectToMongoDB,
  registerCollection,
  feedbackCollection,
  mongoose,
  isConnected: () => isConnected,
};
