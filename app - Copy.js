require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const MongoStore = require('connect-mongo');
const nodemailer = require('nodemailer');
const XLSX = require('xlsx');
const html_to_pdf = require('html-pdf-node'); // This is required for PDF generation

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

// Nodemailer Transporter Setup
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

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

passport.use(new GoogleStrategy({ clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, callbackURL: process.env.GOOGLE_REDIRECT_URI }, async (accessToken, refreshToken, profile, cb) => {
    const newUser = { googleId: profile.id, displayName: profile.displayName, email: profile.emails[0].value, image: profile.photos[0].value };
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) return cb(null, user);
        user = await User.create(newUser);
        return cb(null, user);
    } catch (err) {
        return cb(err, null);
    }
}));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => { try { const user = await User.findById(id); done(null, user); } catch (err) { done(err, null); } });

function ensureAuth(req, res, next) { if (req.isAuthenticated()) return next(); res.status(401).json({ message: 'User not authenticated' }); }

// --- AUTHENTICATION ROUTES ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: process.env.FRONTEND_URL || '/' }), (req, res) => { res.redirect(process.env.FRONTEND_URL || '/'); });
app.get('/api/user', (req, res) => { if (req.user) { res.json({ loggedIn: true, user: req.user }); } else { res.json({ loggedIn: false }); } });
app.get('/auth/logout', (req, res, next) => { req.logout((err) => { if (err) { return next(err); } req.session.destroy(() => res.redirect(process.env.FRONTEND_URL || '/')); }); });

// --- DATA AND ACTION API ROUTES ---
app.put('/api/user/account', ensureAuth, async (req, res) => {
    try {
        const { billingDetails, shippingDetails } = req.body;
        const updatedUser = await User.findByIdAndUpdate(req.user.id, { $set: { billingDetails, shippingDetails } }, { new: true, runValidators: true });
        if (!updatedUser) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'Account updated successfully!', user: updatedUser });
    } catch (e) { console.error("Error updating user account:", e); res.status(500).json({ message: 'Error updating account' }); }
});

app.get('/api/products', ensureAuth, async (req, res) => {
    const { q: searchTerm, category } = req.query;
    let query = {};
    if (searchTerm) { query.$or = [{ baseName: { $regex: searchTerm, $options: 'i' } }, { variantName: { $regex: searchTerm, $options: 'i' } }]; }
    if (category && category.length > 0) { query.category = { $in: Array.isArray(category) ? category : [category] }; }
    try { const products = await Product.find(query).limit(50); res.json(products); } catch (e) { res.status(500).json({ message: 'Error fetching products' }); }
});

app.get('/api/categories', ensureAuth, async (req, res) => {
    try { const categories = await Product.distinct('category'); res.json(categories.sort()); } catch (e) { res.status(500).json({ message: 'Error fetching categories' }); }
});

app.post('/api/quotes', ensureAuth, async (req, res) => {
    try {
        const quoteNumber = `Q-${Date.now()}`;
        const newQuote = new Quote({ quoteNumber, user: req.user.id, ...req.body });
        await newQuote.save();
        if (req.body.couponCode) { await Coupon.updateOne({ code: req.body.couponCode.toUpperCase() }, { $set: { isUsed: true } }); }
        res.status(201).json(newQuote);
    } catch (e) { console.error("Error saving quote:", e); res.status(500).json({ message: 'Error saving quote' }); }
});

app.get('/api/quotes', ensureAuth, async (req, res) => {
    try { const quotes = await Quote.find({ user: req.user.id }).sort({ createdAt: -1 }); res.json(quotes); } catch (e) { res.status(500).json({ message: 'Error fetching quotes' }); }
});

app.get('/api/quotes/:id', ensureAuth, async (req, res) => {
    try {
        const quote = await Quote.findById(req.params.id).populate('lineItems.product');
        if (!quote || quote.user.toString() !== req.user.id) return res.status(404).json({ message: 'Quote not found' });
        res.json(quote);
    } catch (e) { res.status(500).json({ message: 'Error fetching quote' }); }
});

app.delete('/api/quotes/:id', ensureAuth, async (req, res) => {
    try { await Quote.deleteOne({ _id: req.params.id, user: req.user.id }); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ message: 'Error deleting quote' }); }
});

app.post('/api/coupons/apply', ensureAuth, async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Code required.' });
    try {
        const coupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (!coupon || coupon.isUsed) return res.status(404).json({ message: 'Invalid or used coupon' });
        res.json({ message: `Success! ${coupon.discountPercentage}% discount is valid.`, discountPercentage: coupon.discountPercentage });
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

// --- HELPER FUNCTIONS for FILE GENERATION ---
const generateExcelBuffer = (quoteData) => {
    const header = ['#', 'Item', 'Description', 'Base Price', 'Qty', 'Disc %', 'Total'];
    const data = [header];
    quoteData.lineItems.forEach((item, index) => {
        const [name, description] = item.name.split(', ');
        const total = item.price * item.quantity * (1 - item.discountPercentage / 100);
        data.push([index + 1, name, description || '', item.price, item.quantity, item.discountPercentage, total]);
    });
    data.push([]);
    data.push(['', '', '', '', '', 'Subtotal', quoteData.subtotal]);
    if (quoteData.couponDiscountPercentage > 0) {
        data.push(['', '', '', '', '', `Discount (${quoteData.couponDiscountPercentage}%)`, -quoteData.couponDiscountAmount]);
    }
    data.push(['', '', '', '', '', `GST (${quoteData.gstPercentage}%)`, quoteData.gstAmount]);
    data.push(['', '', '', '', '', 'Grand Total', quoteData.grandTotal]);
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    worksheet['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 5 }, { wch: 10 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Quotation');
    return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
};

const generatePdfBuffer = async (quoteData, user) => {
    // ** FIX: Provide default empty objects to prevent errors if details are missing **
    const senderDetails = user.billingDetails || {};
    const clientDetails = quoteData.client || {}; // Assuming client details might be passed in future

    const quoteDate = new Date().toLocaleDateString("en-IN", { day: '2-digit', month: '2-digit', year: 'numeric' });

    const headerHtml = `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
                <td style="width: 20%;">
                    <img src="${user.image || 'https://organiciqsolutions.com/wp-content/uploads/2025/06/Asset-1@2x-1.png'}" style="width: 80px; height: 80px; border-radius: 50%;">
                </td>
                <td style="width: 45%; vertical-align: top; font-size: 11px;">
                    <strong style="font-size: 16px;">${senderDetails.organisation || user.displayName}</strong><br>
                    ${senderDetails.address || ''}<br>
                    ${senderDetails.state || ''} - ${senderDetails.pinCode || ''}<br>
                    ${senderDetails.contactNumber || ''}<br>
                    ${senderDetails.gstNumber ? `GSTIN: ${senderDetails.gstNumber}` : ''}
                </td>
                <td style="width: 35%; text-align: right; vertical-align: top;">
                    <h1 style="font-size: 24px; margin: 0; color: #333;">QUOTATION</h1>
                </td>
            </tr>
        </table>
        <div style="border-top: 2px solid #333; margin-bottom: 20px;"></div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
            <tr>
                <td style="width: 50%;">
                    <strong>Quote No:</strong> Q-${Date.now()}<br>
                    <strong>Date:</strong> ${quoteDate}<br>
                </td>
                <td style="width: 50%;">
                    <strong>Bill To:</strong> ${quoteData.clientName || ''}
                </td>
            </tr>
        </table>
    `;

    const itemsHtml = quoteData.lineItems.map((item, index) => {
        const basePrice = item.price;
        const quantity = item.quantity;
        const discount = item.discountPercentage;
        const discountedPrice = basePrice * (1 - (discount / 100));
        const total = discountedPrice * quantity;
        return `<tr><td>${index + 1}</td><td>${item.name}</td><td>₹${basePrice.toFixed(2)}</td><td>${quantity}</td><td>${discount}%</td><td>₹${discountedPrice.toFixed(2)}</td><td>₹${total.toFixed(2)}</td></tr>`;
    }).join('');

    const totalsHtml = `<tr><td colspan="6" style="text-align:right;">Subtotal:</td><td style="text-align:right;">₹${quoteData.subtotal.toFixed(2)}</td></tr>${quoteData.couponDiscountPercentage > 0 ? `<tr><td colspan="6" style="text-align:right;">Discount (${quoteData.couponDiscountPercentage}%):</td><td style="text-align:right;">- ₹${quoteData.couponDiscountAmount.toFixed(2)}</td></tr>` : ''}<tr><td colspan="6" style="text-align:right;">GST (${quoteData.gstPercentage}%):</td><td style="text-align:right;">+ ₹${quoteData.gstAmount.toFixed(2)}</td></tr><tr style="font-weight:bold; border-top: 2px solid #333;"><td colspan="6" style="text-align:right;">Grand Total:</td><td style="text-align:right;">₹${quoteData.grandTotal.toFixed(2)}</td></tr>`;
    
    const htmlContent = `<html><head><style>body{font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#333;}.invoice-box{max-width:800px;margin:auto;padding:30px;border:1px solid #eee;box-shadow:0 0 10px rgba(0,0,0,.15);}.items-table{width:100%;border-collapse:collapse;}.items-table th,.items-table td{border-bottom:1px solid #eee;padding:8px;text-align:left;vertical-align:top;}.items-table th{background-color:#f9f9f9;}.totals-table{width:50%;margin-left:auto;margin-top:20px;}</style></head><body><div class="invoice-box">${headerHtml}<table class="items-table"><thead><tr><th>#</th><th>Item</th><th>Base Price</th><th>Qty</th><th>Disc %</th><th>Disc Price</th><th>Total</th></tr></thead><tbody>${itemsHtml}</tbody></table><table class="totals-table"><tbody>${totalsHtml}</tbody></table></div></body></html>`;
        
    let options = { format: 'A4', margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' } };
    return html_to_pdf.generatePdf({ content: htmlContent }, options);
};




// --- PDF and EMAIL ROUTES ---
app.post('/api/quotes/preview-pdf', ensureAuth, async (req, res) => {
    try {
        const pdfBuffer = await generatePdfBuffer(req.body, req.user);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Quote-Preview.pdf`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error('CRITICAL ERROR in PDF Generation:', err);
        res.status(500).send({ message: 'Error generating preview PDF.' });
    }
});

app.post('/api/quotes/send-email', ensureAuth, async (req, res) => {
    try {
        const quoteData = req.body;
        const sender = req.user;
        
        const excelBuffer = generateExcelBuffer(quoteData);

        const billing = sender.billingDetails || {};
        const shipping = sender.shippingDetails || {};

        const customerDetailsHtml = `
            <h3 style="margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Customer Details</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                    <td style="padding: 10px; vertical-align: top; width: 50%;">
                        <strong><u>Billing Details:</u></strong><br>
                        <strong>${billing.name || ''}</strong><br>
                        ${billing.organisation ? `${billing.organisation}<br>` : ''}
                        ${billing.address || ''}<br>
                        ${billing.state || ''} - ${billing.pinCode || ''}<br>
                        ${billing.gstNumber ? `<strong>GSTIN:</strong> ${billing.gstNumber}<br>` : ''} <!-- <-- Display GST Number -->
                        <br>
                        <strong>Contact:</strong> ${billing.contactNumber || ''}<br>
                        <strong>Email:</strong> ${sender.email || ''}
                    </td>
                    <td style="padding: 10px; vertical-align: top; width: 50%;">
                        <strong><u>Shipping Details:</u></strong><br>
                        <strong>${shipping.name || ''}</strong><br>
                        ${shipping.organisation ? `${shipping.organisation}<br>` : ''}
                        ${shipping.address || ''}<br>
                        ${shipping.state || ''} - ${shipping.pinCode || ''}<br>
                        <br>
                        <strong>Contact:</strong> ${shipping.contactNumber || ''}<br>
                        <strong>Email:</strong> ${shipping.email || ''}
                    </td>
                </tr>
            </table>
        `;

        const emailHtml = `<div style="font-family: Arial, sans-serif; color: #333;"><p>Hello,</p><p>${quoteData.customMessage || 'Please find the quotation details below and attached as a spreadsheet.'}</p><hr style="border: none; border-top: 1px solid #eee;">${customerDetailsHtml}<hr style="border: none; border-top: 1px solid #eee;"><p>Thank you,</p><p><strong>${sender.billingDetails.name || sender.displayName}</strong></p><p>${sender.billingDetails.organisation || ''}</p></div>`;

        const mailOptions = {
            from: `"${sender.billingDetails.name || sender.displayName}" <${process.env.EMAIL_FROM}>`,
            to: quoteData.recipientEmail,
            bcc: 'info@organiciqsolutions.com',
            subject: `Quotation for ${quoteData.clientName} from ${sender.billingDetails.organisation || 'Your Company'}`,
            html: emailHtml,
            attachments: [{ filename: `Quotation-${Date.now()}.xlsx`, content: excelBuffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }]
        };

        await transporter.sendMail(mailOptions);
        
        res.status(200).json({ message: 'Email sent successfully!' });

    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ message: 'Failed to send email. Please check server logs.' });
    }
});

// --- Serve Static Files for Development ---
if (process.env.NODE_ENV !== 'production') {
    app.use(express.static(path.join(__dirname, 'public')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LOG] Server running on host 0.0.0.0 and port ${PORT}`);
});
