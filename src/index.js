const express = require("express");
const path = require("path");
const hbs = require("hbs");
const { registerCollection } = require("./mongodb");
const port = process.env.PORT || 3000;
const templatePath = path.join(__dirname, '../templates');
const publicPath = path.join(__dirname, '../public');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set("view engine", 'hbs');
app.set("views", templatePath);
app.use(express.static(publicPath))
// hbs.registerPartials(partialPath)

// home/landing page
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

app.get('/reports', (req, res) => {
    res.render('user/reports');
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

        res.status(201).render("login", {
            naming: req.body.uname
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred during registration");
    }
});

app.post('/login', async (req, res) => {
    try {
        const user = await registerCollection.findOne({ uname: req.body.uname });

        if (!user) {
            return res.status(400).send("User not found");
        }

        if (user.password === req.body.password) {
            res.status(200).render("user/reports", { naming: user.uname });
        } else {
            res.status(400).send("Incorrect password");
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred during login");
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});