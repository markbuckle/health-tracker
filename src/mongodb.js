// mongoDB.js

const mongoose = require("mongoose");

const mongoURI =
  process.env.DB_STRING || "mongodb://localhost:27017/HealthLyncDatabase";

mongoose
  .connect(mongoURI)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.log("Failed to connect to MongoDB:", err);
    process.exit(1);
  });

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
  registerCollection,
  feedbackCollection,
};
