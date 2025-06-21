// models/Products.js - FINAL VERSION WITH MULTIPLE CATEGORIES

const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    productId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    baseName: {
        type: String,
        required: true,
        trim: true
    },
    variantName: {
        type: String,
        trim: true,
        default: ''
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    // --- UPDATED: 'category' is now an array of strings ---
    category: {
        type: [String], // This defines an array of strings
        required: true,
        default: ['Uncategorized'] // Default to an array with one item
    },
    basePrice: {
        type: Number,
        required: true,
        min: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Product', ProductSchema);