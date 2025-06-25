const API_BASE_URL = window.location.origin.includes('localhost')
    ? 'http://localhost:3000'
    : 'https://my-quote-backend-q5i4.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const authContainer = document.getElementById('auth-container');
    const mainContainer = document.getElementById('main-container');
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
    const newQuoteBtn = document.getElementById('new-quote-btn');
    const downloadMenuBtn = document.getElementById('download-menu-btn');
    const downloadOptions = document.getElementById('download-options');
    const downloadExcelBtn = document.getElementById('download-excel-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const savedQuotesHeader = document.getElementById('saved-quotes-header');
    const savedQuotesContent = document.getElementById('saved-quotes-content');

    // "My Account" Modal Elements
    const myAccountBtn = document.getElementById('my-account-btn');
    const accountModal = document.getElementById('account-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const accountForm = document.getElementById('account-form');
    const saveAccountBtn = document.getElementById('save-account-btn');
    const accountStatusMessage = document.getElementById('account-status-message');
    const copyDetailsLink = document.getElementById('copy-details-link');

    // Billing Column Inputs
    const billingName = document.getElementById('billing-name');
    const billingOrganisation = document.getElementById('billing-organisation');
    const billingContact = document.getElementById('billing-contact');
    const billingEmail = document.getElementById('billing-email');
    const billingAddress = document.getElementById('billing-address');
    const billingPincode = document.getElementById('billing-pincode');
    const billingState = document.getElementById('billing-state');

    // Shipping Column Inputs
    const shippingName = document.getElementById('shipping-name');
    const shippingOrganisation = document.getElementById('shipping-organisation');
    const shippingContact = document.getElementById('shipping-contact');
    const shippingEmail = document.getElementById('shipping-email');
    const shippingAddress = document.getElementById('shipping-address');
    const shippingPincode = document.getElementById('shipping-pincode');
    const shippingState = document.getElementById('shipping-state');

    // --- State Variables ---
    let lineItemDiscount = 10;
    let couponDiscountPercentage = 0;
    const GST_RATE = 18;
    let allCategories = [];
    let selectedCategories = [];
    let userRole = 'user';
    let currentUser = null;

    // --- HELPER FUNCTIONS ---
    function calculateQuotation(basePrice, quantity, discountPercentage) { const priceAfterDiscount = basePrice * (1 - (discountPercentage / 100)); const total = priceAfterDiscount * quantity; return { priceAfterDiscount, total }; }
    function debounce(func, delay) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; }

    // --- NEW FUNCTION ---
    // Checks if essential billing details are filled out in the user's profile.
    function areAccountDetailsComplete(user) {
        if (!user || !user.billingDetails) {
            return false;
        }
        const details = user.billingDetails;
        // Check for essential billing fields. Adjust as needed.
        return details.name &&
               details.address &&
               details.contactNumber &&
               details.pinCode &&
               details.state;
    }

    function updateFinalTotals() { let subTotal = 0; const productRows = selectedProductsTbody.querySelectorAll('tr.selected-product-row'); productRows.forEach(row => { const itemTotalSpan = row.querySelector('.item-total-price'); if (itemTotalSpan) { const itemTotal = parseFloat(itemTotalSpan.textContent); if (!isNaN(itemTotal)) { subTotal += itemTotal; } } }); const discountAmount = subTotal * (couponDiscountPercentage / 100); const amountAfterDiscount = subTotal - discountAmount; const gstAmount = amountAfterDiscount * (GST_RATE / 100); const finalGrandTotal = amountAfterDiscount + gstAmount; subtotalAmountSpan.textContent = subTotal.toFixed(2); if (couponDiscountPercentage > 0) { couponRateDisplay.textContent = couponDiscountPercentage; discountAmountSpan.textContent = discountAmount.toFixed(2); discountRow.style.display = 'table-row'; } else { discountRow.style.display = 'none'; } gstAmountSpan.textContent = gstAmount.toFixed(2); grandTotalAmountSpan.textContent = finalGrandTotal.toFixed(2); }
    function recalculateAllRows() { const productRows = selectedProductsTbody.querySelectorAll('tr.selected-product-row'); productRows.forEach(row => { row.querySelector('.quantity-input').dispatchEvent(new Event('input', { bubbles: true })); }); }
    function resetQuotationWorkspace() { selectedProductsTbody.innerHTML = ''; noItemsMessage.style.display = 'block'; selectedProductsTable.style.display = 'none'; clientNameInput.value = ''; couponCodeInput.value = ''; couponCodeInput.disabled = false; applyCouponBtn.disabled = false; applyCouponBtn.textContent = 'Apply'; couponStatusMessage.textContent = ''; couponDiscountPercentage = 0; lineItemDiscount = 10; updateFinalTotals(); }

    const openAccountModal = () => {
        if (!currentUser) return;
        
        const bill = currentUser.billingDetails || {};
        const ship = currentUser.shippingDetails || {};

        billingName.value = bill.name || currentUser.displayName || '';
        billingOrganisation.value = bill.organisation || '';
        billingContact.value = bill.contactNumber || '';
        billingEmail.value = currentUser.email || '';
        billingAddress.value = bill.address || '';
        billingPincode.value = bill.pinCode || '';
        billingState.value = bill.state || '';
        
        shippingName.value = ship.name || '';
        shippingOrganisation.value = ship.organisation || '';
        shippingContact.value = ship.contactNumber || '';
        shippingEmail.value = ship.email || '';
        shippingAddress.value = ship.address || '';
        shippingPincode.value = ship.pinCode || '';
        shippingState.value = ship.state || '';
        
        accountStatusMessage.textContent = '';
        accountModal.style.display = 'flex';
    };

    const closeAccountModal = () => {
        accountModal.style.display = 'none';
    };

    // --- UI AND DATA FUNCTIONS ---
    function renderSelectedPills() { selectedPillsArea.innerHTML = ''; selectedCategories.forEach(category => { const pill = document.createElement('div'); pill.className = 'selected-category-pill'; pill.textContent = category; const removeBtn = document.createElement('button'); removeBtn.className = 'remove-pill-btn'; removeBtn.textContent = '×'; removeBtn.dataset.category = category; pill.appendChild(removeBtn); selectedPillsArea.appendChild(pill); }); handleSearchAndFilter(); }
    function filterCategoryDropdown() { const searchTerm = categorySearchInput.value.toLowerCase(); const items = categoryDropdown.querySelectorAll('li'); items.forEach(item => { const isMatch = item.textContent.toLowerCase().includes(searchTerm); item.classList.toggle('hidden', !isMatch); }); }
    async function loadCategories() { try { const response = await fetch(`${API_BASE_URL}/api/categories`, { credentials: 'include' }); if (!response.ok) return; allCategories = await response.json(); const list = document.createElement('ul'); allCategories.forEach(category => { if (category) { const listItem = document.createElement('li'); listItem.textContent = category; listItem.dataset.category = category; list.appendChild(listItem); } }); categoryDropdown.innerHTML = ''; categoryDropdown.appendChild(list); } catch (error) { console.error('Error loading categories:', error); } }
    async function loadSavedQuotes() { try { const response = await fetch(`${API_BASE_URL}/api/quotes`, { credentials: 'include' }); if (!response.ok) { savedQuotesList.innerHTML = '<p>Could not load saved quotes.</p>'; return; } const quotes = await response.json(); savedQuotesList.innerHTML = ''; if (quotes.length === 0) { savedQuotesList.innerHTML = '<p>You have no saved quotes yet.</p>'; } else { quotes.forEach(quote => { const quoteDate = new Date(quote.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: '2-digit', year: 'numeric' }); const quoteCard = document.createElement('div'); quoteCard.className = 'saved-quote-card'; const trashIconSvg = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 11V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 11V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 7H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 7H12H18V18C18 19.6569 16.6569 21 15 21H9C7.34315 21 6 19.6569 6 18V7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V7H9V5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`; quoteCard.innerHTML = `<div class="quote-card-main" data-quote-id="${quote._id}"><p class="quote-card-number">${quote.quoteNumber}</p><p class="quote-card-client">For: ${quote.clientName}</p><p class="quote-card-details">Saved on: ${quoteDate} | Total: ₹${quote.grandTotal.toFixed(2)}</p></div><div class="quote-card-actions"><button class="delete-quote-btn" data-quote-id="${quote._id}" title="Delete Quote">${trashIconSvg}</button></div>`; savedQuotesList.appendChild(quoteCard); }); } } catch (error) { console.error('Error loading quotes:', error); savedQuotesList.innerHTML = '<p>Error loading quotes.</p>'; } }
    async function loadSingleQuote(quoteId) { try { const response = await fetch(`${API_BASE_URL}/api/quotes/${quoteId}`, { credentials: 'include' }); if (!response.ok) { alert('Could not retrieve quote.'); return; } const quote = await response.json(); resetQuotationWorkspace(); clientNameInput.value = quote.clientName; couponDiscountPercentage = quote.couponDiscountPercentage || 0; couponCodeInput.value = quote.couponCode || ''; const hasCoupon = couponDiscountPercentage > 0; lineItemDiscount = hasCoupon ? 0 : 10; couponCodeInput.disabled = hasCoupon; applyCouponBtn.disabled = hasCoupon; applyCouponBtn.textContent = hasCoupon ? 'Applied!' : 'Apply'; couponStatusMessage.textContent = hasCoupon ? `${couponDiscountPercentage}% coupon applied.` : ''; if (hasCoupon) { couponStatusMessage.style.color = 'var(--color-success)'; } quote.lineItems.forEach(item => { if (item.product) { addProductToSelectedList(item.product, item.quantity, item.priceAtTime, item.discountPercentage); } }); updateFinalTotals(); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (error) { console.error("Error loading single quote:", error); } }
    function addProductToSelectedList(product, quantity = 1, price = null, discount = null) { if (selectedProductsTbody.querySelector(`[data-product-id="${product._id}"]`)) { alert('Item is already in quote.'); return; } const rowIndex = selectedProductsTbody.rows.length + 1; const basePrice = price !== null ? price : product.basePrice; const currentDiscount = discount !== null ? discount : lineItemDiscount; const itemNameHtml = `<strong>${product.baseName} ${product.variantName ? `(${product.variantName})` : ''}</strong><br><small>${product.description || ''}</small>`; noItemsMessage.style.display = 'none'; selectedProductsTable.style.display = 'table'; const newRow = document.createElement('tr'); newRow.classList.add('selected-product-row'); newRow.dataset.productId = product._id; const isAdmin = userRole === 'admin'; const priceCellHtml = isAdmin ? `<input type="number" class="price-input" step="0.01" value="${basePrice.toFixed(2)}" />` : `<span>${basePrice.toFixed(2)}</span>`; const discountCellHtml = isAdmin ? `<input type="number" class="discount-input" value="${currentDiscount}" min="0" max="100" />` : `<span>${currentDiscount}</span>`; newRow.innerHTML = `<td>${rowIndex}</td><td>${itemNameHtml}</td><td>${priceCellHtml}</td><td><input type="number" class="quantity-input" value="${quantity}" min="1" /></td><td>${discountCellHtml}</td><td><span class="item-discounted-price">0.00</span></td><td><span class="item-total-price">0.00</span></td><td><button class="remove-btn">-</button></td>`; selectedProductsTbody.appendChild(newRow); const recalculateRow = () => { const currentPrice = parseFloat(isAdmin ? newRow.querySelector('.price-input').value : newRow.cells[2].textContent); const currentQuantity = parseInt(newRow.querySelector('.quantity-input').value, 10); const currentDiscountPercent = parseFloat(isAdmin ? newRow.querySelector('.discount-input').value : newRow.cells[4].textContent.replace('%','')); if (isNaN(currentPrice) || isNaN(currentQuantity) || isNaN(currentDiscountPercent)) return; const { priceAfterDiscount, total } = calculateQuotation(currentPrice, currentQuantity, currentDiscountPercent); newRow.querySelector('.item-discounted-price').textContent = priceAfterDiscount.toFixed(2); newRow.querySelector('.item-total-price').textContent = total.toFixed(2); updateFinalTotals(); }; newRow.querySelector('.quantity-input').addEventListener('input', recalculateRow); if (isAdmin) { newRow.querySelector('.price-input').addEventListener('input', recalculateRow); newRow.querySelector('.discount-input').addEventListener('input', recalculateRow); } newRow.querySelector('.remove-btn').addEventListener('click', () => { newRow.remove(); updateFinalTotals(); if (selectedProductsTbody.children.length === 0) { noItemsMessage.style.display = 'block'; selectedProductsTable.style.display = 'none'; } selectedProductsTbody.querySelectorAll('tr').forEach((row, idx) => { row.cells[0].textContent = idx + 1; }); }); recalculateRow(); }
    const performSearch = async (searchTerm, categories) => { autocompleteResultsUl.innerHTML = ''; if (!searchTerm) { autocompleteResultsUl.classList.remove('visible'); return; } const query = new URLSearchParams(); query.append('q', searchTerm); if (categories && categories.length > 0) { categories.forEach(cat => query.append('category', cat)); } try { const response = await fetch(`${API_BASE_URL}/api/products?${query.toString()}`, { credentials: 'include' }); const products = await response.json(); if (products.length > 0) { products.forEach(prod => { const li = document.createElement('li'); li.textContent = `${prod.baseName} - ₹${prod.basePrice.toFixed(2)}`; li.dataset.product = JSON.stringify(prod); li.addEventListener('click', () => { addProductToSelectedList(JSON.parse(li.dataset.product)); quoteSearchInput.value = ''; autocompleteResultsUl.innerHTML = ''; autocompleteResultsUl.classList.remove('visible'); }); autocompleteResultsUl.appendChild(li); }); } else { autocompleteResultsUl.innerHTML = '<li>No items found</li>'; } autocompleteResultsUl.classList.add('visible'); } catch (e) { console.error('Error searching:', e); } };
    const debouncedSearch = debounce(performSearch, 300);
    const handleSearchAndFilter = () => { const searchTerm = quoteSearchInput.value.trim(); debouncedSearch(searchTerm, selectedCategories); };
    
    const updateUI = (loggedIn, user = null) => {
        currentUser = user;
        if (loggedIn) {
            authContainer.style.display = 'none';
            mainContainer.style.display = 'block';
            userDisplayName.textContent = user.displayName;
            userRole = user.role || 'user';
            loadSavedQuotes();
            loadCategories();
        } else {
            authContainer.style.display = 'flex';
            mainContainer.style.display = 'none';
            userRole = 'user';
        }
    };
    const checkLoginStatus = async () => { try { const response = await fetch(`${API_BASE_URL}/api/user`, { credentials: 'include' }); const data = await response.json(); updateUI(data.loggedIn, data.user); } catch (e) { console.error("Error during checkLoginStatus:", e); updateUI(false); } };

    // --- EVENT LISTENERS ---
    if (newQuoteBtn) { newQuoteBtn.addEventListener('click', () => { if (selectedProductsTbody.children.length > 0) { if (confirm("You have unsaved items. Are you sure you want to discard them and start a new quote?")) { resetQuotationWorkspace(); } } else { resetQuotationWorkspace(); } }); }
    if (savedQuotesHeader) { savedQuotesHeader.addEventListener('click', () => { const content = savedQuotesContent; savedQuotesHeader.classList.toggle('is-open'); if (content.style.maxHeight) { content.style.maxHeight = null; } else { content.style.maxHeight = content.scrollHeight + "px"; } }); }
    quoteSearchInput.addEventListener('input', handleSearchAndFilter);
    if (comboboxContainer) {
        comboboxInputWrapper.addEventListener('click', () => { categoryDropdown.classList.add('visible'); categorySearchInput.focus(); });
        categorySearchInput.addEventListener('input', filterCategoryDropdown);
        selectedPillsArea.addEventListener('click', (e) => { if (e.target.classList.contains('remove-pill-btn')) { const categoryToRemove = e.target.dataset.category; selectedCategories = selectedCategories.filter(cat => cat !== categoryToRemove); renderSelectedPills(); } });
        categoryDropdown.addEventListener('click', (e) => { if (e.target.tagName === 'LI') { const category = e.target.dataset.category; if (!selectedCategories.includes(category)) { selectedCategories.push(category); renderSelectedPills(); } categorySearchInput.value = ''; filterCategoryDropdown(); categoryDropdown.classList.remove('visible'); } });
    }
    document.addEventListener('click', (e) => {
        if (comboboxContainer && !comboboxContainer.contains(e.target)) { categoryDropdown.classList.remove('visible'); }
        if (downloadMenuBtn && !downloadMenuBtn.contains(e.target) && !downloadOptions.contains(e.target)) { downloadOptions.classList.remove('visible'); }
    });
    if (downloadMenuBtn) { downloadMenuBtn.addEventListener('click', (event) => { event.stopPropagation(); downloadOptions.classList.toggle('visible'); }); }
    
    savedQuotesList.addEventListener('click', async (e) => {
        const deleteButton = e.target.closest('.delete-quote-btn');
        const quoteCard = e.target.closest('.quote-card-main');
        if (deleteButton) { const quoteId = deleteButton.dataset.quoteId; if (confirm('Are you sure?')) { try { const r = await fetch(`${API_BASE_URL}/api/quotes/${quoteId}`, { method: 'DELETE', credentials: 'include' }); if (r.ok) { deleteButton.closest('.saved-quote-card').remove(); } else { alert('Failed to delete.'); } } catch (e) { alert('Error deleting.'); } } } else if (quoteCard) { const quoteId = quoteCard.dataset.quoteId; loadSingleQuote(quoteId); }
    });

    if (saveQuoteBtn) {
        saveQuoteBtn.addEventListener('click', async () => {
            // --- NEW CHECK ---
            // Check if account details are complete before proceeding.
            if (!areAccountDetailsComplete(currentUser)) {
                alert('Please complete your billing details in "My Account" before saving a quotation.');
                openAccountModal(); // Guide the user directly to the form
                return; // Stop the function here
            }

            const productRows = selectedProductsTbody.querySelectorAll('tr.selected-product-row');
            if (productRows.length === 0) { return alert('Cannot save an empty quote.'); }
            const lineItems = Array.from(productRows).map(row => {
                const isAdmin = userRole === 'admin';
                return { product: row.dataset.productId, quantity: parseInt(row.querySelector('.quantity-input').value), priceAtTime: parseFloat(isAdmin ? row.querySelector('.price-input').value : row.cells[2].textContent), discountPercentage: parseFloat(isAdmin ? row.querySelector('.discount-input').value : row.cells[4].textContent.replace('%','')) };
            });
            const quoteData = { clientName: clientNameInput.value.trim() || 'N/A', lineItems, subtotal: parseFloat(subtotalAmountSpan.textContent), couponCode: couponDiscountPercentage > 0 ? couponCodeInput.value.trim() : null, couponDiscountPercentage, couponDiscountAmount: parseFloat(discountAmountSpan.textContent) || 0, gstPercentage: GST_RATE, gstAmount: parseFloat(gstAmountSpan.textContent), grandTotal: parseFloat(grandTotalAmountSpan.textContent) };
            try {
                const response = await fetch(`${API_BASE_URL}/api/quotes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quoteData), credentials: 'include' });
                if (response.ok) { const result = await response.json(); alert(`Quote ${result.quoteNumber} saved successfully!`); loadSavedQuotes(); resetQuotationWorkspace(); } 
                else { const errorData = await response.json(); alert(`Error: ${errorData.message}`); }
            } catch (err) { console.error("Error saving quote:", err); alert('An error occurred while saving the quote.'); }
        });
    }

    if (applyCouponBtn) {
        applyCouponBtn.addEventListener('click', async () => {
            const code = couponCodeInput.value.trim();
            if (!code) { couponStatusMessage.textContent = 'Please enter a code.'; couponStatusMessage.style.color = 'var(--color-danger)'; return; }
            try {
                const response = await fetch(`${API_BASE_URL}/api/coupons/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code }), credentials: 'include' });
                const data = await response.json();
                if (response.ok) {
                    couponStatusMessage.textContent = data.message; couponStatusMessage.style.color = 'var(--color-success)';
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
                const discount = isAdmin ? cells[4].querySelector('input').value + '%' : cells[4].textContent;
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

    // Event Listeners for "My Account" Modal
    if (myAccountBtn) myAccountBtn.addEventListener('click', openAccountModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeAccountModal);
    if (accountModal) {
        accountModal.addEventListener('click', (e) => {
            if (e.target === accountModal) closeAccountModal();
        });
    }

    if (copyDetailsLink) {
        copyDetailsLink.addEventListener('click', (e) => {
            e.preventDefault();
            shippingName.value = billingName.value;
            shippingOrganisation.value = billingOrganisation.value;
            shippingContact.value = billingContact.value;
            shippingEmail.value = billingEmail.value;
            shippingAddress.value = billingAddress.value;
            shippingPincode.value = billingPincode.value;
            shippingState.value = billingState.value;
        });
    }

    if (accountForm) {
        accountForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            saveAccountBtn.disabled = true;
            saveAccountBtn.textContent = 'Saving...';
            accountStatusMessage.textContent = '';

            const accountData = {
                billingDetails: {
                    name: billingName.value.trim(),
                    organisation: billingOrganisation.value.trim(),
                    contactNumber: billingContact.value.trim(),
                    address: billingAddress.value.trim(),
                    pinCode: billingPincode.value.trim(),
                    state: billingState.value.trim()
                },
                shippingDetails: {
                    name: shippingName.value.trim(),
                    organisation: shippingOrganisation.value.trim(),
                    contactNumber: shippingContact.value.trim(),
                    email: shippingEmail.value.trim(),
                    address: shippingAddress.value.trim(),
                    pinCode: shippingPincode.value.trim(),
                    state: shippingState.value.trim()
                }
            };

            try {
                const response = await fetch(`${API_BASE_URL}/api/user/account`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(accountData),
                    credentials: 'include'
                });

                const result = await response.json();
                if (response.ok) {
                    currentUser = result.user;
                    userDisplayName.textContent = currentUser.displayName;
                    accountStatusMessage.textContent = 'Changes saved successfully!';
                    accountStatusMessage.style.color = 'var(--color-success)';
                    setTimeout(closeAccountModal, 1500);
                } else {
                    accountStatusMessage.textContent = result.message || 'Failed to save.';
                    accountStatusMessage.style.color = 'var(--color-danger)';
                }
            } catch (err) {
                console.error("Error updating account:", err);
                accountStatusMessage.textContent = 'A network error occurred.';
                accountStatusMessage.style.color = 'var(--color-danger)';
            } finally {
                saveAccountBtn.disabled = false;
                saveAccountBtn.textContent = 'Save Changes';
            }
        });
    }

    // --- Initial Load ---
    checkLoginStatus();
});