const mongoose = require("mongoose");

const mongoURI = process.env.DB_STRING || "mongodb://localhost:27017/HealthLyncDatabase";

mongoose.connect(mongoURI)
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((err) => {
        console.log("Failed to connect to MongoDB:", err);
        process.exit(1);
    });

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
    // # Remove confirmPassword from being stored (it's only needed for validation)
    // confirmPassword: {
    //     type: String,
    //     required: true
    // }
   },{ 
        timestamps: true // Adds createdAt and updatedAt field
});

// Add indexes for frequently queried fields
registerSchema.index({ email: 1 });
registerSchema.index({ uname: 1 });

const registerCollection = mongoose.model("User", registerSchema);

module.exports = { registerCollection };