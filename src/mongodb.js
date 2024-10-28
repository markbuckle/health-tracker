const mongoose = require("mongoose");

// Cache the database connection
let cachedConnection = null;

const connectToDatabase = async () => {
    if (cachedConnection) {
        return cachedConnection;
    }

    const mongoURI = process.env.DB_STRING || "mongodb://localhost:27017/HealthLyncDatabase";
    
    try {
        const connection = await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
            socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
        });
        
        console.log("MongoDB connected");
        cachedConnection = connection;
        return connection;
    } catch (err) {
        console.error("Failed to connect to MongoDB:", err);
        throw err;
    }
};

const registerSchema = new mongoose.Schema({
    fname: {
        type: String,
        required: true,
        trim: true // Add trim for clean data
    },
    lname: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true // Ensure email is always lowercase
    },
    uname: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    }
}, { 
    timestamps: true
});

// Add indexes for frequently queried fields
registerSchema.index({ email: 1 });
registerSchema.index({ uname: 1 });

// Add methods for better error handling
registerSchema.statics.findByUsername = function(username) {
    return this.findOne({ uname: username });
};

const registerCollection = mongoose.model("User", registerSchema);

module.exports = { 
    connectToDatabase,
    registerCollection 
};