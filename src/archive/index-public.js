const express = require("express");
const path = require("path");
const { registerCollection } = require("./mongodb-public");
const port = process.env.PORT || 3000;
const publicPath = path.join(__dirname, '../public');
// console.log(publicPath);

// const hbs = require("hbs"); // Turn this off if connecting to html files
// const templatePath = path.join(__dirname, '../templates');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(express.static(publicPath));
// app.set("view engine", 'hbs');
// app.set("views", templatePath);
// hbs.registerPartials(partialPath)

app.get('../public/register.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'register.html'));
    // res.render('register'); // hbs link
});

app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'login.html'));
    // res.render('login'); // hbs link
});

app.get('/index', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
    // res.render('index'); // hbs link
});

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

        res.status(201).redirect('/index');
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
            res.status(200).redirect('/index');
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