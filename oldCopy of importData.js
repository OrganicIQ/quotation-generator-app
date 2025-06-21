// importData.js - FINAL ROBUST VERSION

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const Product = require('./models/Products');

const CSV_FILE_PATH = path.join(__dirname, 'products.csv');

console.log(`Starting data import from: ${CSV_FILE_PATH}`);

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB Connected for import...');
        importData();
    })
    .catch(err => {
        console.error('MongoDB connection error during import:', err);
        process.exit(1);
    });

async function importData() {
    const productsToInsert = [];
    let rowCount = 0;

    fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (row) => {
            rowCount++;
            const basePrice = parseFloat(row.basePrice);

            // --- NEW: Validate the basePrice before adding ---
            if (isNaN(basePrice) || basePrice < 0) {
                console.warn(`[SKIPPING] Row ${rowCount} has an invalid basePrice. Data:`, row);
            } else {
                // This product is valid, add it to our list
                productsToInsert.push({
                   productId: row.productId || row['\ufeffproductId'],
                    baseName: row.baseName,
                    variantName: row.variantName,
                    description: row.description,
                    category: row.category,
                    basePrice: basePrice // Use the parsed number
                });
            }
        })
        .on('end', async () => {
            console.log(`\nFinished parsing CSV. Found ${productsToInsert.length} valid products out of ${rowCount} total rows.`);

            if (productsToInsert.length > 0) {
                try {
                    console.log('Deleting old products...');
                    await Product.deleteMany({}); // Deletes all old products
                    console.log('Old products deleted.');

                    console.log('Inserting new products...');
                    await Product.insertMany(productsToInsert);
                    console.log(`Successfully inserted ${productsToInsert.length} new products.`);
                } catch (err) {
                    console.error('Error during database operation:', err);
                }
            } else {
                console.warn('No valid products were found to insert.');
            }

            await mongoose.disconnect();
            console.log('MongoDB Disconnected.');
        });
}