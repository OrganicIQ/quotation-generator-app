// main.js - FINAL VERSION WITH CATEGORY FILTER

const API_BASE_URL = window.location.origin.includes('localhost')
    ? 'http://localhost:3000'
    : 'https://my-quote-backend-q5i4.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const authSection = document.getElementById('auth-section'); const dashboardSection = document.getElementById('dashboard-section'); const userDisplayName = document.getElementById('user-display-name'); const quoteSearchInput = document.getElementById('quote-search'); const autocompleteResultsUl = document.getElementById('autocomplete-results'); const noItemsMessage = document.getElementById('no-items-message'); const selectedProductsTable = document.getElementById('selected-products-table'); const selectedProductsTbody = document.getElementById('selected-products-tbody');
    const subtotalAmountSpan = document.getElementById('subtotal-amount'); const discountRow = document.getElementById('discount-row'); const couponRateDisplay = document.getElementById('coupon-rate-display'); const discountAmountSpan = document.getElementById('discount-amount'); const gstAmountSpan = document.getElementById('gst-amount'); const grandTotalAmountSpan = document.getElementById('grand-total-amount');
    const downloadExcelBtn = document.getElementById('download-excel-btn'); const downloadPdfBtn = document.getElementById('download-pdf-btn'); const saveQuoteBtn = document.getElementById('save-quote-btn'); const clientNameInput = document.getElementById('client-name-input'); const savedQuotesList = document.getElementById('saved-quotes-list'); const couponCodeInput = document.getElementById('coupon-code-input'); const applyCouponBtn = document.getElementById('apply-coupon-btn'); const couponStatusMessage = document.getElementById('coupon-status-message');
    const categoryFilter = document.getElementById('category-filter'); // <-- NEW: Category dropdown

    // --- State Variables ---
    let lineItemDiscount = 10; let couponDiscountPercentage = 0; const GST_RATE = 18;

    // --- All Helper Functions (condensed) ---
    function calculateQuotation(basePrice, quantity, discountPercentage) { const priceAfterDiscount = basePrice * (1 - (discountPercentage / 100)); const total = priceAfterDiscount * quantity; return { priceAfterDiscount, total }; }
    function debounce(func, delay) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; }
    function updateFinalTotals() { let subTotal = 0; const productRows = selectedProductsTbody.querySelectorAll('tr.selected-product-row'); productRows.forEach(row => { const itemTotalSpan = row.querySelector('.item-total-price'); if (itemTotalSpan) { const itemTotal = parseFloat(itemTotalSpan.textContent); if (!isNaN(itemTotal)) { subTotal += itemTotal; } } }); const discountAmount = subTotal * (couponDiscountPercentage / 100); const amountAfterDiscount = subTotal - discountAmount; const gstAmount = amountAfterDiscount * (GST_RATE / 100); const finalGrandTotal = amountAfterDiscount + gstAmount; subtotalAmountSpan.textContent = subTotal.toFixed(2); if (couponDiscountPercentage > 0) { couponRateDisplay.textContent = couponDiscountPercentage; discountAmountSpan.textContent = discountAmount.toFixed(2); discountRow.style.display = 'table-row'; } else { discountRow.style.display = 'none'; } gstAmountSpan.textContent = gstAmount.toFixed(2); grandTotalAmountSpan.textContent = finalGrandTotal.toFixed(2); }
    function recalculateAllRows() { const productRows = selectedProductsTbody.querySelectorAll('tr.selected-product-row'); productRows.forEach(row => { const quantityInput = row.querySelector('.quantity-input-small'); const quantity = parseInt(quantityInput.value) || 1; const basePrice = parseFloat(quantityInput.dataset.basePrice); const { priceAfterDiscount, total } = calculateQuotation(basePrice, quantity, lineItemDiscount); row.cells[4].textContent = `${lineItemDiscount}%`; row.querySelector('.item-discounted-price').textContent = priceAfterDiscount.toFixed(2); row.querySelector('.item-total-price').textContent = total.toFixed(2); }); updateFinalTotals(); }
    function addProductToSelectedList(product) { if (selectedProductsTbody.querySelector(`[data-product-id="${product._id}"]`)) { alert('Item is already in quote.'); return; } const rowIndex = selectedProductsTbody.rows.length + 1; const initialQuantity = 1; const { priceAfterDiscount, total } = calculateQuotation(product.basePrice, initialQuantity, lineItemDiscount); const itemNameHtml = `<strong>${product.baseName} ${product.variantName ? `(${product.variantName})` : ''}</strong><br><small>${product.description || ''}</small>`; noItemsMessage.style.display = 'none'; selectedProductsTable.style.display = 'table'; const newRow = document.createElement('tr'); newRow.classList.add('selected-product-row'); newRow.dataset.productId = product._id; newRow.innerHTML = `<td>${rowIndex}</td><td>${itemNameHtml}</td><td>${product.basePrice.toFixed(2)}</td><td><input type="number" class="quantity-input-small" value="${initialQuantity}" min="1" data-base-price="${product.basePrice}"/></td><td>${lineItemDiscount}%</td><td><span class="item-discounted-price">${priceAfterDiscount.toFixed(2)}</span></td><td><span class="item-total-price">${total.toFixed(2)}</span></td><td><button class="remove-btn">Remove</button></td>`; selectedProductsTbody.appendChild(newRow); newRow.querySelector('.quantity-input-small').addEventListener('input', (event) => { let quantity = parseInt(event.target.value) || 1; const basePrice = parseFloat(event.target.dataset.basePrice); const { priceAfterDiscount, total } = calculateQuotation(basePrice, quantity, lineItemDiscount); newRow.querySelector('.item-discounted-price').textContent = priceAfterDiscount.toFixed(2); newRow.querySelector('.item-total-price').textContent = total.toFixed(2); updateFinalTotals(); }); newRow.querySelector('.remove-btn').addEventListener('click', () => { newRow.remove(); updateFinalTotals(); if (selectedProductsTbody.children.length === 0) { noItemsMessage.style.display = 'block'; selectedProductsTable.style.display = 'none'; } selectedProductsTbody.querySelectorAll('tr').forEach((row, idx) => { row.cells[0].textContent = idx + 1; }); }); updateFinalTotals(); }
    async function loadSavedQuotes() { /* Unchanged */ }
    async function loadSingleQuote(quoteId) { /* Unchanged */ }
    
    // --- NEW: Function to load categories into the dropdown ---
    async function loadCategories() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/categories`);
            if (!response.ok) return;
            const categories = await response.json();
            categories.forEach(category => {
                if (category) { // Ensure category is not null or empty
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    categoryFilter.appendChild(option);
                }
            });
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    const updateUI = (loggedIn, user = null) => { if (loggedIn) { authSection.style.display = 'none'; dashboardSection.style.display = 'block'; userDisplayName.textContent = user.displayName; loadSavedQuotes(); loadCategories(); } else { authSection.style.display = 'block'; dashboardSection.style.display = 'none'; } };
    const checkLoginStatus = async () => { try { const r = await fetch(`${API_BASE_URL}/api/user`, { credentials: 'include' }); const d = await r.json(); updateUI(d.loggedIn, d.user); } catch (e) { updateUI(false); } };
    checkLoginStatus();

    // --- UPDATED: Search function now sends the selected category ---
    const performSearch = async () => {
        const searchTerm = quoteSearchInput.value.trim();
        const selectedCategory = categoryFilter.value;
        autocompleteResultsUl.innerHTML = '';
        if (!searchTerm) {
            autocompleteResultsUl.classList.remove('visible');
            return;
        }

        // Build the query string
        const query = new URLSearchParams({ q: searchTerm });
        if (selectedCategory) {
            query.append('category', selectedCategory);
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/products?${query.toString()}`);
            const products = await response.json();
            if (products.length > 0) {
                products.forEach(prod => { const li = document.createElement('li'); li.textContent = `${prod.baseName} - ₹${prod.basePrice.toFixed(2)}`; li.dataset.product = JSON.stringify(prod); li.addEventListener('click', () => { addProductToSelectedList(JSON.parse(li.dataset.product)); quoteSearchInput.value = ''; autocompleteResultsUl.innerHTML = ''; }); autocompleteResultsUl.appendChild(li); });
            } else {
                autocompleteResultsUl.innerHTML = '<li>No items found</li>';
            }
            autocompleteResultsUl.classList.add('visible');
        } catch (e) {
            console.error('Error searching:', e);
        }
    };
    
    // Trigger search when typing or when changing category
    const debouncedSearch = debounce(performSearch, 300);
    quoteSearchInput.addEventListener('input', debouncedSearch);
    categoryFilter.addEventListener('change', performSearch);
    
    // --- All other event listeners are condensed and unchanged ---
    savedQuotesList.addEventListener('click',async(e)=>{/*...*/});
    if(saveQuoteBtn){saveQuoteBtn.addEventListener('click',async()=>{/*...*/});}
    if(downloadPdfBtn){downloadPdfBtn.addEventListener('click',async()=>{/*...*/});}
    if(downloadExcelBtn){downloadExcelBtn.addEventListener('click',()=>{/*...*/});}
    if(applyCouponBtn){applyCouponBtn.addEventListener('click',async()=>{/*...*/});}
});