// Customer Homepage Logic

let activeCategory = '';
let currentSearch = '';
let currentBusiness = null;
let selectedRating = 5;

// Protect page and ensure the user is logged in
auth.protectPage(['user', 'customer']);

document.addEventListener('DOMContentLoaded', () => {
  // 1. Display user details in header
  const user = auth.getUser();
  if (user) {
    document.getElementById('user-display').innerHTML = `
      Welcome, <strong>${user.name}</strong> 
      <span class="nav-role-badge" style="font-size: 0.65rem;">Customer</span>
    `;
  }

  // 2. Load initial businesses list
  fetchBusinesses();

  // 3. Set up Category Filters listeners
  setupCategoryFilters();

  // 4. Set initial review stars selection
  setReviewRating(5);
});

// Setup Category Pill Click Event Listeners
function setupCategoryFilters() {
  const container = document.getElementById('category-filters-container');
  const chips = container.querySelectorAll('.category-chip');

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      // Remove active class from all chips
      chips.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked chip
      chip.classList.add('active');

      // Update active category
      activeCategory = chip.getAttribute('data-category');
      
      // Re-fetch businesses
      fetchBusinesses(currentSearch, activeCategory);
    });
  });
}

// Triggered when searching
function triggerSearch(e) {
  e.preventDefault();
  currentSearch = document.getElementById('search-input').value.trim();
  fetchBusinesses(currentSearch, activeCategory);
}

// Fetch businesses from Backend API
async function fetchBusinesses(search = '', category = '') {
  const grid = document.getElementById('businesses-grid');
  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
      <p>Loading listings...</p>
    </div>
  `;

  try {
    let url = '/api/businesses';
    const params = [];
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (category) params.push(`category=${encodeURIComponent(category)}`);
    
    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: auth.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch businesses');
    }

    const businesses = await response.json();
    renderBusinesses(businesses);
  } catch (error) {
    console.error(error);
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--danger-color);">
        <p>Error loading businesses. Please try again later.</p>
      </div>
    `;
    auth.showToast('Could not load listings.', 'error');
  }
}

// Render business cards into grid
function renderBusinesses(businesses) {
  const grid = document.getElementById('businesses-grid');
  const countSpan = document.getElementById('listings-count');
  
  countSpan.innerText = `Showing ${businesses.length} listings`;

  if (businesses.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
        <h3 style="margin-bottom: 0.5rem;">No listings found</h3>
        <p>Try clearing your search or filters to see more results.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = '';

  businesses.forEach(biz => {
    const card = document.createElement('div');
    card.className = 'business-card';
    
    // Determine category emoji
    const emojiMap = {
      'hotels': '🏨', 'restaurants': '🍔', 'tiffins': '🥞', 'salons': '💇', 'parlours': '💅',
      'stores': '🛒', 'markets': '🍎', 'gyms': '💪', 'cafes': '☕', 'clubs': '🎉'
    };
    const emoji = emojiMap[biz.category.toLowerCase()] || '💼';
    const ratingVal = parseFloat(biz.avg_rating || 0);

    card.innerHTML = `
      <div class="card-img-placeholder" onclick="openModal(${biz.id})" style="cursor: pointer;">
        <span style="font-size: 3.5rem;">${emoji}</span>
        <span class="card-category-badge">${biz.category}</span>
        <span class="card-price-badge">${biz.price_range || '$$'}</span>
      </div>
      <div class="card-body" onclick="openModal(${biz.id})" style="cursor: pointer;">
        <h3 class="card-title">${biz.name}</h3>
        <div class="rating-container">
          <span class="stars">${renderStars(ratingVal)}</span>
          <span class="rating-value">${ratingVal > 0 ? ratingVal.toFixed(1) : 'No reviews'}</span>
          <span class="review-count">(${biz.review_count})</span>
        </div>
        <p class="card-desc">${biz.description || 'No description available for this business listing.'}</p>
        <div class="card-address">
          <span>📍</span> <span>${biz.address}</span>
        </div>
      </div>
      <div class="card-footer">
        <button class="btn btn-secondary btn-sm" onclick="openModal(${biz.id})" style="flex: 1;">Details</button>
        <button class="btn btn-primary btn-sm" onclick="openMap(${biz.latitude}, ${biz.longitude})" style="flex: 1;">
          View Map
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Generate stars string
function renderStars(rating) {
  const rounded = Math.round(rating);
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += i <= rounded ? '★' : '☆';
  }
  return stars;
}

// Open Google Maps in new tab
function openMap(lat, lng) {
  if (!lat || !lng || (lat === 0 && lng === 0)) {
    auth.showToast('Location coordinates not set for this business.', 'error');
    return;
  }
  window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
}

// Open detailed business modal
async function openModal(id) {
  const modal = document.getElementById('business-modal');
  
  try {
    const response = await fetch(`/api/businesses/${id}`, {
      method: 'GET',
      headers: auth.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch details');
    }

    const biz = await response.json();
    currentBusiness = biz;

    // Populate modal fields
    document.getElementById('modal-biz-name').innerText = biz.name;
    document.getElementById('modal-biz-category').innerText = biz.category;
    document.getElementById('modal-biz-price').innerText = biz.price_range || '$$';
    
    const ratingVal = parseFloat(biz.avg_rating || 0);
    document.getElementById('modal-biz-stars').innerText = renderStars(ratingVal);
    document.getElementById('modal-biz-rating-val').innerText = ratingVal > 0 ? ratingVal.toFixed(1) : 'Unrated';
    document.getElementById('modal-biz-reviews-count').innerText = `(${biz.review_count} reviews)`;
    
    document.getElementById('modal-biz-desc').innerText = biz.description || 'No description provided.';
    document.getElementById('modal-biz-address').innerText = biz.address;
    document.getElementById('modal-biz-phone').innerText = biz.phone || 'Not available';

    // Map button
    document.getElementById('modal-biz-map-btn').onclick = () => openMap(biz.latitude, biz.longitude);

    // Render items list
    renderModalItems(biz.items);

    // Render reviews
    renderModalReviews(biz.reviews);

    // Reset fields in review submission
    document.getElementById('review-comment').value = '';
    setReviewRating(5);

    // Show modal
    modal.classList.add('open');
    switchModalTab('about');
  } catch (error) {
    console.error(error);
    auth.showToast('Could not load business details.', 'error');
  }
}

// Close detailed business modal
function closeModal() {
  document.getElementById('business-modal').classList.remove('open');
  currentBusiness = null;
}

// Switch tabs inside modal
function switchModalTab(tabName) {
  const tabs = ['about', 'items', 'reviews'];
  tabs.forEach(t => {
    const tabEl = document.getElementById(`m-tab-${t}`);
    const paneEl = document.getElementById(`pane-${t}`);
    
    if (t === tabName) {
      tabEl.classList.add('active');
      paneEl.classList.add('active');
    } else {
      tabEl.classList.remove('active');
      paneEl.classList.remove('active');
    }
  });
}

// Render items list inside modal
function renderModalItems(items) {
  const container = document.getElementById('modal-items-list');
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <p>No products or items listed by the shopkeeper yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <div class="item-details">
        <h4>${item.name}</h4>
        <p>${item.description || 'No description available.'}</p>
      </div>
      <div class="item-price">$${parseFloat(item.price).toFixed(2)}</div>
    `;
    container.appendChild(row);
  });
}

// Render reviews list inside modal
function renderModalReviews(reviews) {
  const container = document.getElementById('modal-reviews-list');
  if (!reviews || reviews.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted);" id="no-reviews-msg">
        <p>No reviews yet. Be the first to leave one!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  reviews.forEach(rev => {
    const item = document.createElement('div');
    item.className = 'review-item';
    
    const dateStr = new Date(rev.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });

    item.innerHTML = `
      <div class="review-meta">
        <div>
          <span class="review-user">${rev.user_name}</span>
          <span style="color: var(--warning-color); margin-left: 0.5rem; letter-spacing: -1px;">
            ${renderStars(rev.rating)}
          </span>
        </div>
        <span class="review-date">${dateStr}</span>
      </div>
      <p class="review-comment">${rev.comment || 'No comment provided.'}</p>
    `;
    container.appendChild(item);
  });
}

// Handle star button highlighting in review selection
function setReviewRating(rating) {
  selectedRating = rating;
  const stars = document.querySelectorAll('.rating-star-btn');
  stars.forEach((star, index) => {
    if (index < rating) {
      star.classList.add('selected');
      star.innerText = '★';
    } else {
      star.classList.remove('selected');
      star.innerText = '☆';
    }
  });
}

// Submit Customer Review
async function submitReview() {
  if (!currentBusiness) return;

  const comment = document.getElementById('review-comment').value.trim();

  try {
    const response = await fetch(`/api/businesses/${currentBusiness.id}/reviews`, {
      method: 'POST',
      headers: auth.getHeaders(),
      body: JSON.stringify({ rating: selectedRating, comment })
    });

    const data = await response.json();

    if (response.ok) {
      auth.showToast('Thank you! Review submitted successfully.', 'success');
      
      // Reload this business modal details to reflect the new rating and list
      openModal(currentBusiness.id);
      
      // Also reload the main grid in the background to update the average star counts
      fetchBusinesses(currentSearch, activeCategory);
    } else {
      auth.showToast(data.message || 'Failed to submit review.', 'error');
    }
  } catch (err) {
    console.error(err);
    auth.showToast('Network error, please try again.', 'error');
  }
}
