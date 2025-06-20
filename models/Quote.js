// models/Quote.js - FINAL CODE WITH GST AND DISCOUNT FIELDS

const mongoose = require('mongoose');

const LineItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    priceAtTime: { type: Number, required: true },
    discountPercentage: { type: Number, required: true, default: 0 }
});

const QuoteSchema = new mongoose.Schema({
    quoteNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clientName: { type: String, default: 'N/A' },
    lineItems: [LineItemSchema],
    
    // --- NEW: Detailed financial fields ---
    subtotal: { type: Number, required: true, default: 0 },
    couponCode: { type: String, default: null },
    couponDiscountPercentage: { type: Number, default: 0 },
    couponDiscountAmount: { type: Number, default: 0 },
    gstPercentage: { type: Number, default: 18 },
    gstAmount: { type: Number, default: 0 },
    // ------------------------------------

    grandTotal: { type: Number, required: true },
    status: { type: String, enum: ['Draft', 'Sent', 'Accepted', 'Rejected'], default: 'Draft' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Quote', QuoteSchema);