// Admin Dashboard Controller

let allDirectoryBusinesses = [];
let shopkeepersList = [];
let editingBizId = null;

// Protect page access
auth.protectPage(['admin']);

document.addEventListener('DOMContentLoaded', () => {
  // 1. Display Admin Profile details
  const user = auth.getUser();
  if (user) {
    document.getElementById('user-display').innerHTML = `
      Welcome, <strong>${user.name}</strong> 
      <span class="nav-role-badge" style="font-size: 0.65rem; background:rgba(6, 182, 212, 0.1); color:var(--accent-color);">Admin</span>
    `;
  }

  // 2. Fetch platform data
  fetchStats();
  fetchShopkeepers();
  fetchPendingRequests();
  fetchDirectoryListings();
});

// Fetch platform usage metrics
async function fetchStats() {
  try {
    const response = await fetch('/api/admin/stats', {
      method: 'GET',
      headers: auth.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch platform statistics');
    }

    const data = await response.json();

    document.getElementById('stat-shops-count').innerText = data.totalBusinesses;
    document.getElementById('stat-items-count').innerText = data.totalItems;
    document.getElementById('stat-reviews-count').innerText = data.totalReviews;
    document.getElementById('stat-users-count').innerText = data.users.total;
    
    document.getElementById('stat-users-breakdown').innerHTML = `
      Admins: <strong>${data.users.admins}</strong> | 
      Shopkeepers: <strong>${data.users.shopkeepers}</strong> | 
      Customers: <strong>${data.users.customers}</strong>
    `;
  } catch (error) {
    console.error(error);
    auth.showToast('Could not load statistics.', 'error');
  }
}

// Fetch list of shopkeepers to populate assignment dropdown
async function fetchShopkeepers() {
  try {
    const response = await fetch('/api/auth/shopkeepers', {
      method: 'GET',
      headers: auth.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch shopkeeper list');
    }

    shopkeepersList = await response.json();

    const select = document.getElementById('biz-owner');
    
    // Clear and keep default "Unassigned"
    select.innerHTML = '<option value="">-- None (Unassigned) --</option>';
    
    shopkeepersList.forEach(sk => {
      const opt = document.createElement('option');
      opt.value = sk.id;
      // Include proposed shop details if they registered them
      const shopInfo = sk.shop_name 
        ? ` [Proposed Shop: ${sk.shop_name} - ${sk.ownership_type}, LIC: ${sk.license_number || 'N/A'}]` 
        : '';
      opt.innerText = `${sk.name} (${sk.email})${shopInfo}`;
      select.appendChild(opt);
    });
  } catch (error) {
    console.error(error);
    auth.showToast('Could not load shopkeepers list.', 'error');
  }
}

// Fetch complete business listings
async function fetchDirectoryListings() {
  const tbody = document.getElementById('directory-table-body');
  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted);">
        Loading directory database...
      </td>
    </tr>
  `;

  try {
    const response = await fetch('/api/businesses', {
      method: 'GET',
      headers: auth.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch businesses');
    }

    allDirectoryBusinesses = await response.json();
    renderDirectory(allDirectoryBusinesses);
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem; color: var(--danger-color);">
          Error loading directory data.
        </td>
      </tr>
    `;
    auth.showToast('Could not load businesses directory.', 'error');
  }
}

// Render business data into directory table
function renderDirectory(businesses) {
  const tbody = document.getElementById('directory-table-body');
  
  if (businesses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted);">
          No businesses match your search filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';
  businesses.forEach(biz => {
    const tr = document.createElement('tr');
    const ratingVal = parseFloat(biz.avg_rating || 0);
    
    // Helper stars drawer
    let starsStr = '';
    const rounded = Math.round(ratingVal);
    for (let i = 1; i <= 5; i++) {
      starsStr += i <= rounded ? '★' : '☆';
    }

    const ownerText = biz.owner_name 
      ? `<strong>${biz.owner_name}</strong>` 
      : '<em style="color: var(--text-muted)">Unassigned</em>';

    tr.innerHTML = `
      <td style="font-weight: 700; color: var(--text-main);">${biz.name}</td>
      <td><span class="nav-role-badge" style="margin-left:0; font-size:0.75rem;">${biz.category}</span></td>
      <td style="font-size:0.85rem; color: var(--text-muted);">${biz.address}</td>
      <td style="font-size:0.88rem;">${ownerText}</td>
      <td>
        <span style="color: var(--warning-color); letter-spacing:-1px;">${starsStr}</span>
        <span style="font-size:0.85rem; font-weight:700; margin-left:0.25rem;">
          ${ratingVal > 0 ? ratingVal.toFixed(1) : '0.0'}
        </span>
      </td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm" onclick="openBusinessModal('edit', ${biz.id})" style="padding: 0.35rem 0.7rem; font-size: 0.8rem;">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteBusiness(${biz.id}, '${biz.name}')" style="padding: 0.35rem 0.7rem; font-size: 0.8rem;">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Client-side search filtration on table directory
function filterDirectory() {
  const term = document.getElementById('dir-search-input').value.toLowerCase().trim();
  
  if (!term) {
    renderDirectory(allDirectoryBusinesses);
    return;
  }

  const filtered = allDirectoryBusinesses.filter(biz => {
    return (
      biz.name.toLowerCase().includes(term) ||
      biz.address.toLowerCase().includes(term) ||
      biz.category.toLowerCase().includes(term) ||
      (biz.owner_name && biz.owner_name.toLowerCase().includes(term))
    );
  });

  renderDirectory(filtered);
}

// Open Business Add/Edit Modal
function openBusinessModal(mode, bizId = null) {
  const modal = document.getElementById('biz-modal');
  const title = document.getElementById('biz-modal-title');
  const form = document.getElementById('biz-form');

  if (mode === 'add') {
    title.innerText = 'Add New Business Listing';
    form.reset();
    editingBizId = null;
  } else {
    title.innerText = 'Edit Business Listing';
    editingBizId = bizId;

    const biz = allDirectoryBusinesses.find(b => b.id === bizId);
    if (biz) {
      document.getElementById('biz-name').value = biz.name;
      document.getElementById('biz-category').value = biz.category;
      document.getElementById('biz-description').value = biz.description || '';
      document.getElementById('biz-address').value = biz.address;
      document.getElementById('biz-price').value = biz.price_range || '$$';
      document.getElementById('biz-phone').value = biz.phone || '';
      document.getElementById('biz-latitude').value = biz.latitude || '';
      document.getElementById('biz-longitude').value = biz.longitude || '';
      document.getElementById('biz-owner').value = biz.owner_id || '';
    }
  }

  modal.classList.add('open');
}

// Close Modal
function closeBusinessModal() {
  document.getElementById('biz-modal').classList.remove('open');
  editingBizId = null;
}

// Submit Business Listing (Add or Edit)
async function handleBusinessSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('biz-name').value.trim();
  const category = document.getElementById('biz-category').value;
  const description = document.getElementById('biz-description').value.trim();
  const address = document.getElementById('biz-address').value.trim();
  const price_range = document.getElementById('biz-price').value;
  const phone = document.getElementById('biz-phone').value.trim();
  const latitude = parseFloat(document.getElementById('biz-latitude').value) || 0;
  const longitude = parseFloat(document.getElementById('biz-longitude').value) || 0;
  const owner_id = parseInt(document.getElementById('biz-owner').value) || null;

  const payload = {
    name, category, description, address, price_range, phone, latitude, longitude, owner_id
  };

  try {
    let url = '/api/businesses';
    let method = 'POST';

    if (editingBizId) {
      url = `/api/businesses/${editingBizId}`;
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
        editingBizId ? 'Business listing updated successfully!' : 'Business listing added successfully!', 
        'success'
      );
      closeBusinessModal();
      
      // Refresh directory listings & stats
      fetchStats();
      fetchDirectoryListings();
    } else {
      auth.showToast(data.message || 'Error saving listing.', 'error');
    }
  } catch (error) {
    console.error(error);
    auth.showToast('Network error, please try again.', 'error');
  }
}

// Handle deleting a business
async function deleteBusiness(bizId, bizName) {
  if (!confirm(`Are you sure you want to completely delete "${bizName}" from the platform?\nThis will remove all associated products and reviews.`)) {
    return;
  }

  try {
    const response = await fetch(`/api/businesses/${bizId}`, {
      method: 'DELETE',
      headers: auth.getHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      auth.showToast('Business listing deleted successfully!', 'success');
      
      // Refresh directory listings & stats
      fetchStats();
      fetchDirectoryListings();
    } else {
      auth.showToast(data.message || 'Error deleting business.', 'error');
    }
  } catch (error) {
    console.error(error);
    auth.showToast('Network error, please try again.', 'error');
  }
}

// Fetch pending shopkeeper business listing requests
async function fetchPendingRequests() {
  const container = document.getElementById('pending-requests-section');
  const tbody = document.getElementById('pending-table-body');
  const countSpan = document.getElementById('pending-count');
  
  // Notification banner elements
  const banner = document.getElementById('admin-notification-banner');
  const notifyCount = document.getElementById('notification-count');

  try {
    const response = await fetch('/api/admin/business-requests', {
      method: 'GET',
      headers: auth.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch pending requests');
    }

    const requests = await response.json();
    countSpan.innerText = `${requests.length} pending requests`;

    if (requests.length === 0) {
      container.style.display = 'none';
      if (banner) banner.style.display = 'none';
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            No pending registration requests.
          </td>
        </tr>
      `;
      return;
    }

    // Show top notification banner & table section
    if (banner) {
      banner.style.display = 'flex';
      notifyCount.innerText = requests.length;
    }
    container.style.display = 'block';
    tbody.innerHTML = '';

    requests.forEach(req => {
      const tr = document.createElement('tr');
      
      // Parse proposed items list
      let itemsListHtml = '';
      try {
        const items = JSON.parse(req.items_json);
        if (Array.isArray(items) && items.length > 0) {
          itemsListHtml = '<ul style="margin: 0; padding-left: 1rem; font-size: 0.82rem; color: var(--text-muted); max-height: 100px; overflow-y: auto;">';
          items.forEach(it => {
            itemsListHtml += `<li><strong>${it.name}</strong> ($${parseFloat(it.price).toFixed(2)})<br><span style="font-size:0.75rem; opacity:0.8;">${it.description || ''}</span></li>`;
          });
          itemsListHtml += '</ul>';
        } else {
          itemsListHtml = '<em style="color:var(--text-muted); font-size:0.8rem;">No products proposed</em>';
        }
      } catch (e) {
        itemsListHtml = '<em style="color:var(--text-muted); font-size:0.8rem;">Error parsing products</em>';
      }

      tr.innerHTML = `
        <td>
          <div style="font-weight: 700;">${req.shopkeeper_name}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${req.shopkeeper_email}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--primary-color);">${req.name}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; max-width: 180px;">${req.description || 'No description'}</div>
        </td>
        <td><span class="nav-role-badge" style="margin-left: 0; font-size: 0.75rem;">${req.category}</span></td>
        <td style="font-size: 0.85rem; color: var(--text-muted);">
          <div>📍 ${req.address}</div>
          <div style="font-size: 0.8rem; margin-top: 0.25rem;">📞 ${req.phone || 'No phone'}</div>
        </td>
        <td>${itemsListHtml}</td>
        <td>
          <div class="table-actions" style="justify-content: center; gap: 0.5rem;">
            <button class="btn btn-success btn-sm" onclick="grantRequest(${req.id})" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; font-weight:700;">Grant</button>
            <button class="btn btn-danger btn-sm" onclick="declineRequest(${req.id})" style="padding: 0.35rem 0.7rem; font-size: 0.8rem;">Decline</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error(error);
    container.style.display = 'none';
    if (banner) banner.style.display = 'none';
  }
}

// Grant shop request and auto-generate business & items
async function grantRequest(id) {
  try {
    const response = await fetch(`/api/admin/grant-request/${id}`, {
      method: 'POST',
      headers: auth.getHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      auth.showToast('Shop request granted! Store & products created successfully.', 'success');
      
      // Refresh admin dashboard stats & directory tables
      fetchStats();
      fetchShopkeepers();
      fetchPendingRequests();
      fetchDirectoryListings();
    } else {
      auth.showToast(data.message || 'Error granting shop request.', 'error');
    }
  } catch (error) {
    console.error(error);
    auth.showToast('Network error during approval.', 'error');
  }
}

// Decline shop request
async function declineRequest(id) {
  if (!confirm('Are you sure you want to decline and remove this shop listing request?')) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/decline-request/${id}`, {
      method: 'POST',
      headers: auth.getHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      auth.showToast('Shop listing request declined and removed.', 'success');
      
      // Refresh list
      fetchStats();
      fetchPendingRequests();
    } else {
      auth.showToast(data.message || 'Error declining request.', 'error');
    }
  } catch (error) {
    console.error(error);
    auth.showToast('Network error during decline.', 'error');
  }
}

// Helper to scroll down to review requested shops
function scrollToPendingSection() {
  const section = document.getElementById('pending-requests-section');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
  }
}
