// app.js - FINAL FIX FOR PDF PREVIEW GENERATION

console.log("App.js started processing...");

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const mongoose = require('mongoose');
const html_to_pdf = require('html-pdf-node');

const User = require('./models/Users');
const Product = require('./models/Products');
const Quote = require('./models/Quote');
const Coupon = require('./models/Coupon');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI).then(() => console.log('MongoDB Connected...')).catch(err => console.error(err));
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { maxAge: 24 * 60 * 60 * 1000 } }));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new GoogleStrategy({ clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, callbackURL: process.env.GOOGLE_REDIRECT_URI || '/auth/google/callback' }, async (accessToken, refreshToken, profile, cb) => { const newUser = { googleId: profile.id, displayName: profile.displayName, email: profile.emails[0].value, image: profile.photos[0].value }; try { let user = await User.findOne({ googleId: profile.id }); if (user) { cb(null, user); } else { user = await User.create(newUser); cb(null, user); } } catch (err) { cb(err, null); } }));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => { try { const user = await User.findById(id); done(null, user); } catch (err) { done(err, null); } });
function ensureAuth(req, res, next) { if (req.isAuthenticated()) { return next(); } res.status(401).json({ message: 'User not authenticated' }); }

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => res.redirect('/'));
app.get('/api/user', (req, res) => { if (req.user) { res.json({ loggedIn: true, user: { displayName: req.user.displayName } }); } else { res.json({ loggedIn: false }); } });
app.get('/auth/logout', (req, res, next) => { req.logout((err) => { if (err) { return next(err); } req.session.destroy(() => res.redirect('/')); }); });
app.get('/api/products', async (req, res) => { const s = req.query.q; let q = {}; if (s) { q = { $or: [{ baseName: { $regex: s, $options: 'i' } }, { variantName: { $regex: s, $options: 'i' } }] } }; try { const p = await Product.find(q).limit(50); res.json(p); } catch (e) { res.status(500).json({ m: 'E' }) } });
app.post('/api/quotes', ensureAuth, async (req, res) => { try { const qN = `Q-${Date.now()}`; const nQ = new Quote({ quoteNumber: qN, user: req.user.id, ...req.body }); const sQ = await nQ.save(); res.status(201).json(sQ); } catch (e) { res.status(500).json({ m: 'E' }) } });
app.get('/api/quotes', ensureAuth, async (req, res) => { try { const q = await Quote.find({ user: req.user.id }).sort({ createdAt: -1 }); res.json(q); } catch (e) { res.status(500).json({ m: 'E' }) } });
app.get('/api/quotes/:id', ensureAuth, async (req, res) => { try { const q = await Quote.findById(req.params.id).populate('lineItems.product'); if (!q || q.user.toString() !== req.user.id) return res.status(404).json({ m: 'NF' }); res.json(q); } catch (e) { res.status(500).json({ m: 'E' }) } });
app.delete('/api/quotes/:id', ensureAuth, async (req, res) => { try { const q = await Quote.findById(req.params.id); if (!q || q.user.toString() !== req.user.id) return res.status(403).json({ m: 'NA' }); await Quote.deleteOne({ _id: req.params.id }); res.json({ m: 'D' }) } catch (e) { res.status(500).json({ m: 'E' }) } });
app.post('/api/coupons/apply', ensureAuth, async (req, res) => { const { code } = req.body; if (!code) { return res.status(400).json({ m: 'Code required.' }) } try { const c = await Coupon.findOne({ code: code.toUpperCase() }); if (!c) { return res.status(404).json({ m: 'Invalid' }) } if (c.isUsed) { return res.status(410).json({ m: 'Already used' }) } c.isUsed = true; await c.save(); res.json({ m: `Success! ${c.discountPercentage}% discount applied.`, discountPercentage: c.discountPercentage }) } catch (e) { res.status(500).json({ m: 'Server error' }) } });

// PDF Download Route for SAVED quotes
app.get('/api/quotes/:id/download', ensureAuth, async (req, res) => {
    try {
        const quote = await Quote.findById(req.params.id).populate('lineItems.product').populate('user');
        if (!quote || quote.user._id.toString() !== req.user.id) { return res.status(404).send('Quote not found'); }
        const quoteDate = new Date(quote.createdAt).toLocaleDateString();
        const itemsHtml = quote.lineItems.map((item, index) => {
            const product = item.product;
            const basePrice = item.priceAtTime;
            const quantity = item.quantity;
            const discount = item.discountPercentage;
            const discountedPrice = basePrice * (1 - (discount / 100));
            const total = discountedPrice * quantity;
            const itemNameHtml = `<strong>${product.baseName} ${product.variantName || ''}</strong><br><small style="color:#555;">${product.description || ''}</small>`;
            return `<tr><td>${index + 1}</td><td>${itemNameHtml}</td><td>₹${basePrice.toFixed(2)}</td><td>${quantity}</td><td>${discount}%</td><td>₹${discountedPrice.toFixed(2)}</td><td>₹${total.toFixed(2)}</td></tr>`;
        }).join('');
        const totalsHtml = `<tr><td colspan="6" style="text-align:right;">Subtotal:</td><td style="text-align:right;">₹${quote.subtotal.toFixed(2)}</td></tr>${quote.couponDiscountPercentage > 0 ? `<tr><td colspan="6" style="text-align:right;">Discount (${quote.couponDiscountPercentage}%):</td><td style="text-align:right;">- ₹${quote.couponDiscountAmount.toFixed(2)}</td></tr>` : ''}<tr><td colspan="6" style="text-align:right;">GST (${quote.gstPercentage}%):</td><td style="text-align:right;">+ ₹${quote.gstAmount.toFixed(2)}</td></tr><tr style="font-weight:bold; border-top: 2px solid #333;"><td colspan="6" style="text-align:right;">Grand Total:</td><td style="text-align:right;">₹${quote.grandTotal.toFixed(2)}</td></tr>`;
        const htmlContent = `<html><head><style>body{font-family:Helvetica,Arial,sans-serif;font-size:12px;}.invoice-box{max-width:800px;margin:auto;padding:30px;border:1px solid #eee;box-shadow:0 0 10px rgba(0,0,0,.15);}.header{text-align:center;margin-bottom:20px;}.items-table{width:100%;border-collapse:collapse;}.items-table th,.items-table td{border-bottom:1px solid #eee;padding:8px;}.items-table th{background-color:#f9f9f9;}.totals-table{width:100%;margin-top:20px;}.align-right{text-align:right;}.grand-total-row td{border-top:2px solid #333;font-weight:700}</style></head><body><div class="invoice-box"><div class="header"><h1>Quotation</h1><p>From: ${quote.user.displayName}</p></div><div><table><tr><td><strong>Quote No:</strong> ${quote.quoteNumber}</td></tr><tr><td><strong>Date:</strong> ${quoteDate}</td></tr><tr><td><strong>Client:</strong> ${quote.clientName}</td></tr></table></div><br><table class="items-table"><thead><tr><th>#</th><th>Item</th><th>Base Price</th><th>Qty</th><th>Disc %</th><th>Disc Price</th><th>Total</th></tr></thead><tbody>${itemsHtml}</tbody></table><table class="totals-table"><tbody>${totalsHtml}</tbody></table></div></body></html>`;
        const options = { format: 'A4', margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' } };
        const pdfBuffer = await html_to_pdf.generatePdf({ content: htmlContent }, options);
        res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename=Quote-${quote.quoteNumber}.pdf`); res.send(pdfBuffer);
    } catch (err) { console.error('Error generating PDF:', err); res.status(500).send('Error'); }
});

// ===================================================================
// --- CORRECTED: PDF PREVIEW ROUTE FOR CURRENT QUOTE ---
// ===================================================================
app.post('/api/quotes/preview-pdf', ensureAuth, async (req, res) => {
    try {
        const quoteData = req.body;
        const user = req.user;
        const quoteDate = new Date().toLocaleDateString();
        const discount = 10; // This is the line-item discount for the preview.

        // This logic now correctly creates the condensed 7-column layout
        const itemsHtml = quoteData.lineItems.map((item, index) => {
            const basePrice = item.price;
            const quantity = item.quantity;
            const discountedPrice = basePrice * (1 - (discount / 100));
            const total = discountedPrice * quantity;
            // The 'name' property from the frontend contains the combined name and description HTML
            const itemNameHtml = item.name; 
            return `<tr><td>${index + 1}</td><td>${itemNameHtml}</td><td>₹${basePrice.toFixed(2)}</td><td>${quantity}</td><td>${discount}%</td><td>₹${discountedPrice.toFixed(2)}</td><td>₹${total.toFixed(2)}</td></tr>`;
        }).join('');
        
        // This template now uses the correct 7-column header to match the data
        const htmlContent = `<html><head><style>body{font-family:Helvetica,Arial,sans-serif;font-size:12px;}.invoice-box{max-width:800px;margin:auto;padding:30px;border:1px solid #eee;box-shadow:0 0 10px rgba(0,0,0,.15);}.header{text-align:center;margin-bottom:20px;}.items-table{width:100%;border-collapse:collapse;}.items-table th,.items-table td{border-bottom:1px solid #eee;padding:8px;}.items-table th{background-color:#f9f9f9;}.total{text-align:right;margin-top:20px;font-weight:700}</style></head><body><div class="invoice-box"><div class="header"><h1>Quotation</h1><p>From: ${user.displayName}</p></div><div><table><tr><td><strong>Quote No:</strong> PREVIEW</td></tr><tr><td><strong>Date:</strong> ${quoteDate}</td></tr><tr><td><strong>Client:</strong> ${quoteData.clientName}</td></tr></table></div><br><table class="items-table"><thead><tr><th>#</th><th>Item</th><th>Base Price</th><th>Qty</th><th>Disc %</th><th>Disc Price</th><th>Total</th></tr></thead><tbody>${itemsHtml}</tbody></table><div class="total">Grand Total: ₹${quoteData.grandTotal.toFixed(2)}</div></div></body></html>`;
        
        let options = { format: 'A4', margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' } };
        const pdfBuffer = await html_to_pdf.generatePdf({ content: htmlContent }, options);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Quote-Preview.pdf`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error('Error generating preview PDF:', err);
        res.status(500).send('Error generating preview PDF');
    }
});

// --- Serve Static Files & Catch-all ---
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

// --- Start the Server ---
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));