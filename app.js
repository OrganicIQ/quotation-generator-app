// app.js - Final Version with Immediate Coupon Consumption

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

// Models
const User = require('./models/Users');
const Product = require('./models/Products');
const Quote = require('./models/Quote');
const Coupon = require('./models/Coupon');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI).then(() => console.log('MongoDB Connected...')).catch(err => console.error('MongoDB connection error:', err));

app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false, store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }), cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 24 * 60 * 60 * 1000 } }));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({ clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, callbackURL: process.env.GOOGLE_REDIRECT_URI }, async (accessToken, refreshToken, profile, cb) => {
    const newUser = { googleId: profile.id, displayName: profile.displayName, email: profile.emails[0].value, image: profile.photos[0].value };
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) { return cb(null, user); }
        else { user = await User.create(newUser); return cb(null, user); }
    } catch (err) { return cb(err, null); }
}));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => { try { const user = await User.findById(id); done(null, user); } catch (err) { done(err, null); } });

function ensureAuth(req, res, next) { if (req.isAuthenticated()) { return next(); } res.status(401).json({ message: 'User not authenticated' }); }

// --- AUTHENTICATION ROUTES ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: process.env.FRONTEND_URL || '/' }), (req, res) => { res.redirect(process.env.FRONTEND_URL || '/'); });
app.get('/api/user', (req, res) => { if (req.user) { res.json({ loggedIn: true, user: { displayName: req.user.displayName, role: req.user.role } }); } else { res.json({ loggedIn: false }); } });
app.get('/auth/logout', (req, res, next) => { req.logout((err) => { if (err) { return next(err); } req.session.destroy(() => res.redirect(process.env.FRONTEND_URL || '/')); }); });


// --- DATA AND ACTION API ROUTES ---
app.get('/api/products', ensureAuth, async (req, res) => {
    const searchTerm = req.query.q; const category = req.query.category;
    let query = {};
    if (searchTerm) { query.$or = [{ baseName: { $regex: searchTerm, $options: 'i' } }, { variantName: { $regex: searchTerm, $options: 'i' } }]; }
    if (category && category.length > 0) { query.category = { $in: Array.isArray(category) ? category : [category] }; }
    try { const products = await Product.find(query).limit(50); res.json(products); } catch (e) { res.status(500).json({ message: 'Error fetching products' }); }
});

app.get('/api/categories', ensureAuth, async (req, res) => {
    try { const categories = await Product.distinct('category'); res.json(categories.sort()); } catch (e) { res.status(500).json({ message: 'Error fetching categories' }); }
});

// MODIFIED: This route NO LONGER updates the coupon status.
app.post('/api/quotes', ensureAuth, async (req, res) => {
    try {
        const quoteNumber = `Q-${Date.now()}`;
        const newQuote = new Quote({ quoteNumber: quoteNumber, user: req.user.id, ...req.body });
        const savedQuote = await newQuote.save();
        res.status(201).json(savedQuote);
    } catch (e) { console.error("Error saving quote:", e); res.status(500).json({ message: 'Error saving quote' }); }
});

app.get('/api/quotes', ensureAuth, async (req, res) => {
    try { const quotes = await Quote.find({ user: req.user.id }).sort({ createdAt: -1 }); res.json(quotes); } catch (e) { res.status(500).json({ message: 'Error fetching quotes' }); }
});

app.get('/api/quotes/:id', ensureAuth, async (req, res) => {
    try {
        const quote = await Quote.findById(req.params.id).populate('lineItems.product');
        if (!quote || quote.user.toString() !== req.user.id) { return res.status(404).json({ message: 'Quote not found' }); }
        res.json(quote);
    } catch (e) { res.status(500).json({ message: 'Error fetching quote' }); }
});

app.delete('/api/quotes/:id', ensureAuth, async (req, res) => {
    try {
        const quote = await Quote.findById(req.params.id);
        if (!quote || quote.user.toString() !== req.user.id) { return res.status(403).json({ message: 'Not authorized' }); }
        await Quote.deleteOne({ _id: req.params.id });
        res.json({ message: 'Deleted' });
    } catch (e) { res.status(500).json({ message: 'Error deleting quote' }); }
});

// MODIFIED: This route NOW marks the coupon as used immediately.
app.post('/api/coupons/apply', ensureAuth, async (req, res) => {
    const { code } = req.body;
    if (!code) { return res.status(400).json({ message: 'Code required.' }) }
    try {
        const coupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (!coupon) { return res.status(404).json({ message: 'Invalid coupon' }) }
        if (coupon.isUsed) { return res.status(410).json({ message: 'This coupon has already been used' }) }

        // Mark the coupon as used and save it to the database
        coupon.isUsed = true;
        await coupon.save();

        res.json({ message: `Success! ${coupon.discountPercentage}% discount applied.`, discountPercentage: coupon.discountPercentage });
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

app.post('/api/quotes/preview-pdf', ensureAuth, async (req, res) => {
    try {
        const quoteData = req.body; const user = req.user; const quoteDate = new Date().toLocaleDateString();
        const itemsHtml = quoteData.lineItems.map((item, index) => { const basePrice = item.price; const quantity = item.quantity; const discount = item.discountPercentage; const discountedPrice = basePrice * (1 - (discount / 100)); const total = discountedPrice * quantity; return `<tr><td>${index + 1}</td><td>${item.name}</td><td>₹${basePrice.toFixed(2)}</td><td>${quantity}</td><td>${discount}%</td><td>₹${discountedPrice.toFixed(2)}</td><td>₹${total.toFixed(2)}</td></tr>`; }).join('');
        const totalsHtml = `<tr><td colspan="6" style="text-align:right;">Subtotal:</td><td style="text-align:right;">₹${quoteData.subtotal.toFixed(2)}</td></tr>${quoteData.couponDiscountPercentage > 0 ? `<tr><td colspan="6" style="text-align:right;">Discount (${quoteData.couponDiscountPercentage}%):</td><td style="text-align:right;">- ₹${quoteData.couponDiscountAmount.toFixed(2)}</td></tr>` : ''}<tr><td colspan="6" style="text-align:right;">GST (${quoteData.gstPercentage}%):</td><td style="text-align:right;">+ ₹${quoteData.gstAmount.toFixed(2)}</td></tr><tr style="font-weight:bold; border-top: 2px solid #333;"><td colspan="6" style="text-align:right;">Grand Total:</td><td style="text-align:right;">₹${quoteData.grandTotal.toFixed(2)}</td></tr>`;
        const htmlContent = `<html><head><style>body{font-family:Helvetica,Arial,sans-serif;font-size:12px;}.invoice-box{max-width:800px;margin:auto;padding:30px;border:1px solid #eee;box-shadow:0 0 10px rgba(0,0,0,.15);}.header{text-align:center;margin-bottom:20px;}.items-table{width:100%;border-collapse:collapse;}.items-table th,.items-table td{border-bottom:1px solid #eee;padding:8px;text-align:left;vertical-align:top;}.items-table th{background-color:#f9f9f9;}.totals-table{width:50%;margin-left:auto;margin-top:20px;}</style></head><body><div class="invoice-box"><div class="header"><h1>Quotation</h1><p>From: ${user.displayName}</p></div><div><table><tr><td><strong>Quote No:</strong> PREVIEW</td></tr><tr><td><strong>Date:</strong> ${quoteDate}</td></tr><tr><td><strong>Client:</strong> ${quoteData.clientName}</td></tr></table></div><br><table class="items-table"><thead><tr><th>#</th><th>Item</th><th>Base Price</th><th>Qty</th><th>Disc %</th><th>Disc Price</th><th>Total</th></tr></thead><tbody>${itemsHtml}</tbody></table><table class="totals-table"><tbody>${totalsHtml}</tbody></table></div></body></html>`;
        let options = { format: 'A4', margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' } };
        const pdfBuffer = await html_to_pdf.generatePdf({ content: htmlContent }, options);
        res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename=Quote-Preview.pdf`); res.send(pdfBuffer);
    } catch (err) { console.error('CRITICAL ERROR in PDF Generation:', err); res.status(500).send('Error generating preview PDF'); }
});


// --- Serve Static Files for Local Development ---
if (process.env.NODE_ENV !== 'production') {
    app.use(express.static(path.join(__dirname, 'public')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
}

app.listen(PORT, () => console.log(`[LOG] Server running on port ${PORT}`));