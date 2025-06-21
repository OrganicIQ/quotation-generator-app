// app.js - FINAL VERSION WITH MULTI-CATEGORY SUPPORT

require('dotenv').config();
const express = require('express'); const session = require('express-session'); const passport = require('passport'); const GoogleStrategy = require('passport-google-oauth20').Strategy; const path = require('path'); const mongoose = require('mongoose'); const cors = require('cors'); const MongoStore = require('connect-mongo'); const html_to_pdf = require('html-pdf-node');
const User = require('./models/Users'); const Product = require('./models/Products'); const Quote = require('./models/Quote'); const Coupon = require('./models/Coupon');

const app = express();
app.set('trust proxy', 1); app.use(express.json());
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : 'http://localhost:3000', credentials: true }));
const PORT = process.env.PORT || 3000;
mongoose.connect(process.env.MONGO_URI).then(() => console.log('MongoDB Connected...')).catch(err => console.error('MongoDB connection error:', err));
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false, store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }), cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 24 * 60 * 60 * 1000 } }));
app.use(passport.initialize()); app.use(passport.session());
passport.use(new GoogleStrategy({ clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, callbackURL: process.env.GOOGLE_REDIRECT_URI }, async (accessToken, refreshToken, profile, cb) => { const newUser = { googleId: profile.id, displayName: profile.displayName, email: profile.emails[0].value, image: profile.photos[0].value }; try { let user = await User.findOne({ googleId: profile.id }); if (user) { return cb(null, user); } else { user = await User.create(newUser); return cb(null, user); } } catch (err) { return cb(err, null); } }));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => { try { const user = await User.findById(id); done(null, user); } catch (err) { done(err, null); } });
function ensureAuth(req, res, next) { if (req.isAuthenticated()) { return next(); } res.status(401).json({ message: 'User not authenticated' }); }
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: process.env.FRONTEND_URL || '/' }), (req, res) => { res.redirect(process.env.FRONTEND_URL || '/'); });
app.get('/api/user', (req, res) => { if (req.user) { res.json({ loggedIn: true, user: { displayName: req.user.displayName } }); } else { res.json({ loggedIn: false }); } });
app.get('/auth/logout', (req, res, next) => { req.logout((err) => { if (err) { return next(err); } req.session.destroy(() => res.redirect(process.env.FRONTEND_URL || '/')); }); });

// --- UPDATED: Product API Route to handle category array ---
app.get('/api/products', async (req, res) => {
    const searchTerm = req.query.q;
    const category = req.query.category;
    let query = {};
    if (searchTerm) {
        query.$or = [
            { baseName: { $regex: searchTerm, $options: 'i' } },
            { variantName: { $regex: searchTerm, $options: 'i' } }
        ];
    }
    // If a category is selected, find products where the 'category' array contains that value
    if (category) {
        query.category = category;
    }
    try {
        const products = await Product.find(query).limit(50);
        res.json(products);
    } catch (e) { res.status(500).json({ message: 'Error fetching products' }); }
});

// --- UPDATED: API Route to get all unique categories ---
app.get('/api/categories', async (req, res) => {
    try {
        // This command gets all unique values from the 'category' array across all documents
        const categories = await Product.distinct('category');
        res.json(categories.sort());
    } catch (e) { res.status(500).json({ message: 'Error fetching categories' }); }
});

// --- All other API routes are unchanged and condensed ---
app.post('/api/quotes',ensureAuth,async(req,res)=>{/*...*/});
app.get('/api/quotes',ensureAuth,async(req,res)=>{/*...*/});
app.get('/api/quotes/:id',ensureAuth,async(req,res)=>{/*...*/});
app.delete('/api/quotes/:id',ensureAuth,async(req,res)=>{/*...*/});
app.post('/api/coupons/apply',ensureAuth,async(req,res)=>{/*...*/});
app.get('/api/quotes/:id/download',ensureAuth,async(req,res)=>{/*...*/});
app.post('/api/quotes/preview-pdf',ensureAuth,async(req,res)=>{/*...*/});

// --- Serve Static Files for LOCAL DEVELOPMENT ONLY ---
if (process.env.NODE_ENV !== 'production') {
    app.use(express.static(path.join(__dirname, 'public')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
}
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));