// D:\final-test-app\importData.js

require('dotenv').config(); // Load environment variables from .env
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const Product = require('./models/Products'); // Ensure this path is correct

const CSV_FILE_PATH = path.join(__dirname, 'products.csv'); // <-- UPDATE THIS to your CSV file name

console.log(`Starting data import from: ${CSV_FILE_PATH}`);

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB Connected for import...');
        // Start import process after successful DB connection
        importData();
    })
    .catch(err => {
        console.error('MongoDB connection error during import:', err);
        process.exit(1); // Exit with error code
    });

async function importData() {
    const productsToInsert = [];
    let rowCount = 0;
    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (row) => {
            console.log("DEBUG: Row data received:", row);
            rowCount++;
            // Map CSV row data to your Product Schema
            // CSV Headers: id,baseName,variantName,description,category, price
            // Product Schema: productId,baseName,variantName,description,category, basePrice
            try {
                productsToInsert.push(new Product({
                   productId: row['\ufeffproductId'].trim(), // Assuming 'id' column maps to productId
                    baseName: row.baseName.trim(),
                    variantName: row.variantName ? row.variantName.trim() : '', // Handle potential empty variantName
                    description: row.description ? row.description.trim() : '', // Handle potential empty description
                    category: row.category ? row.category.trim() : 'Uncategorized', // Handle potential empty category
                    basePrice: parseFloat(row.basePrice) // Convert price string to number
                }));
            } catch (parseError) {
                console.error(`Error parsing row ${rowCount}: ${JSON.stringify(row)} - ${parseError.message}`);
                errorCount++;
            }
        })
        .on('end', async () => {
            console.log(`Finished parsing CSV. Total rows: ${rowCount}. Products ready for insertion: ${productsToInsert.length}`);

            if (productsToInsert.length === 0 && rowCount > 0) {
                 console.warn("No valid products parsed from CSV. Check your CSV headers and parsing logic.");
                 await mongoose.disconnect();
                 process.exit(0);
            } else if (rowCount === 0) {
                console.warn("CSV file is empty or headers do not match.");
                await mongoose.disconnect();
                process.exit(0);
            }

            try {
                // Use insertMany for efficient bulk insertion
                // { ordered: false } means it will continue inserting even if some documents fail (e.g., duplicates)
                const result = await Product.insertMany(productsToInsert, { ordered: false });
                successCount = result.length;
                console.log(`Successfully inserted ${successCount} products into MongoDB.`);
            } catch (err) {
                // Handle duplicate key errors (code 11000) specifically
                if (err.writeErrors) {
                    err.writeErrors.forEach(writeError => {
                        if (writeError.code === 11000) {
                            duplicateCount++;
                        } else {
                            console.error(`Other write error: ${JSON.stringify(writeError)}`);
                            errorCount++;
                        }
                    });
                    console.log(`Successfully inserted ${err.result.nInserted} products.`);
                    console.log(`Found ${duplicateCount} duplicate products (skipped).`);
                    console.log(`Other errors occurred for ${errorCount} products.`);
                } else {
                    console.error('Error during bulk insertion:', err);
                    errorCount = productsToInsert.length - successCount; // Rough count
                }
            } finally {
                console.log(`\n--- Import Summary ---`);
                console.log(`Total rows processed in CSV: ${rowCount}`);
                console.log(`Successfully inserted: ${successCount}`);
                console.log(`Skipped (duplicates): ${duplicateCount}`);
                console.log(`Errors during parsing/insertion: ${errorCount}`);
                console.log(`--- End Summary ---\n`);

                await mongoose.disconnect(); // Disconnect from MongoDB
                process.exit(0); // Exit the script gracefully
            }
        })
        .on('error', (err) => {
            console.error('Error reading CSV file:', err);
            mongoose.disconnect();
            process.exit(1); // Exit with error code
        });
}