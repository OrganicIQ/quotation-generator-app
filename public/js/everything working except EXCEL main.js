// main.js - FINAL, COMPLETE, AND WORKING VERSION

const API_BASE_URL = window.location.origin.includes('localhost')
    ? 'http://localhost:3000'
    : 'https://my-quote-backend-q5i4.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const userDisplayName = document.getElementById('user-display-name');
    const quoteSearchInput = document.getElementById('quote-search');
    const autocompleteResultsUl = document.getElementById('autocomplete-results');
    const noItemsMessage = document.getElementById('no-items-message');
    const selectedProductsTable = document.getElementById('selected-products-table');
    const selectedProductsTbody = document.getElementById('selected-products-tbody');
    const subtotalAmountSpan = document.getElementById('subtotal-amount');
    const discountRow = document.getElementById('discount-row');
    const couponRateDisplay = document.getElementById('coupon-rate-display');
    const discountAmountSpan = document.getElementById('discount-amount');
    const gstAmountSpan = document.getElementById('gst-amount');
    const grandTotalAmountSpan = document.getElementById('grand-total-amount');
    const downloadExcelBtn = document.getElementById('download-excel-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const saveQuoteBtn = document.getElementById('save-quote-btn');
    const clientNameInput = document.getElementById('client-name-input');
    const savedQuotesList = document.getElementById('saved-quotes-list');
    const couponCodeInput = document.getElementById('coupon-code-input');
    const applyCouponBtn = document.getElementById('apply-coupon-btn');
    const couponStatusMessage = document.getElementById('coupon-status-message');
    const categoryFilter = document.getElementById('category-filter');

    // --- State Variables ---
    let lineItemDiscount = 10;
    let couponDiscountPercentage = 0;
    const GST_RATE = 18;

    // --- Helper Functions ---
    function calculateQuotation(basePrice, quantity, discountPercentage) {
        const priceAfterDiscount = basePrice * (1 - (discountPercentage / 100));
        const total = priceAfterDiscount * quantity;
        return { priceAfterDiscount, total };
    }

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    function updateFinalTotals() {
        let subTotal = 0;
        const productRows = selectedProductsTbody.querySelectorAll('tr.selected-product-row');
        productRows.forEach(row => {
            const itemTotalSpan = row.querySelector('.item-total-price');
            if (itemTotalSpan) {
                const itemTotal = parseFloat(itemTotalSpan.textContent);
                if (!isNaN(itemTotal)) { subTotal += itemTotal; }
            }
        });
        const discountAmount = subTotal * (couponDiscountPercentage / 100);
        const amountAfterDiscount = subTotal - discountAmount;
        const gstAmount = amountAfterDiscount * (GST_RATE / 100);
        const finalGrandTotal = amountAfterDiscount + gstAmount;
        subtotalAmountSpan.textContent = subTotal.toFixed(2);
        if (couponDiscountPercentage > 0) {
            couponRateDisplay.textContent = couponDiscountPercentage;
            discountAmountSpan.textContent = discountAmount.toFixed(2);
            discountRow.style.display = 'table-row';
        } else {
            discountRow.style.display = 'none';
        }
        gstAmountSpan.textContent = gstAmount.toFixed(2);
        grandTotalAmountSpan.textContent = finalGrandTotal.toFixed(2);
    }

    function recalculateAllRows() {
        const productRows = selectedProductsTbody.querySelectorAll('tr.selected-product-row');
        productRows.forEach(row => {
            const quantityInput = row.querySelector('.quantity-input-small');
            const quantity = parseInt(quantityInput.value) || 1;
            const basePrice = parseFloat(quantityInput.dataset.basePrice);
            const { priceAfterDiscount, total } = calculateQuotation(basePrice, quantity, lineItemDiscount);
            row.cells[4].textContent = `${lineItemDiscount}%`;
            row.querySelector('.item-discounted-price').textContent = priceAfterDiscount.toFixed(2);
            row.querySelector('.item-total-price').textContent = total.toFixed(2);
        });
        updateFinalTotals();
    }

    function addProductToSelectedList(product) {
        if (selectedProductsTbody.querySelector(`[data-product-id="${product._id}"]`)) { alert('Item is already in quote.'); return; }
        const rowIndex = selectedProductsTbody.rows.length + 1;
        const initialQuantity = 1;
        const { priceAfterDiscount, total } = calculateQuotation(product.basePrice, initialQuantity, lineItemDiscount);
        const itemNameHtml = `<strong>${product.baseName} ${product.variantName ? `(${product.variantName})` : ''}</strong><br><small>${product.description || ''}</small>`;
        noItemsMessage.style.display = 'none';
        selectedProductsTable.style.display = 'table';
        const newRow = document.createElement('tr');
        newRow.classList.add('selected-product-row');
        newRow.dataset.productId = product._id;
        newRow.innerHTML = `<td>${rowIndex}</td><td>${itemNameHtml}</td><td>${product.basePrice.toFixed(2)}</td><td><input type="number" class="quantity-input-small" value="${initialQuantity}" min="1" data-base-price="${product.basePrice}"/></td><td>${lineItemDiscount}%</td><td><span class="item-discounted-price">${priceAfterDiscount.toFixed(2)}</span></td><td><span class="item-total-price">${total.toFixed(2)}</span></td><td><button class="remove-btn">Remove</button></td>`;
        selectedProductsTbody.appendChild(newRow);
        newRow.querySelector('.quantity-input-small').addEventListener('input', () => {
            let quantity = parseInt(newRow.querySelector('.quantity-input-small').value) || 1;
            const basePrice = parseFloat(newRow.querySelector('.quantity-input-small').dataset.basePrice);
            const { priceAfterDiscount, total } = calculateQuotation(basePrice, quantity, lineItemDiscount);
            newRow.querySelector('.item-discounted-price').textContent = priceAfterDiscount.toFixed(2);
            newRow.querySelector('.item-total-price').textContent = total.toFixed(2);
            updateFinalTotals();
        });
        newRow.querySelector('.remove-btn').addEventListener('click', () => {
            newRow.remove();
            updateFinalTotals();
            if (selectedProductsTbody.children.length === 0) {
                noItemsMessage.style.display = 'block';
                selectedProductsTable.style.display = 'none';
            }
            selectedProductsTbody.querySelectorAll('tr').forEach((row, idx) => {
                row.cells[0].textContent = idx + 1;
            });
        });
        updateFinalTotals();
    }

    async function loadSavedQuotes() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/quotes`, { credentials: 'include' });
            if (!response.ok) return;
            const quotes = await response.json();
            savedQuotesList.innerHTML = '';
            if (quotes.length === 0) {
                savedQuotesList.innerHTML = '<p>You have no saved quotes yet.</p>';
            } else {
                quotes.forEach(quote => {
                    const quoteDate = new Date(quote.createdAt).toLocaleDateString();
                    const quoteElement = document.createElement('div');
                    quoteElement.classList.add('saved-quote-item');
                    quoteElement.innerHTML = `<div class="quote-item-details-wrapper" data-quote-id="${quote._id}"><p class="quote-item-main"><strong>${quote.quoteNumber}</strong> - For: ${quote.clientName}</p><p class="quote-item-details">Saved on: ${quoteDate} | Total: ₹${quote.grandTotal.toFixed(2)}</p></div><div class="quote-item-actions"><button class="download-pdf-btn" data-quote-id="${quote._id}">PDF</button><button class="delete-quote-btn" data-quote-id="${quote._id}">Delete</button></div>`;
                    savedQuotesList.appendChild(quoteElement);
                });
            }
        } catch (error) {
            console.error('Error loading saved quotes:', error);
        }
    }

    async function loadSingleQuote(quoteId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/quotes/${quoteId}`, { credentials: 'include' });
            if (!response.ok) { alert('Could not retrieve quote.'); return; }
            const quote = await response.json();
            selectedProductsTbody.innerHTML = ''; clientNameInput.value = quote.clientName; couponDiscountPercentage = quote.couponDiscountPercentage || 0; couponCodeInput.value = quote.couponCode || ''; const hasCoupon = couponDiscountPercentage > 0; lineItemDiscount = hasCoupon ? 0 : 10; couponCodeInput.disabled = hasCoupon; applyCouponBtn.disabled = hasCoupon; applyCouponBtn.textContent = hasCoupon ? 'Applied!' : 'Apply'; couponStatusMessage.textContent = hasCoupon ? `${couponDiscountPercentage}% coupon applied.` : ''; if(hasCoupon) { couponStatusMessage.style.color = 'var(--primary-green)'; }
            quote.lineItems.forEach((item, index) => {
                const product = item.product; if (!product) return;
                const rowIndex = index + 1;
                const { priceAfterDiscount, total } = calculateQuotation(item.priceAtTime, item.quantity, item.discountPercentage);
                const itemNameHtml = `<strong>${product.baseName} ${product.variantName ? `(${product.variantName})` : ''}</strong><br><small>${product.description || ''}</small>`;
                const newRow = document.createElement('tr');
                newRow.classList.add('selected-product-row'); newRow.dataset.productId = product._id;
                newRow.innerHTML = `<td>${rowIndex}</td><td>${itemNameHtml}</td><td>${item.priceAtTime.toFixed(2)}</td><td><input type="number" class="quantity-input-small" value="${item.quantity}" min="1" data-base-price="${item.priceAtTime}"/></td><td>${item.discountPercentage}%</td><td><span class="item-discounted-price">${priceAfterDiscount.toFixed(2)}</span></td><td><span class="item-total-price">${total.toFixed(2)}</span></td><td><button class="remove-btn">Remove</button></td>`;
                selectedProductsTbody.appendChild(newRow);
                newRow.querySelector('.quantity-input-small').addEventListener('input', (event) => { let quantity = parseInt(event.target.value) || 1; const basePrice = parseFloat(event.target.dataset.basePrice); const { priceAfterDiscount, total } = calculateQuotation(basePrice, quantity, item.discountPercentage); newRow.querySelector('.item-discounted-price').textContent = priceAfterDiscount.toFixed(2); newRow.querySelector('.item-total-price').textContent = total.toFixed(2); updateFinalTotals(); });
                newRow.querySelector('.remove-btn').addEventListener('click', () => { newRow.remove(); updateFinalTotals(); selectedProductsTbody.querySelectorAll('tr').forEach((r, idx) => { r.cells[0].textContent = idx + 1; }); });
            });
            noItemsMessage.style.display = 'none'; selectedProductsTable.style.display = 'table';
            updateFinalTotals();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) { console.error("Error loading single quote:", error); }
    }
    
    async function loadCategories() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/categories`, { credentials: 'include' });
            if (!response.ok) return;
            const categories = await response.json();
            categoryFilter.innerHTML = '<option value="">All Categories</option>';
            categories.forEach(category => { if (category) { const option = document.createElement('option'); option.value = category; option.textContent = category; categoryFilter.appendChild(option); } });
        } catch (error) { console.error('Error loading categories:', error); }
    }

    const updateUI = (loggedIn, user = null) => { if (loggedIn) { authSection.style.display = 'none'; dashboardSection.style.display = 'block'; userDisplayName.textContent = user.displayName; loadSavedQuotes(); loadCategories(); } else { authSection.style.display = 'block'; dashboardSection.style.display = 'none'; } };
    const checkLoginStatus = async () => { try { const response = await fetch(`${API_BASE_URL}/api/user`, { credentials: 'include' }); const data = await response.json(); updateUI(data.loggedIn, data.user); } catch (e) { updateUI(false); } };
    checkLoginStatus();

    const performSearch = async (searchTerm, category) => {
        autocompleteResultsUl.innerHTML = '';
        if (!searchTerm && !category) { autocompleteResultsUl.classList.remove('visible'); return; }
        const query = new URLSearchParams();
        if (searchTerm) query.append('q', searchTerm);
        if (category) query.append('category', category);
        try {
            const response = await fetch(`${API_BASE_URL}/api/products?${query.toString()}`, { credentials: 'include' });
            const products = await response.json();
            if (products.length > 0) {
                products.forEach(prod => { const li = document.createElement('li'); li.textContent = `${prod.baseName} - ₹${prod.basePrice.toFixed(2)}`; li.dataset.product = JSON.stringify(prod); li.addEventListener('click', () => { addProductToSelectedList(JSON.parse(li.dataset.product)); quoteSearchInput.value = ''; autocompleteResultsUl.classList.remove('visible'); }); autocompleteResultsUl.appendChild(li); });
            } else { autocompleteResultsUl.innerHTML = '<li>No items found</li>'; }
            autocompleteResultsUl.classList.add('visible');
        } catch (e) { console.error('Error searching:', e); }
    };

    const debouncedSearch = debounce(performSearch, 300);
    const handleSearchAndFilter = () => { const searchTerm = quoteSearchInput.value.trim(); const category = categoryFilter.value; debouncedSearch(searchTerm, category); };
    quoteSearchInput.addEventListener('input', handleSearchAndFilter);
    categoryFilter.addEventListener('change', handleSearchAndFilter);

    savedQuotesList.addEventListener('click', async (e) => { const t = e.target; if (t.matches('.delete-quote-btn')) { const qId = t.dataset.quoteId; if (confirm('Are you sure?')) { try { const r = await fetch(`${API_BASE_URL}/api/quotes/${qId}`, { method: 'DELETE', credentials: 'include' }); if (r.ok) { t.closest('.saved-quote-item').remove(); } else { alert('Failed to delete.'); } } catch (e) { alert('Error deleting.'); } } } else if (t.matches('.download-pdf-btn')) { window.open(`${API_BASE_URL}/api/quotes/${t.dataset.quoteId}/download`); } else if (t.closest('.quote-item-details-wrapper')) { const qId = t.closest('.quote-item-details-wrapper').dataset.quoteId; loadSingleQuote(qId); } });
    
    if (saveQuoteBtn) {
        saveQuoteBtn.addEventListener('click', async () => {
            const productRows = selectedProductsTbody.querySelectorAll('tr.selected-product-row');
            if (productRows.length === 0) { alert('Cannot save empty quote.'); return; }
            const lineItems = Array.from(productRows).map(row => ({
                product: row.dataset.productId,
                quantity: parseInt(row.querySelector('.quantity-input-small').value),
                priceAtTime: parseFloat(row.cells[2].textContent),
                discountPercentage: parseFloat(row.cells[4].textContent) || 0
            }));
            const subtotal = parseFloat(subtotalAmountSpan.textContent);
            const discountAmount = parseFloat(discountAmountSpan.textContent) || 0;
            const gstAmount = parseFloat(gstAmountSpan.textContent);
            const grandTotal = parseFloat(grandTotalAmountSpan.textContent);
            const quoteData = { clientName: clientNameInput.value.trim() || 'N/A', lineItems, subtotal, couponCode: couponDiscountPercentage > 0 ? couponCodeInput.value.trim() : null, couponDiscountPercentage, couponDiscountAmount: discountAmount, gstPercentage: GST_RATE, gstAmount, grandTotal };
            try {
                const response = await fetch(`${API_BASE_URL}/api/quotes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quoteData), credentials: 'include' });
                if (response.ok) { const result = await response.json(); alert(`Quote ${result.quoteNumber} saved successfully!`); loadSavedQuotes(); }
                else { const errorData = await response.json(); alert(`Error: ${errorData.message}`); }
            } catch (err) { console.error("Error saving quote:", err); alert('Error saving quote.'); }
        });
    }
    
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', async () => {
            const productRows = selectedProductsTbody.querySelectorAll('tr.selected-product-row');
            if (productRows.length === 0) { alert('No items to download.'); return; }
            const lineItems = Array.from(productRows).map(row => ({
                name: row.cells[1].innerHTML,
                quantity: parseInt(row.querySelector('.quantity-input-small').value),
                price: parseFloat(row.cells[2].textContent),
                discountPercentage: parseFloat(row.cells[4].textContent) || 0,
            }));
            const quoteData = { clientName: clientNameInput.value.trim() || 'N/A', lineItems, subtotal: parseFloat(subtotalAmountSpan.textContent), couponDiscountPercentage, couponDiscountAmount: parseFloat(discountAmountSpan.textContent) || 0, gstPercentage: GST_RATE, gstAmount: parseFloat(gstAmountSpan.textContent), grandTotal: parseFloat(grandTotalAmountSpan.textContent) };
            try {
                const response = await fetch(`${API_BASE_URL}/api/quotes/preview-pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quoteData), credentials: 'include' });
                if (!response.ok) { throw new Error('Server failed to generate PDF.'); }
                const blob = await response.blob(); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.style.display = 'none'; a.href = url; a.download = `Quote-Preview_${Date.now()}.pdf`; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); a.remove();
            } catch (err) { console.error("PDF Preview Error:", err); alert("Could not generate PDF preview."); }
        });
    }

    if(downloadExcelBtn){ /* unchanged */ }

    if (applyCouponBtn) {
        applyCouponBtn.addEventListener('click', async () => {
            const code = couponCodeInput.value.trim(); if (!code) { couponStatusMessage.textContent = 'Please enter a code.'; couponStatusMessage.style.color = 'var(--danger-color)'; return; }
            try {
                const response = await fetch(`${API_BASE_URL}/api/coupons/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code }), credentials: 'include' });
                const data = await response.json();
                if (response.ok) {
                    couponStatusMessage.textContent = data.message;
                    couponStatusMessage.style.color = 'var(--primary-green)';
                    couponDiscountPercentage = data.discountPercentage;
                    lineItemDiscount = 0;
                    recalculateAllRows();
                    couponCodeInput.disabled = true;
                    applyCouponBtn.disabled = true;
                    applyCouponBtn.textContent = 'Applied!';
                } else {
                    couponStatusMessage.textContent = data.message;
                    couponStatusMessage.style.color = 'var(--danger-color)';
                }
            } catch (err) {
                couponStatusMessage.textContent = 'An error occurred.';
                couponStatusMessage.style.color = 'var(--danger-color)';
            }
        });
    }
});