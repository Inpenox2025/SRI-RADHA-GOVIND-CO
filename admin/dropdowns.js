// ═══════════════════════════════════════
// DROPDOWN MANAGEMENT — dropdowns.js
// ═══════════════════════════════════════

const API_BASE = '/api';
let currentCategory = 'district';
let allDropdownData = [];

function getToken() { return localStorage.getItem('srg_token'); }
function getUser() { try { return JSON.parse(localStorage.getItem('srg_user')); } catch { return null; } }
function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) { window.location.href = '/admin/'; return; }

  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
    if (!res.ok) { window.location.href = '/admin/'; return; }
  } catch { window.location.href = '/admin/'; return; }

  const user = getUser();
  if (user) {
    document.getElementById('userName').textContent = user.username;
    document.getElementById('userRole').textContent = user.role;
    document.querySelector('.user-avatar').textContent = (user.username || 'A').charAt(0).toUpperCase();
  }

  await loadDropdowns();
  initEventListeners();
});

async function loadDropdowns() {
  const list = document.getElementById('dropdownList');
  list.innerHTML = '<div class="loading-cell"><span class="spinner"></span> Loading...</div>';

  try {
    const res = await fetch(`${API_BASE}/dropdowns`);
    const data = await res.json();
    if (data.success) {
      allDropdownData = data.dropdowns || [];
      renderDropdowns();
    }
  } catch {
    list.innerHTML = '<div class="dd-empty">Failed to load dropdowns</div>';
  }
}

function renderDropdowns() {
  const list = document.getElementById('dropdownList');
  const items = allDropdownData.filter(d => d.category === currentCategory);

  if (items.length === 0) {
    list.innerHTML = `
      <div class="dd-empty">
        <div class="empty-icon">📭</div>
        <p>No options for this category yet. Add one above.</p>
      </div>`;
    return;
  }

  list.innerHTML = items.map(item => `
    <div class="dd-item" data-id="${item.id}">
      <div class="dd-order">#${item.sort_order || 0}</div>
      <div class="dd-label">${escapeHtml(item.label)}</div>
      <div class="dd-actions">
        <button class="action-btn" onclick="startEdit(${item.id}, '${escapeAttr(item.label)}', ${item.sort_order || 0})" title="Edit">✏️</button>
        <button class="action-btn danger" onclick="deleteDropdown(${item.id}, '${escapeAttr(item.label)}')" title="Delete">🗑</button>
      </div>
    </div>
  `).join('');
}

// ─────── Add Dropdown ───────
async function addDropdown() {
  const label = document.getElementById('newLabel').value.trim();
  const sort = parseInt(document.getElementById('newSort').value) || 0;

  if (!label) { showToast('Please enter a label', 'error'); return; }

  try {
    const res = await fetch(`${API_BASE}/dropdowns`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ category: currentCategory, label, sort_order: sort })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Dropdown option added', 'success');
      document.getElementById('newLabel').value = '';
      document.getElementById('newSort').value = '0';
      await loadDropdowns();
    } else {
      showToast(data.error || 'Failed to add', 'error');
    }
  } catch {
    showToast('Network error', 'error');
  }
}

// ─────── Edit Dropdown ───────
function startEdit(id, label, sortOrder) {
  const item = document.querySelector(`[data-id="${id}"]`);
  if (!item) return;

  item.innerHTML = `
    <input type="text" class="edit-input" id="edit_label_${id}" value="${escapeAttr(label)}">
    <input type="number" class="edit-input sort-edit" id="edit_sort_${id}" value="${sortOrder}">
    <div class="dd-actions">
      <button class="action-btn" onclick="saveEdit(${id})" title="Save" style="color:#22c55e">✓</button>
      <button class="action-btn" onclick="renderDropdowns()" title="Cancel" style="color:#ef4444">✕</button>
    </div>
  `;

  document.getElementById(`edit_label_${id}`).focus();
}

async function saveEdit(id) {
  const label = document.getElementById(`edit_label_${id}`).value.trim();
  const sort = parseInt(document.getElementById(`edit_sort_${id}`).value) || 0;

  if (!label) { showToast('Label cannot be empty', 'error'); return; }

  try {
    const res = await fetch(`${API_BASE}/dropdowns/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ label, sort_order: sort })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Updated', 'success');
      await loadDropdowns();
    } else {
      showToast(data.error || 'Update failed', 'error');
    }
  } catch {
    showToast('Network error', 'error');
  }
}

// ─────── Delete Dropdown ───────
async function deleteDropdown(id, label) {
  if (!confirm(`Delete "${label}"?`)) return;

  try {
    const res = await fetch(`${API_BASE}/dropdowns/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast('Deleted', 'success');
      await loadDropdowns();
    } else {
      showToast(data.error || 'Delete failed', 'error');
    }
  } catch {
    showToast('Network error', 'error');
  }
}

// ─────── Event Listeners ───────
function initEventListeners() {
  // Category tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.dataset.category;
      renderDropdowns();
    });
  });

  // Add button
  document.getElementById('addDropdownBtn').addEventListener('click', addDropdown);

  // Enter key on input
  document.getElementById('newLabel').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addDropdown();
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('srg_token');
    localStorage.removeItem('srg_user');
    window.location.href = '/admin/';
  });

  // Sidebar toggle
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('sidebarClose').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

// ─────── Utils ───────
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  if (!text) return '';
  return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
