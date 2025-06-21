// server/models/Quote.js - CORRECTED VERSION

const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    priceAtTime: {
        type: Number,
        required: true
    },
    discountPercentage: {
        type: Number,
        default: 0
    }
}, { _id: false });

const quoteSchema = new mongoose.Schema({
    quoteNumber: {
        type: String,
        required: true,
        unique: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    clientName: {
        type: String,
        required: true
    },
    lineItems: [lineItemSchema],
    subtotal: {
        type: Number,
        required: true
    },
    gstPercentage: {
        type: Number,
        required: true
    },
    gstAmount: {
        type: Number,
        required: true
    },
    grandTotal: {
        type: Number,
        required: true
    },
    
    // --- ADDED FIELDS FOR COUPON ---
    couponCode: {
        type: String,
        default: null
    },
    couponDiscountPercentage: {
        type: Number,
        default: 0
    },
    couponDiscountAmount: {
        type: Number,
        default: 0
    }
    // --------------------------------

}, { timestamps: true }); // timestamps adds createdAt and updatedAt

module.exports = mongoose.model('Quote', quoteSchema);