// D:\final-test-app\models\Product.js - NEW PRODUCT SCHEMA

const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    productId: { // Mapping from your 'id' column in CSV
        type: String,
        required: true,
        unique: true, // Product IDs should be unique
        trim: true
    },
    baseName: { // Mapping from your 'baseName' column
        type: String,
        required: true,
        trim: true
    },
    variantName: { // Mapping from your 'variantName' column
        type: String,
        trim: true,
        default: '' // Can be empty if no variant
    },
    description: { // Mapping from your 'description' column
        type: String,
        trim: true,
        default: ''
    },
    category: { // Mapping from your 'category' column
        type: String,
        trim: true,
        default: 'Uncategorized'
    },
    basePrice: { // Mapping from your 'price' column (renamed to avoid conflict with calculated 'price')
        type: Number,
        required: true,
        min: 0 // Price cannot be negative
    },
    // Calculated fields like Discount%, discounted Price, total will NOT be stored here.
    // They will be calculated on the fly during the quotation process.
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Product', ProductSchema);