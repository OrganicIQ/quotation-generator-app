// models/Coupon.js

const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true, // Each coupon code must be unique
        uppercase: true, // Store codes in uppercase for case-insensitive matching
        trim: true
    },
    discountPercentage: {
        type: Number,
        required: true,
        min: 1,
        max: 100
    },
    isUsed: {
        type: Boolean,
        default: false // Coupons are unused by default
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Coupon', CouponSchema);