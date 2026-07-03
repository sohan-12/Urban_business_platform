// Shopkeeper Dashboard Controller

let myShops = [];
let currentShop = null;
let editingItemId = null;

// Protect page access
auth.protectPage(['shopkeeper']);

document.addEventListener('DOMContentLoaded', () => {
  // 1. Display Shopkeeper Profile info
  const user = auth.getUser();
  if (user) {
    document.getElementById('user-display').innerHTML = `
      Welcome, <strong>${user.name}</strong> 
      <span class="nav-role-badge" style="font-size: 0.65rem;">Shopkeeper</span>
    `;
  }

  // 2. Check active request or fetch businesses
  checkMyRequestState();
});

// Check if there is an active pending shop listing request
async function checkMyRequestState() {
  try {
    const response = await fetch('/api/business-requests/my-request', {
      method: 'GET',
      headers: auth.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch request state');
    }

    const pendingRequest = await response.json();

    if (pendingRequest) {
      showPendingApprovalScreen(pendingRequest);
      return;
    }

    // No pending request, check approved listings
    fetchMyBusinesses();
  } catch (error) {
    console.error(error);
    fetchMyBusinesses();
  }
}

// Display pending approval notice with proposed details and menu items
function showPendingApprovalScreen(req) {
  document.getElementById('pending-approval-view').style.display = 'block';
  document.getElementById('no-shops-view').style.display = 'none';
  document.getElementById('active-management-view').style.display = 'none';
  document.getElementById('request-shop-view').style.display = 'none';
  
  // Hide shop selector container
  const selectorContainer = document.querySelector('main > .glass-container');
  if (selectorContainer) {
    selectorContainer.style.display = 'none';
  }

  // Populate details
  document.getElementById('pending-shop-name').innerText = req.name;
  document.getElementById('pending-shop-category').innerText = req.category;
  document.getElementById('pending-shop-address').innerText = req.address;

  // Render items list
  const list = document.getElementById('pending-items-list');
  list.innerHTML = '';
  
  let items = [];
  try {
    items = JSON.parse(req.items_json);
  } catch (e) {
    console.error(e);
  }

  if (Array.isArray(items) && items.length > 0) {
    items.forEach(it => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${it.name}</strong> - $${parseFloat(it.price).toFixed(2)} <em>(${it.description || 'No description'})</em>`;
      list.appendChild(li);
    });
  } else {
    list.innerHTML = '<li style="list-style: none; color: var(--text-muted);">No products submitted.</li>';
  }
}

// Fetch all businesses owned by this shopkeeper
async function fetchMyBusinesses() {
  try {
    const response = await fetch('/api/my-businesses', {
      method: 'GET',
      headers: auth.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch shopkeeper businesses');
    }

    myShops = await response.json();
    updateDashboardView();
  } catch (error) {
    console.error(error);
    auth.showToast('Error loading your shops.', 'error');
  }
}

// Show/Hide sections depending on whether the shopkeeper has listed shops or requests
function updateDashboardView() {
  const activeView = document.getElementById('active-management-view');
  const emptyView = document.getElementById('no-shops-view');
  const requestView = document.getElementById('request-shop-view');
  const selector = document.getElementById('shop-selector');
  const statShops = document.getElementById('stat-shops-count');
  const requestBtn = document.getElementById('btn-request-another-shop');

  statShops.innerText = myShops.length;

  if (myShops.length === 0) {
    activeView.style.display = 'none';
    emptyView.style.display = 'none';
    requestView.style.display = 'block';
    
    // Hide selector container
    const selectorContainer = document.querySelector('main > .glass-container');
    if (selectorContainer) {
      selectorContainer.style.display = 'none';
    }

    // Pre-fill form using details from registration
    const user = auth.getUser();
    if (user) {
      if (user.shop_name) document.getElementById('req-shop-name').value = user.shop_name;
      if (user.shop_category) document.getElementById('req-shop-category').value = user.shop_category;
      if (user.shop_address) document.getElementById('req-shop-address').value = user.shop_address;
      if (user.business_phone) document.getElementById('req-shop-phone').value = user.business_phone;
    }

    // Auto-add initial product row if list is empty
    const menuItems = document.getElementById('request-menu-items');
    if (menuItems && menuItems.children.length === 0) {
      addRequestMenuItemRow();
    }

    document.getElementById('stat-items-count').innerText = '0';
    document.getElementById('stat-reviews-count').innerText = '0';
    return;
  }

  activeView.style.display = 'grid';
  emptyView.style.display = 'none';
  requestView.style.display = 'none';

  const selectorContainer = document.querySelector('main > .glass-container');
  if (selectorContainer) {
    selectorContainer.style.display = 'flex';
  }

  if (requestBtn) requestBtn.style.display = 'block';

  // Populate Shop Selection Dropdown
  selector.innerHTML = '';
  myShops.forEach(shop => {
    const opt = document.createElement('option');
    opt.value = shop.id;
    opt.innerText = shop.name;
    selector.appendChild(opt);
  });

  // Load the first shop initially
  loadSelectedShopData();
}

// Toggle showing the listing request form vs active management dashboard
function toggleRequestShopForm(show) {
  const activeView = document.getElementById('active-management-view');
  const requestView = document.getElementById('request-shop-view');
  const cancelBtn = document.getElementById('btn-cancel-request');
  const requestBtn = document.getElementById('btn-request-another-shop');
  
  if (show) {
    activeView.style.display = 'none';
    requestView.style.display = 'block';
    
    if (requestBtn) requestBtn.style.display = 'none';
    
    if (myShops.length > 0) {
      if (cancelBtn) cancelBtn.style.display = 'block';
      // Clear form so they can type a brand new store listing
      document.getElementById('shop-request-form').reset();
      document.getElementById('request-menu-items').innerHTML = '';
      addRequestMenuItemRow();
    } else {
      if (cancelBtn) cancelBtn.style.display = 'none';
    }
  } else {
    activeView.style.display = 'grid';
    requestView.style.display = 'none';
    if (requestBtn) requestBtn.style.display = 'block';
    if (cancelBtn) cancelBtn.style.display = 'none';
  }
}

// Fetch and load details for the selected shop (including items & reviews)
async function loadSelectedShopData() {
  const shopId = document.getElementById('shop-selector').value;
  if (!shopId) return;

  const metaInfo = document.getElementById('shop-meta-info');
  metaInfo.innerHTML = 'Loading shop details...';

  try {
    const response = await fetch(`/api/businesses/${shopId}`, {
      method: 'GET',
      headers: auth.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch details for shop: ' + shopId);
    }

    const shop = await response.json();
    currentShop = shop;

    // Set meta text
    metaInfo.innerHTML = `
      Category: <strong>${shop.category}</strong> | 
      📍 ${shop.address} | 
      📞 ${shop.phone || 'No phone'}
    `;

    // Render items table
    renderProductsTable(shop.items);

    // Render reviews list
    renderReviewsList(shop.reviews);

    // Update statistics
    document.getElementById('stat-items-count').innerText = shop.items.length;
    document.getElementById('stat-reviews-count').innerText = shop.reviews.length;
  } catch (error) {
    console.error(error);
    metaInfo.innerHTML = '<span style="color:var(--danger-color)">Error loading details.</span>';
    auth.showToast('Could not load shop details.', 'error');
  }
}

// Render products list in the table
function renderProductsTable(items) {
  const tbody = document.getElementById('products-table-body');
  
  if (!items || items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No products listed for this shop yet. Click <strong>✚ Add Product</strong> to list items.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';
  items.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 700; color: var(--text-main);">${item.name}</td>
      <td style="color: var(--text-muted); font-size: 0.85rem;">${item.description || 'No description'}</td>
      <td style="font-weight: 800; color: var(--success-color); font-family: var(--font-heading);">$${parseFloat(item.price).toFixed(2)}</td>
      <td>
        <div class="table-actions" style="justify-content: center;">
          <button class="btn btn-secondary btn-sm" onclick="openItemModal('edit', ${item.id})" style="padding: 0.3rem 0.6rem;">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem(${item.id})" style="padding: 0.3rem 0.6rem;">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render customer reviews list
function renderReviewsList(reviews) {
  const container = document.getElementById('shop-reviews-list');
  
  if (!reviews || reviews.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
        No reviews received yet for this shop.
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  reviews.forEach(rev => {
    const div = document.createElement('div');
    div.className = 'review-item';
    
    const dateStr = new Date(rev.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });

    // Helper to draw stars
    let starsStr = '';
    for (let i = 1; i <= 5; i++) {
      starsStr += i <= rev.rating ? '★' : '☆';
    }

    div.innerHTML = `
      <div class="review-meta" style="margin-bottom:0.2rem;">
        <div>
          <span class="review-user" style="font-size:0.9rem;">${rev.user_name}</span>
          <span style="color: var(--warning-color); font-size:0.85rem; margin-left:0.3rem; letter-spacing: -1px;">${starsStr}</span>
        </div>
        <span class="review-date" style="font-size:0.75rem;">${dateStr}</span>
      </div>
      <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">${rev.comment || 'No comment provided.'}</p>
    `;
    container.appendChild(div);
  });
}

// Open Item Form Modal (Add or Edit mode)
function openItemModal(mode, itemId = null) {
  const modal = document.getElementById('item-modal');
  const title = document.getElementById('item-modal-title');
  const form = document.getElementById('item-form');
  
  if (mode === 'add') {
    title.innerText = 'Add New Product';
    form.reset();
    editingItemId = null;
  } else {
    title.innerText = 'Edit Product';
    editingItemId = itemId;

    // Fetch item details from currentShop local data
    const item = currentShop.items.find(i => i.id === itemId);
    if (item) {
      document.getElementById('item-name').value = item.name;
      document.getElementById('item-description').value = item.description || '';
      document.getElementById('item-price').value = item.price;
    }
  }

  modal.classList.add('open');
}

// Close Modal
function closeItemModal() {
  document.getElementById('item-modal').classList.remove('open');
  editingItemId = null;
}

// Handle Add/Edit Form submission
async function handleItemSubmit(e) {
  e.preventDefault();

  if (!currentShop) return;

  const name = document.getElementById('item-name').value.trim();
  const description = document.getElementById('item-description').value.trim();
  const price = parseFloat(document.getElementById('item-price').value);

  const payload = { name, description, price };

  try {
    let url = `/api/businesses/${currentShop.id}/items`;
    let method = 'POST';

    // If editing, use the items update endpoint
    if (editingItemId) {
      url = `/api/items/${editingItemId}`;
      method = 'PUT';
    }

    const response = await fetch(url, {
      method: method,
      headers: auth.getHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      auth.showToast(
        editingItemId ? 'Product updated successfully!' : 'Product added successfully!', 
        'success'
      );
      closeItemModal();
      loadSelectedShopData(); // Refresh list
    } else {
      auth.showToast(data.message || 'Error saving product.', 'error');
    }
  } catch (error) {
    console.error(error);
    auth.showToast('Network error, please try again.', 'error');
  }
}

// Handle Product deletion
async function deleteItem(itemId) {
  if (!confirm('Are you sure you want to delete this product?')) {
    return;
  }

  try {
    const response = await fetch(`/api/items/${itemId}`, {
      method: 'DELETE',
      headers: auth.getHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      auth.showToast('Product deleted successfully!', 'success');
      loadSelectedShopData(); // Refresh list
    } else {
      auth.showToast(data.message || 'Error deleting product.', 'error');
    }
  } catch (error) {
    console.error(error);
    auth.showToast('Network error, please try again.', 'error');
  }
}

// Add a new row to the proposed products builder in the shop listing request form
function addRequestMenuItemRow() {
  const container = document.getElementById('request-menu-items');
  const div = document.createElement('div');
  div.className = 'request-item-row';
  div.style.cssText = 'display: grid; grid-template-columns: 1.2fr 1.5fr 0.6fr 40px; gap: 0.75rem; margin-bottom: 0.75rem; align-items: start;';
  
  div.innerHTML = `
    <input type="text" class="form-control item-name-input" placeholder="Item Name (e.g. Special Pizza)" required>
    <input type="text" class="form-control item-desc-input" placeholder="Description (optional)">
    <input type="number" class="form-control item-price-input" placeholder="Price ($)" step="0.01" min="0" required style="width: 100%;">
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()" style="height: 38px; line-height: 20px; font-weight: 700; padding:0;">×</button>
  `;
  container.appendChild(div);
}

// Handle submission of a shop listing request
async function submitShopRequest(e) {
  e.preventDefault();

  const name = document.getElementById('req-shop-name').value.trim();
  const category = document.getElementById('req-shop-category').value;
  const description = document.getElementById('req-shop-description').value.trim();
  const address = document.getElementById('req-shop-address').value.trim();
  const phone = document.getElementById('req-shop-phone').value.trim();

  // Extract menu items
  const items = [];
  const rows = document.querySelectorAll('.request-item-row');
  rows.forEach(row => {
    const itemName = row.querySelector('.item-name-input').value.trim();
    const itemDesc = row.querySelector('.item-desc-input').value.trim();
    const itemPrice = parseFloat(row.querySelector('.item-price-input').value) || 0.0;
    
    if (itemName) {
      items.push({
        name: itemName,
        description: itemDesc || null,
        price: itemPrice
      });
    }
  });

  if (items.length === 0) {
    auth.showToast('Please add at least one product or menu item to your listing request.', 'error');
    return;
  }

  const payload = {
    name,
    category,
    description,
    address,
    phone,
    price_range: '$$', // Default price range
    latitude: 0.0,
    longitude: 0.0,
    items
  };

  try {
    const response = await fetch('/api/business-requests', {
      method: 'POST',
      headers: auth.getHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      auth.showToast('Listing request submitted successfully!', 'success');
      // Reset form
      document.getElementById('shop-request-form').reset();
      document.getElementById('request-menu-items').innerHTML = '';
      
      // Reload UI state
      checkMyRequestState();
    } else {
      auth.showToast(data.message || 'Error submitting request.', 'error');
    }
  } catch (error) {
    console.error(error);
    auth.showToast('Network error, please try again.', 'error');
  }
}
