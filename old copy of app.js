// app.js - FINAL VERSION WITH CATEGORY FILTER

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const MongoStore = require('connect-mongo');
const html_to_pdf = require('html-pdf-node');

const User = require('./models/Users');
const Product = require('./models/Products');
const Quote = require('./models/Quote');
const Coupon = require('./models/Coupon');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : 'http://localhost:3000',
    credentials: true
}));

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI).then(() => console.log('MongoDB Connected...')).catch(err => console.error('MongoDB connection error:', err));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// --- Passport, Auth Routes, etc. (condensed) ---
passport.use(new GoogleStrategy({ clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, callbackURL: process.env.GOOGLE_REDIRECT_URI }, async (accessToken, refreshToken, profile, cb) => { const newUser = { googleId: profile.id, displayName: profile.displayName, email: profile.emails[0].value, image: profile.photos[0].value }; try { let user = await User.findOne({ googleId: profile.id }); if (user) { return cb(null, user); } else { user = await User.create(newUser); return cb(null, user); } } catch (err) { return cb(err, null); } }));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => { try { const user = await User.findById(id); done(null, user); } catch (err) { done(err, null); } });
function ensureAuth(req, res, next) { if (req.isAuthenticated()) { return next(); } res.status(401).json({ message: 'User not authenticated' }); }
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: process.env.FRONTEND_URL || '/' }), (req, res) => { res.redirect(process.env.FRONTEND_URL || '/'); });
app.get('/api/user', (req, res) => { if (req.user) { res.json({ loggedIn: true, user: { displayName: req.user.displayName } }); } else { res.json({ loggedIn: false }); } });
app.get('/auth/logout', (req, res, next) => { req.logout((err) => { if (err) { return next(err); } req.session.destroy(() => res.redirect(process.env.FRONTEND_URL || '/')); }); });

// --- UPDATED: Product API Route to handle category filtering ---
app.get('/api/products', async (req, res) => {
    const searchTerm = req.query.q;
    const category = req.query.category; // Get category from query parameter

    let query = {};
    if (searchTerm) {
        query.$or = [
            { baseName: { $regex: searchTerm, $options: 'i' } },
            { variantName: { $regex: searchTerm, $options: 'i' } }
        ];
    }
    if (category) {
        query.category = category; // Add category to the query if it exists
    }

    try {
        const products = await Product.find(query).limit(50);
        res.json(products);
    } catch (e) {
        res.status(500).json({ message: 'Error fetching products' });
    }
});

// --- NEW: API Route to get all unique categories ---
app.get('/api/categories', async (req, res) => {
    try {
        // Find all distinct values in the 'category' field of the Product collection
        const categories = await Product.find().distinct('category');
        res.json(categories.sort()); // Send back the sorted list
    } catch (e) {
        res.status(500).json({ message: 'Error fetching categories' });
    }
});


// --- Other API Routes (quotes, coupons, PDFs) are condensed ---
app.post('/api/quotes',ensureAuth,async(req,res)=>{try{const qN=`Q-${Date.now()}`;const nQ=new Quote({quoteNumber:qN,user:req.user.id,...req.body});const sQ=await nQ.save();res.status(201).json(sQ)}catch(e){res.status(500).json({m:'E'})}});
app.get('/api/quotes',ensureAuth,async(req,res)=>{try{const q=await Quote.find({user:req.user.id}).sort({createdAt:-1});res.json(q)}catch(e){res.status(500).json({m:'E'})}});
app.get('/api/quotes/:id',ensureAuth,async(req,res)=>{try{const q=await Quote.findById(req.params.id).populate('lineItems.product');if(!q||q.user.toString()!==req.user.id)return res.status(404).json({m:'NF'});res.json(q)}catch(e){res.status(500).json({m:'E'})}});
app.delete('/api/quotes/:id',ensureAuth,async(req,res)=>{try{const q=await Quote.findById(req.params.id);if(!q||q.user.toString()!==req.user.id)return res.status(403).json({m:'NA'});await Quote.deleteOne({_id:req.params.id});res.json({m:'D'})}catch(e){res.status(500).json({m:'E'})}});
app.post('/api/coupons/apply',ensureAuth,async(req,res)=>{const{code}=req.body;if(!code){return res.status(400).json({m:'Code required.'})}try{const c=await Coupon.findOne({code:code.toUpperCase()});if(!c){return res.status(404).json({m:'Invalid'})}if(c.isUsed){return res.status(410).json({m:'Already used'})}c.isUsed=true;await c.save();res.json({m:`Success! ${c.discountPercentage}% discount applied.`,discountPercentage:c.discountPercentage})}catch(e){res.status(500).json({m:'Server error'})}});
app.get('/api/quotes/:id/download',ensureAuth,async(req,res)=>{/* ... PDF logic ... */ try{const q=await Quote.findById(req.params.id).populate('lineItems.product').populate('user');if(!q||q.user._id.toString()!==req.user.id){return res.status(404).send('Not Found')}const d=new Date(q.createdAt).toLocaleDateString();const i=q.lineItems.map((it,idx)=>{const bP=it.priceAtTime;const qty=it.quantity;const disc=it.discountPercentage;const dP=bP*(1-(disc/100));const t=dP*qty;const iNH=`<strong>${it.product.baseName} ${it.product.variantName||''}</strong><br><small style="color:#555;">${it.product.description||''}</small>`;return`<tr><td>${idx+1}</td><td>${iNH}</td><td>₹${bP.toFixed(2)}</td><td>${qty}</td><td>${disc}%</td><td>₹${dP.toFixed(2)}</td><td>₹${t.toFixed(2)}</td></tr>`}).join('');const tH=`...`;const hC=`<html>...PDF styles...<tbody>${i}</tbody>...`;const o={format:'A4',margin:{top:'0.5in',right:'0.5in',bottom:'0.5in',left:'0.5in'}};const pB=await html_to_pdf.generatePdf({content:hC},o);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename=Quote-${q.quoteNumber}.pdf`);res.send(pB)}catch(e){console.error(e);res.status(500).send('Error')}});
app.post('/api/quotes/preview-pdf',ensureAuth,async(req,res)=>{/* ... PDF logic ... */ try{const qD=req.body;const u=req.user;const d=new Date().toLocaleDateString();const disc=10;const i=qD.lineItems.map((it,idx)=>{const bP=it.price;const qty=it.quantity;const dP=bP*(1-(disc/100));const t=dP*qty;const iNH=it.name;return`<tr><td>${idx+1}</td><td>${iNH}</td><td>₹${bP.toFixed(2)}</td><td>${qty}</td><td>${disc}%</td><td>₹${dP.toFixed(2)}</td><td>₹${t.toFixed(2)}</td></tr>`}).join('');const hC=`<html>...PDF styles...<tbody>${i}</tbody>...`;const o={format:'A4',margin:{top:'0.5in',right:'0.5in',bottom:'0.5in',left:'0.5in'}};const pB=await html_to_pdf.generatePdf({content:hC},o);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename=Quote-Preview.pdf`);res.send(pB)}catch(e){console.error(e);res.status(500).send('Error')}});


// --- Serve Static Files for LOCAL DEVELOPMENT ONLY ---
if (process.env.NODE_ENV !== 'production') {
    app.use(express.static(path.join(__dirname, 'public')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));