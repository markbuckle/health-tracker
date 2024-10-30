const express = require("express");
const path = require("path");
const hbs = require("hbs");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const { registerCollection } = require("./mongodb");
const port = process.env.PORT || 3000;
const templatePath = path.join(__dirname, '../templates');
const publicPath = path.join(__dirname, '../public');
require('dotenv').config();
// const port = process.env.PORT || 8080;
// const templatePath = path.join(__dirname, process.env.NODE_ENV === 'production'
//   ? '../public/templates' 
//   : '../templates');

// express app setup
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set("view engine", 'hbs');
app.set("views", templatePath);
// If you want to use partials, uncomment this line and specify the correct path
// const partialsPath = path.join(__dirname, '../templates/partials');
// hbs.registerPartials(partialPath)

// Add proxy trust for Vercel
app.set('trust proxy', 1);
app.use(session(sessionConfig));

// Add error handling for static files
app.use(express.static(publicPath));

// Session setup - MUST come before passport middleware
if (!process.env.SESSION_SECRET) {
    console.error('SESSION_SECRET is not set in environment variables');
    process.exit(1);
}
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true, // Prevent XSS attacks
        sameSite: 'lax'
    },
    name: 'sessionId', // session cookie security
    rolling: true // Extends session lifetime on activity
}));

// Add this right after your session middleware to check if sessions are working
app.use((req, res, next) => {
    console.log('Session ID:', req.sessionID);
    console.log('Session data:', req.session);
    next();
});

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({
    usernameField: 'uname',  // specify the field names from your form
    passwordField: 'password'
},
async (username, password, done) => {
    try {
        console.log('Searching for user in database:', username);
        const user = await registerCollection.findOne({ uname: username });

        if (!user) {
            console.log('User not found in database');
            return done(null, false, { message: 'User not found' });
        }
        // In production, use proper password hashing comparison
        if (user.password !== password) {
            console.log('Password mismatch');
            return done(null, false, { message: 'Incorrect password' });
        }
        console.log('User authenticated successfully');
        return done(null, user);
    } catch (error) {
        console.error('Database error during authentication:', error);
        return done(error);
    }
}));

passport.serializeUser((user, done) => {
    console.log('Serializing user:', user._id);
    done(null, user._id); // Use _id for MongoDB
});

passport.deserializeUser(async (id, done) => {
    try {
        console.log('Deserializing user ID:', id);
        const user = await registerCollection.findById(id);
        done(null, user);
    } catch (error) {
        console.error('Error deserializing user:', error);
        done(error);
    }
});

// Authentication middleware
function checkAuth(req, res, next) {
    console.log('CheckAuth - Session:', req.session);
    console.log('CheckAuth - User:', req.user);
    console.log('CheckAuth - IsAuthenticated:', req.isAuthenticated());

    if (req.isAuthenticated()) { // or use your own custom authentication check
        return next();
    } else {
         // Store the intended destination
        req.session.returnTo = req.originalUrl;
        console.log('Not authenticated, redirecting to login');
        return res.redirect('/login');
    }
}

// Routes
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

app.get('/profile', checkAuth, (req, res) => {
    res.render('user/profile', { 
        fname: req.user.fname, 
        lname: req.user.lname,
        user: req.user  // passing the entire user object
    });
});

app.get('/upload', checkAuth, (req, res) => {
    res.render('user/upload', { naming: req.user.uname });
});

app.get('/reports', checkAuth, (req, res) => {
    res.render('user/reports', { naming: req.user.uname });
});

app.get('/dashboard', checkAuth, (req, res) => {
    res.render('user/dashboard', { naming: req.user.uname });
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

        res.status(201).render("auth/login", {
            naming: req.body.uname
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred during registration");
    }
});

// Login logic
app.post('/login', (req, res, next) => {
    console.log('Login attempt received for username:', req.body.uname);
        
        passport.authenticate('local', function(err, user, info) {
            if (err) {
                console.error('Authentication error:', err);
                return next(err);
            }
            
            if (!user) {
                console.log('Authentication failed:', info);
                return res.status(401).redirect('/login');
            }
            
            req.logIn(user, function(err) {
                if (err) {
                    console.error('Login error:', err);
                    return next(err);
                }
                console.log('Login successful for user:', user.uname);
                console.log('Session after login:', req.session);

                // return res.status(302).redirect('/reports');

                // Ensure session is saved before redirect
                req.session.save((err) => {
                    if (err) {
                        console.error('Session save error:', err);
                        return next(err);
                    }
                    const returnTo = req.session.returnTo || '/reports';
                    delete req.session.returnTo;
                    return res.redirect(returnTo);
                });
            });
        })(req, res, next);
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        message: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong!' 
            : err.message
    });
});

// 404 handler
app.use((req, res) => {
    // res.status(404).render('404');
    try {
        res.status(404).render('404', {}, (err, html) => {
            if (err) {
                console.error('Error rendering 404 template:', err);
                res.status(404).send('404 - Page Not Found');
            } else {
                res.send(html);
            }
        });
    } catch (err) {
        console.error('Error in 404 handler:', err);
        res.status(404).send('404 - Page Not Found');
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});