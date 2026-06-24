// ═══════════════════════════════════════
// ADMIN LOGIN — login.js
// ═══════════════════════════════════════

const API_BASE = '/api';

// Check if already logged in
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('srg_token');
  if (token) {
    verifyAndRedirect(token);
  }
});

async function verifyAndRedirect(token) {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      window.location.href = 'dashboard.html';
    } else {
      localStorage.removeItem('srg_token');
      localStorage.removeItem('srg_user');
    }
  } catch {
    // Network error, stay on login
  }
}


// Login form
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const errorMsg = document.getElementById('errorMsg');
  const original = btn.innerHTML;

  errorMsg.textContent = '';
  btn.innerHTML = '<span class="spinner"></span> Signing in...';
  btn.disabled = true;

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem('srg_token', data.token);
      localStorage.setItem('srg_user', JSON.stringify(data.user));
      window.location.href = 'dashboard.html';
    } else {
      errorMsg.textContent = data.error || 'Invalid credentials';
    }
  } catch (err) {
    errorMsg.textContent = 'Network error. Please try again.';
  } finally {
    btn.innerHTML = original;
    btn.disabled = false;
  }
});

// Setup DB handler
document.getElementById('setupDbLink').addEventListener('click', async (e) => {
  e.preventDefault();
  const errorMsg = document.getElementById('errorMsg');
  
  errorMsg.style.color = '#c9a961';
  errorMsg.textContent = '⚙️ Initializing database, please wait...';
  
  try {
    const res = await fetch(`${API_BASE}/setup`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      errorMsg.style.color = '#4caf50';
      errorMsg.textContent = '🎉 Database setup successfully! Try logging in now.';
    } else {
      errorMsg.style.color = '#ef4444';
      errorMsg.textContent = '❌ Setup failed: ' + (data.error || 'Unknown error');
    }
  } catch (err) {
    errorMsg.style.color = '#ef4444';
    errorMsg.textContent = '❌ Network error. Failed to connect to setup endpoint.';
  }
});
