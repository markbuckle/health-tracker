const mongoose = require("mongoose");

mongoose.connect("mongodb://localhost:27017/HealthLyncDatabase")
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((err) => {
        console.log("Failed to connect to MongoDB:", err);
    });

const registerSchema = new mongoose.Schema({
    fname: { type: String, required: true },
    lname: { type: String, required: true },
    email: { type: String, required: true },
    uname: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const registerCollection = mongoose.model("User", registerSchema);

module.exports = { registerCollection };