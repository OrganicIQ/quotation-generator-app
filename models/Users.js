// models/Users.js
const mongoose = require('mongoose');

const DetailBlockSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    organisation: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    pinCode: { type: String, default: '' },
    state: { type: String, default: '' },
    gstNumber: { type: String, default: '' } // <-- New GST field
}, { _id: false });


const UserSchema = new mongoose.Schema({
    googleId: {
        type: String,
        required: true,
        unique: true
    },
    displayName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    image: {
        type: String
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    billingDetails: {
        type: DetailBlockSchema,
        default: () => ({})
    },
    shippingDetails: {
        type: DetailBlockSchema,
        default: () => ({})
    }
}, { 
    timestamps: true
});

module.exports = mongoose.model('User', UserSchema);