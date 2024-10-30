const mongoose = require("mongoose");

const mongoURI = process.env.DB_STRING || "mongodb://localhost:27017/HealthLyncDatabase";

// Connect with options
mongoose.connect(mongoURI, mongooseOptions)
    .then(() => {
        console.log("MongoDB connected successfully");
    })
    .catch((err) => {
        console.error("Failed to connect to MongoDB:", err);
        process.exit(1);
    });

// Add connection monitoring
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
});

// Your existing schema definition
const registerSchema = new mongoose.Schema({
    fname: {
        type: String,
        required: true
    },
    lname: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    uname: {
        type: String,
        required: true,
        unique: true
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

// Add a method to help with user authentication
registerSchema.statics.findByUsername = function(username) {
    return this.findOne({ uname: username })
        .exec()
        .then(user => {
            if (!user) {
                console.log('No user found with username:', username);
            }
            return user;
        })
        .catch(err => {
            console.error('Error finding user by username:', err);
            throw err;
        });
};

const registerCollection = mongoose.model("User", registerSchema);

// Export both the model and the connection
module.exports = { 
    registerCollection,
    connection: mongoose.connection // This can be useful for monitoring connection status
};