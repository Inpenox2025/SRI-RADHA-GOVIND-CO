// ═══════════════════════════════════════
// USER MANAGEMENT — users.js
// ═══════════════════════════════════════

const API_BASE = '/api';

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

    // Only admin can manage users
    if (user.role !== 'admin') {
      document.getElementById('addUserForm').classList.add('disabled');
    }
  }

  await loadUsers();
  initEventListeners();
});

async function loadUsers() {
  const list = document.getElementById('usersList');
  list.innerHTML = '<div class="loading-cell"><span class="spinner"></span> Loading...</div>';

  try {
    const res = await fetch(`${API_BASE}/users`, { headers: authHeaders() });
    const data = await res.json();

    if (!data.success) {
      list.innerHTML = `<div class="dd-empty">Error: ${data.error}</div>`;
      return;
    }

    const users = data.users || [];
    const subAdminCount = users.filter(u => u.role === 'sub_admin').length;

    // Update limit counter
    document.getElementById('limitCount').textContent = `${subAdminCount}/2`;

    // Disable add form if limit reached or not admin
    const currentUser = getUser();
    if (subAdminCount >= 2 || (currentUser && currentUser.role !== 'admin')) {
      document.getElementById('addUserForm').classList.add('disabled');
    } else {
      document.getElementById('addUserForm').classList.remove('disabled');
    }

    if (users.length === 0) {
      list.innerHTML = '<div class="dd-empty"><div class="empty-icon">👤</div><p>No users found.</p></div>';
      return;
    }

    list.innerHTML = users.map(u => `
      <div class="user-card" data-id="${u.id}">
        <div class="uc-avatar ${u.role}">${(u.username || 'U').charAt(0).toUpperCase()}</div>
        <div class="uc-info">
          <div class="uc-name">${escapeHtml(u.username)}</div>
          <div class="uc-role">
            <span class="role-badge ${u.role}">${u.role === 'admin' ? '👑 Admin' : '🛡️ Sub Admin'}</span>
          </div>
        </div>
        <div class="uc-date">Created: ${u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}</div>
        <div class="uc-actions">
          <button class="action-btn" onclick="editUser(${u.id}, '${escapeAttr(u.username)}')" title="Edit">✏️</button>
          ${u.role !== 'admin' ? `
            <button class="action-btn danger" onclick="deleteUser(${u.id}, '${escapeAttr(u.username)}')" title="Delete">🗑</button>
          ` : '<span style="font-size:0.8rem;color:var(--text3);margin-left:8px">Protected (Delete)</span>'}
        </div>
      </div>
    `).join('');
  } catch (error) {
    list.innerHTML = '<div class="dd-empty">Network error. Please refresh.</div>';
  }
}

// ─────── Add User ───────
async function addUser() {
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value;

  if (!username || !password) {
    showToast('Username and password are required', 'error');
    return;
  }

  if (password.length < 4) {
    showToast('Password must be at least 4 characters', 'error');
    return;
  }

  const btn = document.getElementById('addUserBtn');
  btn.innerHTML = '<span class="spinner"></span> Creating...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success) {
      showToast('Sub-admin created successfully', 'success');
      document.getElementById('newUsername').value = '';
      document.getElementById('newPassword').value = '';
      await loadUsers();
    } else {
      showToast(data.error || 'Failed to create user', 'error');
    }
  } catch {
    showToast('Network error', 'error');
  } finally {
    btn.innerHTML = '+ Create User';
    btn.disabled = false;
  }
}

// ─────── Edit User ───────
function editUser(id, currentUsername) {
  const newUsername = prompt('New username:', currentUsername);
  if (!newUsername || newUsername.trim() === '') return;

  const newPassword = prompt('New password (leave blank to keep current):');

  updateUser(id, newUsername.trim(), newPassword);
}

async function updateUser(id, username, password) {
  try {
    const body = { username };
    if (password && password.trim() !== '') body.password = password;

    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (data.success) {
      showToast('User updated', 'success');
      await loadUsers();
    } else {
      showToast(data.error || 'Update failed', 'error');
    }
  } catch {
    showToast('Network error', 'error');
  }
}

// ─────── Delete User ───────
async function deleteUser(id, username) {
  if (!confirm(`Delete sub-admin "${username}"? This cannot be undone.`)) return;

  try {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const data = await res.json();

    if (data.success) {
      showToast('User deleted', 'success');
      await loadUsers();
    } else {
      showToast(data.error || 'Delete failed', 'error');
    }
  } catch {
    showToast('Network error', 'error');
  }
}

// ─────── Event Listeners ───────
function initEventListeners() {
  document.getElementById('addUserBtn').addEventListener('click', addUser);

  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('srg_token');
    localStorage.removeItem('srg_user');
    window.location.href = '/admin/';
  });

  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('sidebarClose').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });

  // Enter key on inputs
  document.getElementById('newPassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addUser();
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
