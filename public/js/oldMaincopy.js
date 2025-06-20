// main.js - FINAL DEPLOYMENT CODE WITH LIVE API URL

// The new live URL for your backend server on Render
const API_BASE_URL = 'https://my-quote-backend-q5i4.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const authSection = document.getElementById('auth-section'); const dashboardSection = document.getElementById('dashboard-section'); const userDisplayName = document.getElementById('user-display-name'); const quoteSearchInput = document.getElementById('quote-search'); const autocompleteResultsUl = document.getElementById('autocomplete-results'); const noItemsMessage = document.getElementById('no-items-message'); const selectedProductsTable = document.getElementById('selected-products-table'); const selectedProductsTbody = document.getElementById('selected-products-tbody');
    const subtotalAmountSpan = document.getElementById('subtotal-amount'); const discountRow = document.getElementById('discount-row'); const couponRateDisplay = document.getElementById('coupon-rate-display'); const discountAmountSpan = document.getElementById('discount-amount'); const gstAmountSpan = document.getElementById('gst-amount'); const grandTotalAmountSpan = document.getElementById('grand-total-amount');
    const downloadExcelBtn = document.getElementById('download-excel-btn'); const downloadPdfBtn = document.getElementById('download-pdf-btn'); const saveQuoteBtn = document.getElementById('save-quote-btn'); const clientNameInput = document.getElementById('client-name-input'); const savedQuotesList = document.getElementById('saved-quotes-list'); const couponCodeInput = document.getElementById('coupon-code-input'); const applyCouponBtn = document.getElementById('apply-coupon-btn'); const couponStatusMessage = document.getElementById('coupon-status-message');

    // --- State Variables ---
    let lineItemDiscount = 10; let couponDiscountPercentage = 0; const GST_RATE = 18;

    // --- Helper Functions ---
    function calculateQuotation(basePrice, quantity, discountPercentage) { const priceAfterDiscount = basePrice * (1 - (discountPercentage / 100)); const total = priceAfterDiscount * quantity; return { priceAfterDiscount: priceAfterDiscount, total: total }; }
    function debounce(func, delay) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; }
    function updateFinalTotals() { let subTotal = 0; const productRows = selectedProductsTbody.querySelectorAll('tr.selected-product-row'); productRows.forEach(row => { const itemTotalSpan = row.querySelector('.item-total-price'); if (itemTotalSpan) { const itemTotal = parseFloat(itemTotalSpan.textContent); if (!isNaN(itemTotal)) { subTotal += itemTotal; } } }); const discountAmount = subTotal * (couponDiscountPercentage / 100); const amountAfterDiscount = subTotal - discountAmount; const gstAmount = amountAfterDiscount * (GST_RATE / 100); const finalGrandTotal = amountAfterDiscount + gstAmount; subtotalAmountSpan.textContent = subTotal.toFixed(2); if (couponDiscountPercentage > 0) { couponRateDisplay.textContent = couponDiscountPercentage; discountAmountSpan.textContent = discountAmount.toFixed(2); discountRow.style.display = 'table-row'; } else { discountRow.style.display = 'none'; } gstAmountSpan.textContent = gstAmount.toFixed(2); grandTotalAmountSpan.textContent = finalGrandTotal.toFixed(2); }
    function recalculateAllRows() { const productRows = selectedProductsTbody.querySelectorAll('tr.selected-product-row'); productRows.forEach(row => { const quantityInput = row.querySelector('.quantity-input-small'); const quantity = parseInt(quantityInput.value) || 1; const basePrice = parseFloat(quantityInput.dataset.basePrice); const { priceAfterDiscount, total } = calculateQuotation(basePrice, quantity, lineItemDiscount); row.cells[4].textContent = `${lineItemDiscount}%`; row.querySelector('.item-discounted-price').textContent = priceAfterDiscount.toFixed(2); row.querySelector('.item-total-price').textContent = total.toFixed(2); }); updateFinalTotals(); }

    function addProductToSelectedList(product) {
        if (selectedProductsTbody.querySelector(`[data-product-id="${product._id}"]`)) { alert('Item is already in quote.'); return; }
        const rowIndex = selectedProductsTbody.rows.length + 1;
        const initialQuantity = 1;
        const { priceAfterDiscount, total } = calculateQuotation(product.basePrice, initialQuantity, lineItemDiscount);
        const itemNameHtml = `<strong>${product.baseName} ${product.variantName ? `(${product.variantName})` : ''}</strong><br><small>${product.description || ''}</small>`;
        noItemsMessage.style.display = 'none'; selectedProductsTable.style.display = 'table';
        const newRow = document.createElement('tr');
        newRow.classList.add('selected-product-row'); newRow.dataset.productId = product._id;
        newRow.innerHTML = `<td>${rowIndex}</td><td>${itemNameHtml}</td><td>${product.basePrice.toFixed(2)}</td><td><input type="number" class="quantity-input-small" value="${initialQuantity}" min="1" data-base-price="${product.basePrice}"/></td><td>${lineItemDiscount}%</td><td><span class="item-discounted-price">${priceAfterDiscount.toFixed(2)}</span></td><td><span class="item-total-price">${total.toFixed(2)}</span></td><td><button class="remove-btn">Remove</button></td>`;
        selectedProductsTbody.appendChild(newRow);
        newRow.querySelector('.quantity-input-small').addEventListener('input', (event) => { let quantity = parseInt(event.target.value) || 1; const basePrice = parseFloat(event.target.dataset.basePrice); const { priceAfterDiscount, total } = calculateQuotation(basePrice, quantity, lineItemDiscount); newRow.querySelector('.item-discounted-price').textContent = priceAfterDiscount.toFixed(2); newRow.querySelector('.item-total-price').textContent = total.toFixed(2); updateFinalTotals(); });
        newRow.querySelector('.remove-btn').addEventListener('click', () => { newRow.remove(); updateFinalTotals(); if (selectedProductsTbody.children.length === 0) { noItemsMessage.style.display = 'block'; selectedProductsTable.style.display = 'none'; } selectedProductsTbody.querySelectorAll('tr').forEach((row, idx) => { row.cells[0].textContent = idx + 1; }); });
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
        } catch (error) { console.error('Error loading quotes:', error); }
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
    
    const updateUI = (loggedIn, user = null) => { if (loggedIn) { authSection.style.display = 'none'; dashboardSection.style.display = 'block'; userDisplayName.textContent = user.displayName; loadSavedQuotes(); } else { authSection.style.display = 'block'; dashboardSection.style.display = 'none'; } };
    const checkLoginStatus = async () => { try { const response = await fetch(`${API_BASE_URL}/api/user`, { credentials: 'include' }); const data = await response.json(); updateUI(data.loggedIn, data.user); } catch (e) { updateUI(false); } };
    checkLoginStatus();

    savedQuotesList.addEventListener('click', async (e) => {
        const t = e.target;
        if (t.matches('.delete-quote-btn')) {
            const qId = t.dataset.quoteId;
            if (confirm('Are you sure?')) {
                try {
                    const r = await fetch(`${API_BASE_URL}/api/quotes/${qId}`, { method: 'DELETE', credentials: 'include' });
                    if (r.ok) { t.closest('.saved-quote-item').remove(); } else { alert('Failed to delete.'); }
                } catch (e) { alert('Error deleting.'); }
            }
        } else if (t.matches('.download-pdf-btn')) {
            const qId = t.dataset.quoteId;
            window.open(`${API_BASE_URL}/api/quotes/${qId}/download`, '_blank');
        } else if (t.closest('.quote-item-details-wrapper')) {
            const qId = t.closest('.quote-item-details-wrapper').dataset.quoteId;
            loadSingleQuote(qId);
        }
    });

    const performSearch = async (sT) => {
        autocompleteResultsUl.innerHTML = ''; if (!sT) return;
        try {
            const r = await fetch(`${API_BASE_URL}/api/products?q=${encodeURIComponent(sT)}`);
            const p = await r.json();
            if (p.length > 0) {
                p.forEach(prod => {
                    const li = document.createElement('li');
                    li.textContent = `${prod.baseName} - ₹${prod.basePrice.toFixed(2)}`;
                    li.dataset.product = JSON.stringify(prod);
                    li.addEventListener('click', () => { addProductToSelectedList(JSON.parse(li.dataset.product)); quoteSearchInput.value = ''; autocompleteResultsUl.innerHTML = ''; });
                    autocompleteResultsUl.appendChild(li);
                });
            } else {
                autocompleteResultsUl.innerHTML = '<li>No items found</li>';
            }
            autocompleteResultsUl.classList.add('visible');
        } catch (e) { console.error('Error searching:', e); }
    };
    quoteSearchInput.addEventListener('input', (e) => debounce(performSearch, 300)(e.target.value.trim()));

    if (saveQuoteBtn) {
        saveQuoteBtn.addEventListener('click', async () => {
            const pR = selectedProductsTbody.querySelectorAll('tr.selected-product-row'); if (pR.length === 0) { alert('Cannot save empty quote.'); return; }
            const lI = Array.from(pR).map(row => ({ product: row.dataset.productId, quantity: parseInt(row.querySelector('.quantity-input-small').value), priceAtTime: parseFloat(row.cells[2].textContent), discountPercentage: parseFloat(row.cells[4].textContent) || 0 }));
            const subtotal = parseFloat(subtotalAmountSpan.textContent); const discountAmount = parseFloat(discountAmountSpan.textContent) || 0; const gstAmount = parseFloat(gstAmountSpan.textContent); const grandTotal = parseFloat(grandTotalAmountSpan.textContent);
            const qD = { clientName: clientNameInput.value.trim() || 'N/A', lineItems: lI, subtotal, couponCode: couponDiscountPercentage > 0 ? couponCodeInput.value.trim() : null, couponDiscountPercentage, couponDiscountAmount: discountAmount, gstAmount, grandTotal };
            try {
                const r = await fetch(`${API_BASE_URL}/api/quotes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(qD), credentials: 'include' });
                if (r.ok) { const res = await r.json(); alert(`Quote ${res.quoteNumber} saved!`); loadSavedQuotes(); } else { const err = await r.json(); alert(`Error: ${err.message}`); }
            } catch (e) { alert('Error saving.'); }
        });
    }

    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', async () => {
            const pR = selectedProductsTbody.querySelectorAll('tr.selected-product-row'); if (pR.length === 0) { alert('No items to download.'); return; }
            const lI = Array.from(pR).map(row => ({ name: row.cells[1].innerHTML, quantity: parseInt(row.querySelector('.quantity-input-small').value), price: parseFloat(row.cells[2].textContent), total: parseFloat(row.querySelector('.item-total-price').textContent) }));
            const qD = { clientName: clientNameInput.value.trim() || 'N/A', lineItems: lI, grandTotal: parseFloat(grandTotalAmountSpan.textContent) };
            try {
                const r = await fetch(`${API_BASE_URL}/api/quotes/preview-pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(qD), credentials: 'include' });
                if (!r.ok) { throw new Error('Server failed to generate PDF.'); }
                const b = await r.blob(); const u = window.URL.createObjectURL(b); const a = document.createElement('a'); a.style.display = 'none'; a.href = u; a.download = `Quote-Preview_${Date.now()}.pdf`; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(u); a.remove();
            } catch (e) { console.error("PDF Preview Error:", e); alert("Could not generate PDF preview."); }
        });
    }

    if (downloadExcelBtn) {
        downloadExcelBtn.addEventListener('click', () => {
            const pR = selectedProductsTbody.querySelectorAll('tr.selected-product-row'); if (pR.length === 0) { alert('No items to download.'); return; }
            const d = [['#', 'Item', 'Base Price', 'Qty', 'Disc %', 'Disc Price', 'Total']];
            pR.forEach(row => { const c = row.querySelectorAll('td'); d.push([c[0].textContent, c[1].textContent.replace(/<br\s*[\/]?>/gi, " ").replace(/<[^>]+>/g, ''), c[2].textContent, c[3].querySelector('input').value, c[4].textContent, c[5].textContent, c[6].textContent]); });
            d.push([]); d.push(['', '', '', '', '', 'Subtotal', subtotalAmountSpan.textContent]); d.push(['', '', '', '', '', `Discount (${couponDiscountPercentage}%)`, discountAmountSpan.textContent]); d.push(['', '', '', '', '', 'GST (18%)', gstAmountSpan.textContent]); d.push(['', '', '', '', '', 'Grand Total', grandTotalAmountSpan.textContent]);
            const wB = XLSX.utils.book_new(); const wS = XLSX.utils.aoa_to_sheet(d); XLSX.utils.book_append_sheet(wB, wS, 'Quotation');
            XLSX.writeFile(wB, `Quotation_${new Date().toISOString().slice(0, 10)}.xlsx`);
        });
    }
    
    if (applyCouponBtn) {
        applyCouponBtn.addEventListener('click', async () => {
            const code = couponCodeInput.value.trim(); if (!code) { couponStatusMessage.textContent = 'Please enter a code.'; couponStatusMessage.style.color = 'var(--danger-color)'; return; }
            try {
                const r = await fetch(`${API_BASE_URL}/api/coupons/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code }), credentials: 'include' });
                const data = await r.json();
                if (r.ok) {
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