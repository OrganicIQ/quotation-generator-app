const API_BASE_URL = window.location.origin.includes('localhost')
    ? 'http://localhost:3000'
    : 'https://my-quote-backend-q5i4.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Element References
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
    const comboboxContainer = document.getElementById('category-combobox-container');
    const comboboxInputWrapper = document.getElementById('combobox-input-wrapper');
    const selectedPillsArea = document.getElementById('selected-pills-area');
    const categorySearchInput = document.getElementById('category-search-input');
    const categoryDropdown = document.getElementById('category-dropdown');

    // State Variables
    let lineItemDiscount = 10;
    let couponDiscountPercentage = 0;
    const GST_RATE = 18;
    let allCategories = [];
    let selectedCategories = [];
    let userRole = 'user';

    // Helper Functions
    function calculateQuotation(basePrice, quantity, discountPercentage) { const priceAfterDiscount = basePrice * (1 - (discountPercentage / 100)); const total = priceAfterDiscount * quantity; return { priceAfterDiscount, total }; }
    function debounce(func, delay) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; }
    function updateFinalTotals() { let subTotal = 0; const productRows = selectedProductsTbody.querySelectorAll('tr.selected-product-row'); productRows.forEach(row => { const itemTotalSpan = row.querySelector('.item-total-price'); if (itemTotalSpan) { const itemTotal = parseFloat(itemTotalSpan.textContent); if (!isNaN(itemTotal)) { subTotal += itemTotal; } } }); const discountAmount = subTotal * (couponDiscountPercentage / 100); const amountAfterDiscount = subTotal - discountAmount; const gstAmount = amountAfterDiscount * (GST_RATE / 100); const finalGrandTotal = amountAfterDiscount + gstAmount; subtotalAmountSpan.textContent = subTotal.toFixed(2); if (couponDiscountPercentage > 0) { couponRateDisplay.textContent = couponDiscountPercentage; discountAmountSpan.textContent = discountAmount.toFixed(2); discountRow.style.display = 'table-row'; } else { discountRow.style.display = 'none'; } gstAmountSpan.textContent = gstAmount.toFixed(2); grandTotalAmountSpan.textContent = finalGrandTotal.toFixed(2); }
    function recalculateAllRows() { const productRows = selectedProductsTbody.querySelectorAll('tr.selected-product-row'); productRows.forEach(row => { row.querySelector('.quantity-input').dispatchEvent(new Event('input', { bubbles: true })); }); }

    // UI and Data Functions
    function renderSelectedPills() {
        selectedPillsArea.innerHTML = '';
        selectedCategories.forEach(category => {
            const pill = document.createElement('div'); pill.className = 'selected-category-pill'; pill.textContent = category;
            const removeBtn = document.createElement('button'); removeBtn.className = 'remove-pill-btn'; removeBtn.textContent = '×'; removeBtn.dataset.category = category;
            pill.appendChild(removeBtn); selectedPillsArea.appendChild(pill);
        });
        handleSearchAndFilter();
    }

    function filterCategoryDropdown() {
        const searchTerm = categorySearchInput.value.toLowerCase();
        const items = categoryDropdown.querySelectorAll('li');
        items.forEach(item => { const isMatch = item.textContent.toLowerCase().includes(searchTerm); item.classList.toggle('hidden', !isMatch); });
    }

    async function loadCategories() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/categories`, { credentials: 'include' });
            if (!response.ok) return;
            allCategories = await response.json();
            const list = document.createElement('ul');
            allCategories.forEach(category => { if (category) { const listItem = document.createElement('li'); listItem.textContent = category; listItem.dataset.category = category; list.appendChild(listItem); } });
            categoryDropdown.innerHTML = ''; categoryDropdown.appendChild(list);
        } catch (error) { console.error('Error loading categories:', error); }
    }
    
    async function loadSavedQuotes() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/quotes`, { credentials: 'include' });
            if (!response.ok) { savedQuotesList.innerHTML = '<p>Could not load saved quotes.</p>'; return; }
            const quotes = await response.json();
            savedQuotesList.innerHTML = '';
            if (quotes.length === 0) { savedQuotesList.innerHTML = '<p>You have no saved quotes yet.</p>'; } else {
                quotes.forEach(quote => {
                    const quoteDate = new Date(quote.createdAt).toLocaleDateString();
                    const quoteElement = document.createElement('div'); quoteElement.classList.add('saved-quote-item');
                    quoteElement.innerHTML = `<div class="quote-item-details-wrapper" data-quote-id="${quote._id}"><p class="quote-item-main"><strong>${quote.quoteNumber}</strong> - For: ${quote.clientName}</p><p class="quote-item-details">Saved on: ${quoteDate} | Total: ₹${quote.grandTotal.toFixed(2)}</p></div><div class="quote-item-actions"><button class="delete-quote-btn" data-quote-id="${quote._id}">Delete</button></div>`;
                    savedQuotesList.appendChild(quoteElement);
                });
            }
        } catch (error) { console.error('Error loading quotes:', error); savedQuotesList.innerHTML = '<p>Error loading quotes.</p>'; }
    }
    
    async function loadSingleQuote(quoteId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/quotes/${quoteId}`, { credentials: 'include' });
            if (!response.ok) { alert('Could not retrieve quote.'); return; }
            const quote = await response.json();
            selectedProductsTbody.innerHTML = '';
            clientNameInput.value = quote.clientName;
            couponDiscountPercentage = quote.couponDiscountPercentage || 0;
            couponCodeInput.value = quote.couponCode || '';
            const hasCoupon = couponDiscountPercentage > 0;
            lineItemDiscount = hasCoupon ? 0 : 10;
            couponCodeInput.disabled = hasCoupon; applyCouponBtn.disabled = hasCoupon; applyCouponBtn.textContent = hasCoupon ? 'Applied!' : 'Apply';
            couponStatusMessage.textContent = hasCoupon ? `${couponDiscountPercentage}% coupon applied.` : '';
            if (hasCoupon) { couponStatusMessage.style.color = 'var(--primary-green)'; }
            quote.lineItems.forEach(item => {
                if (item.product) {
                    addProductToSelectedList(item.product, item.quantity, item.priceAtTime, item.discountPercentage);
                }
            });
            updateFinalTotals();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) { console.error("Error loading single quote:", error); }
    }

    function addProductToSelectedList(product, quantity = 1, price = null, discount = null) {
        if (selectedProductsTbody.querySelector(`[data-product-id="${product._id}"]`)) { alert('Item is already in quote.'); return; }
        const rowIndex = selectedProductsTbody.rows.length + 1;
        const basePrice = price !== null ? price : product.basePrice;
        const currentDiscount = discount !== null ? discount : lineItemDiscount;
        const itemNameHtml = `<strong>${product.baseName} ${product.variantName ? `(${product.variantName})` : ''}</strong><br><small>${product.description || ''}</small>`;
        noItemsMessage.style.display = 'none'; selectedProductsTable.style.display = 'table';
        const newRow = document.createElement('tr'); newRow.classList.add('selected-product-row'); newRow.dataset.productId = product._id;
        const isAdmin = userRole === 'admin';
        const priceCellHtml = isAdmin ? `<input type="number" class="price-input" step="0.01" value="${basePrice.toFixed(2)}" />` : `<span>${basePrice.toFixed(2)}</span>`;
        const discountCellHtml = isAdmin ? `<input type="number" class="discount-input" value="${currentDiscount}" min="0" max="100" />` : `<span>${currentDiscount}</span>`;
        newRow.innerHTML = `<td>${rowIndex}</td><td>${itemNameHtml}</td><td>${priceCellHtml}</td><td><input type="number" class="quantity-input" value="${quantity}" min="1" /></td><td>${discountCellHtml}%</td><td><span class="item-discounted-price">0.00</span></td><td><span class="item-total-price">0.00</span></td><td><button class="remove-btn">Remove</button></td>`;
        selectedProductsTbody.appendChild(newRow);
        const recalculateRow = () => {
            const currentPrice = parseFloat(isAdmin ? newRow.querySelector('.price-input').value : newRow.cells[2].textContent);
            const currentQuantity = parseInt(newRow.querySelector('.quantity-input').value, 10);
            const currentDiscount = parseFloat(isAdmin ? newRow.querySelector('.discount-input').value : newRow.cells[4].textContent.replace('%',''));
            if (isNaN(currentPrice) || isNaN(currentQuantity) || isNaN(currentDiscount)) return;
            const { priceAfterDiscount, total } = calculateQuotation(currentPrice, currentQuantity, currentDiscount);
            newRow.querySelector('.item-discounted-price').textContent = priceAfterDiscount.toFixed(2);
            newRow.querySelector('.item-total-price').textContent = total.toFixed(2);
            updateFinalTotals();
        };
        newRow.querySelector('.quantity-input').addEventListener('input', recalculateRow);
        if (isAdmin) {
            newRow.querySelector('.price-input').addEventListener('input', recalculateRow);
            newRow.querySelector('.discount-input').addEventListener('input', recalculateRow);
        }
        newRow.querySelector('.remove-btn').addEventListener('click', () => { newRow.remove(); updateFinalTotals(); if (selectedProductsTbody.children.length === 0) { noItemsMessage.style.display = 'block'; selectedProductsTable.style.display = 'none'; } selectedProductsTbody.querySelectorAll('tr').forEach((row, idx) => { row.cells[0].textContent = idx + 1; }); });
        recalculateRow();
    }

    const performSearch = async (searchTerm, categories) => {
        autocompleteResultsUl.innerHTML = '';
        if (!searchTerm) { autocompleteResultsUl.classList.remove('visible'); return; }
        const query = new URLSearchParams(); query.append('q', searchTerm);
        if (categories && categories.length > 0) { categories.forEach(cat => query.append('category', cat)); }
        try {
            const response = await fetch(`${API_BASE_URL}/api/products?${query.toString()}`, { credentials: 'include' });
            const products = await response.json();
            if (products.length > 0) {
                products.forEach(prod => { const li = document.createElement('li'); li.textContent = `${prod.baseName} - ₹${prod.basePrice.toFixed(2)}`; li.dataset.product = JSON.stringify(prod); li.addEventListener('click', () => { addProductToSelectedList(JSON.parse(li.dataset.product)); quoteSearchInput.value = ''; autocompleteResultsUl.innerHTML = ''; autocompleteResultsUl.classList.remove('visible'); }); autocompleteResultsUl.appendChild(li); });
            } else { autocompleteResultsUl.innerHTML = '<li>No items found</li>'; }
            autocompleteResultsUl.classList.add('visible');
        } catch (e) { console.error('Error searching:', e); }
    };

    const debouncedSearch = debounce(performSearch, 300);
    const handleSearchAndFilter = () => { const searchTerm = quoteSearchInput.value.trim(); debouncedSearch(searchTerm, selectedCategories); };
    const updateUI = (loggedIn, user = null) => { if (loggedIn) { authSection.style.display = 'none'; dashboardSection.style.display = 'block'; userDisplayName.textContent = user.displayName; userRole = user.role || 'user'; loadSavedQuotes(); loadCategories(); } else { authSection.style.display = 'block'; dashboardSection.style.display = 'none'; userRole = 'user'; } };
    const checkLoginStatus = async () => { try { const response = await fetch(`${API_BASE_URL}/api/user`, { credentials: 'include' }); const data = await response.json(); updateUI(data.loggedIn, data.user); } catch (e) { console.error("Error during checkLoginStatus:", e); updateUI(false); } };

    // --- Event Listeners ---
    quoteSearchInput.addEventListener('input', handleSearchAndFilter);
    comboboxInputWrapper.addEventListener('click', () => { categoryDropdown.classList.add('visible'); categorySearchInput.focus(); });
    categorySearchInput.addEventListener('input', filterCategoryDropdown);
    document.addEventListener('click', (e) => { if (!comboboxContainer.contains(e.target)) { categoryDropdown.classList.remove('visible'); } });
    categoryDropdown.addEventListener('click', (e) => { if (e.target.tagName === 'LI') { const category = e.target.dataset.category; if (!selectedCategories.includes(category)) { selectedCategories.push(category); renderSelectedPills(); } categorySearchInput.value = ''; filterCategoryDropdown(); categoryDropdown.classList.remove('visible'); } });
    selectedPillsArea.addEventListener('click', (e) => { if (e.target.classList.contains('remove-pill-btn')) { const categoryToRemove = e.target.dataset.category; selectedCategories = selectedCategories.filter(cat => cat !== categoryToRemove); renderSelectedPills(); } });
    
    savedQuotesList.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.matches('.delete-quote-btn')) {
            const quoteId = target.dataset.quoteId;
            if (confirm('Are you sure?')) { try { const r = await fetch(`${API_BASE_URL}/api/quotes/${quoteId}`, { method: 'DELETE', credentials: 'include' }); if (r.ok) { target.closest('.saved-quote-item').remove(); } else { alert('Failed to delete.'); } } catch (e) { alert('Error deleting.'); } }
        } else if (target.closest('.quote-item-details-wrapper')) {
            const quoteId = target.closest('.quote-item-details-wrapper').dataset.quoteId;
            loadSingleQuote(quoteId);
        }
    });

    if (saveQuoteBtn) {
        saveQuoteBtn.addEventListener('click', async () => {
            const productRows = selectedProductsTbody.querySelectorAll('tr.selected-product-row');
            if (productRows.length === 0) { return alert('Cannot save an empty quote.'); }
            const lineItems = Array.from(productRows).map(row => {
                const isAdmin = userRole === 'admin';
                return { product: row.dataset.productId, quantity: parseInt(row.querySelector('.quantity-input').value), priceAtTime: parseFloat(isAdmin ? row.querySelector('.price-input').value : row.cells[2].textContent), discountPercentage: parseFloat(isAdmin ? row.querySelector('.discount-input').value : row.cells[4].textContent.replace('%','')) };
            });
            const quoteData = { clientName: clientNameInput.value.trim() || 'N/A', lineItems, subtotal: parseFloat(subtotalAmountSpan.textContent), couponCode: couponDiscountPercentage > 0 ? couponCodeInput.value.trim() : null, couponDiscountPercentage, couponDiscountAmount: parseFloat(discountAmountSpan.textContent) || 0, gstPercentage: GST_RATE, gstAmount: parseFloat(gstAmountSpan.textContent), grandTotal: parseFloat(grandTotalAmountSpan.textContent) };
            try {
                const response = await fetch(`${API_BASE_URL}/api/quotes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quoteData), credentials: 'include' });
                if (response.ok) { const result = await response.json(); alert(`Quote ${result.quoteNumber} saved successfully!`); loadSavedQuotes(); } 
                else { const errorData = await response.json(); alert(`Error: ${errorData.message}`); }
            } catch (err) { console.error("Error saving quote:", err); alert('An error occurred while saving the quote.'); }
        });
    }

    if (applyCouponBtn) {
        applyCouponBtn.addEventListener('click', async () => {
            const code = couponCodeInput.value.trim();
            if (!code) { couponStatusMessage.textContent = 'Please enter a code.'; couponStatusMessage.style.color = 'var(--danger-color)'; return; }
            try {
                const response = await fetch(`${API_BASE_URL}/api/coupons/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code }), credentials: 'include' });
                const data = await response.json();
                if (response.ok) {
                    couponStatusMessage.textContent = data.message; couponStatusMessage.style.color = 'var(--primary-green)';
                    couponDiscountPercentage = data.discountPercentage; lineItemDiscount = 0;
                    recalculateAllRows();
                    couponCodeInput.disabled = true; applyCouponBtn.disabled = true; applyCouponBtn.textContent = 'Applied!';
                } else { couponStatusMessage.textContent = data.message; couponStatusMessage.style.color = 'var(--danger-color)'; }
            } catch (err) { couponStatusMessage.textContent = 'An error occurred.'; couponStatusMessage.style.color = 'var(--danger-color)'; }
        });
    }

    if (downloadExcelBtn) {
        downloadExcelBtn.addEventListener('click', () => {
            const productRows = selectedProductsTbody.querySelectorAll('tr.selected-product-row');
            if (productRows.length === 0) { alert('No items to download.'); return; }
            const data = [['#', 'Item', 'Base Price', 'Qty', 'Disc %', 'Disc Price', 'Total']];
            productRows.forEach(row => {
                const cells = row.querySelectorAll('td'); const isAdmin = userRole === 'admin';
                const price = isAdmin ? cells[2].querySelector('input').value : cells[2].textContent;
                const quantity = cells[3].querySelector('input').value;
                const discount = isAdmin ? cells[4].querySelector('input').value : cells[4].textContent;
                data.push([ cells[0].textContent, cells[1].innerText.replace(/\n/g, " "), price, quantity, discount, cells[5].textContent, cells[6].textContent ]);
            });
            data.push([]); data.push(['', '', '', '', '', 'Subtotal', subtotalAmountSpan.textContent]);
            if (couponDiscountPercentage > 0) { data.push(['', '', '', '', '', `Discount (${couponDiscountPercentage}%)`, `-${discountAmountSpan.textContent}`]); }
            data.push(['', '', '', '', '', `GST (${GST_RATE}%)`, `+${gstAmountSpan.textContent}`]);
            data.push(['', '', '', '', '', 'Grand Total', grandTotalAmountSpan.textContent]);
            const workbook = XLSX.utils.book_new(); const worksheet = XLSX.utils.aoa_to_sheet(data);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Quotation');
            XLSX.writeFile(workbook, `Quotation_${new Date().toISOString().slice(0, 10)}.xlsx`);
        });
    }

    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', async () => {
            const productRows = selectedProductsTbody.querySelectorAll('tr.selected-product-row');
            if (productRows.length === 0) { alert('No items to download.'); return; }
            const lineItems = Array.from(productRows).map(row => {
                const isAdmin = userRole === 'admin';
                return { name: row.cells[1].innerHTML, quantity: parseInt(row.querySelector('.quantity-input').value), price: parseFloat(isAdmin ? row.querySelector('.price-input').value : row.cells[2].textContent), discountPercentage: parseFloat(isAdmin ? row.querySelector('.discount-input').value : row.cells[4].textContent.replace('%','')) };
            });
            const quoteData = { clientName: clientNameInput.value.trim() || 'N/A', lineItems, subtotal: parseFloat(subtotalAmountSpan.textContent), couponDiscountPercentage, couponDiscountAmount: parseFloat(discountAmountSpan.textContent) || 0, gstPercentage: GST_RATE, gstAmount: parseFloat(gstAmountSpan.textContent), grandTotal: parseFloat(grandTotalAmountSpan.textContent) };
            try {
                const response = await fetch(`${API_BASE_URL}/api/quotes/preview-pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quoteData), credentials: 'include' });
                if (!response.ok) { throw new Error('Server failed to generate PDF.'); }
                const blob = await response.blob(); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.style.display = 'none'; a.href = url; a.download = `Quote-Preview_${Date.now()}.pdf`; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); a.remove();
            } catch (err) { console.error("PDF Preview Error:", err); alert("Could not generate PDF preview."); }
        });
    }

    // Initial Load
    checkLoginStatus();
});