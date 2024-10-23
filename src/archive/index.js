const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const port = process.env.PORT || 3000;
const publicPath = path.join(__dirname, '../public');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(publicPath));

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

const User = mongoose.model("User", registerSchema);

app.get('../public/register.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'register.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'login.html'));
});

app.get('/index', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.post('../public/register.html', async (req, res) => {
    const { fname, lname, email, uname, password, confirmPassword } = req.body;

    try {
        const existingUser = await User.findOne({ uname: uname });

        if (existingUser) {
            return res.status(400).json({ message: "Username already exists" });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match" });
        }

        const newUser = new User({
            fname,
            lname,
            email,
            uname,
            password // Note: In a real application, you should hash this password
        });

        await newUser.save();

        res.status(201).json({ message: "Registration successful" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "An error occurred during registration" });
    }
});

app.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ uname: req.body.uname });

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        if (user.password === req.body.password) {
            res.status(200).json({ message: "Login successful" });
        } else {
            res.status(400).json({ message: "Incorrect password" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "An error occurred during login" });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});