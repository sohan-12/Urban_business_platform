// Auth Utilities for Local Business Platform

const auth = {
  // Get token from localStorage
  getToken() {
    return localStorage.getItem('token');
  },

  // Get user profile object from localStorage
  getUser() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch (e) {
      localStorage.removeItem('user');
      return null;
    }
  },

  // Save session details
  saveSession(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  // Check if user is logged in
  isLoggedIn() {
    return !!this.getToken() && !!this.getUser();
  },

  // Clear session and redirect to landing page
  logout() {
    const isAdminPage = window.location.pathname.includes('admin.html') || window.location.pathname.includes('admin-login.html');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = isAdminPage ? '/admin-login.html' : '/index.html';
  },

  // Get Authorization headers for fetch requests
  getHeaders() {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  },

  // Check auth status on page load and redirect if necessary
  protectPage(allowedRoles = []) {
    const path = window.location.pathname;
    const isAdminPath = path.includes('admin.html') || path.includes('admin-login.html');

    if (!this.isLoggedIn()) {
      // Not logged in, redirect to login page
      if (!path.endsWith('index.html') && !path.endsWith('admin-login.html') && path !== '/') {
        window.location.href = isAdminPath ? '/admin-login.html' : '/index.html';
      }
      return;
    }

    const user = this.getUser();
    const role = user.role.toLowerCase();

    if (role === 'admin') {
      if (!path.includes('admin.html')) {
        window.location.href = '/admin.html';
      }
    } else if (role === 'shopkeeper') {
      if (!path.includes('shopkeeper.html')) {
        window.location.href = '/shopkeeper.html';
      }
    } else { // Customer / Regular User
      if (!path.includes('home.html')) {
        window.location.href = '/home.html';
      }
    }

    // Verify if role is allowed on this specific page (additional fallback)
    if (allowedRoles.length > 0 && !allowedRoles.map(r => r.toLowerCase()).includes(role)) {
      // Redirect to correct page based on role
      if (role === 'admin') window.location.href = '/admin.html';
      else if (role === 'shopkeeper') window.location.href = '/shopkeeper.html';
      else window.location.href = '/home.html';
    }
  },

  // Set up theme toggle logic
  initTheme() {
    const isDark = localStorage.getItem('dark-theme') === 'true';
    if (isDark) {
      document.body.classList.add('dark-theme');
    }
    
    // Setup listeners for theme toggles if they exist on the page
    setTimeout(() => {
      const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
      toggleBtns.forEach(btn => {
        // Set initial icon state
        btn.innerHTML = document.body.classList.contains('dark-theme') ? '☀️' : '🌙';
        
        btn.addEventListener('click', () => {
          const body = document.body;
          body.classList.toggle('dark-theme');
          const darkActive = body.classList.contains('dark-theme');
          localStorage.setItem('dark-theme', darkActive ? 'true' : 'false');
          btn.innerHTML = darkActive ? '☀️' : '🌙';
        });
      });
    }, 100);
  },

  // UI Toast Notification helper
  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    // Auto-remove toast
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

// Auto run theme initialisation on load
document.addEventListener('DOMContentLoaded', () => {
  auth.initTheme();
});
