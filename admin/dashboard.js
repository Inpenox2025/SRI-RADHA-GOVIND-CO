// ═══════════════════════════════════════
// ADMIN DASHBOARD — dashboard.js
// ═══════════════════════════════════════

const API_BASE = '/api';
let currentPage = 1;
let currentSearch = '';
let currentStatus = '';
let currentDistrict = '';
let allDropdowns = {};
let viewingLeadId = null;
let searchTimeout = null;

// ─────── Auth Check ───────
function getToken() {
  return localStorage.getItem('srg_token');
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('srg_user')); } catch { return null; }
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  };
}

function logout() {
  localStorage.removeItem('srg_token');
  localStorage.removeItem('srg_user');
  window.location.href = 'index.html';
}

// ─────── Init ───────
document.addEventListener('DOMContentLoaded', async () => {
  const token = getToken();
  if (!token) { window.location.href = 'index.html'; return; }

  // Verify token
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) { logout(); return; }
  } catch { logout(); return; }

  // Set user info
  const user = getUser();
  if (user) {
    document.getElementById('userName').textContent = user.username;
    document.getElementById('userRole').textContent = user.role;
    document.querySelector('.user-avatar').textContent = (user.username || 'A').charAt(0).toUpperCase();
  }

  await loadDropdowns();
  await loadLeads();
  await loadStats();
  initEventListeners();
});

// ─────── Load Dropdowns ───────
async function loadDropdowns() {
  try {
    const res = await fetch(`${API_BASE}/dropdowns`);
    const data = await res.json();
    if (data.success) {
      allDropdowns = data.grouped || {};
      populateDropdowns();
    }
  } catch (err) {
    console.warn('Failed to load dropdowns:', err);
  }
}

function populateDropdowns() {
  // Filter district dropdown
  const filterDistrict = document.getElementById('filterDistrict');
  filterDistrict.innerHTML = '<option value="">All Districts</option>';
  (allDropdowns.district || []).forEach(d => {
    filterDistrict.innerHTML += `<option value="${esc(d.label)}">${esc(d.label)}</option>`;
  });

  // Modal dropdowns
  populateModalSelect('lead_district', allDropdowns.district || []);
  populateModalSelect('lead_employee_category', allDropdowns.employee_category || []);
  populateModalSelect('lead_evc_status', allDropdowns.evc_status || []);
  populateModalSelect('lead_client_since', allDropdowns.client_since || []);
  populateModalSelect('lead_mode_of_payment', allDropdowns.mode_of_payment || []);
}

function populateModalSelect(id, items) {
  const select = document.getElementById(id);
  if (!select) return;
  const firstOption = select.querySelector('option');
  select.innerHTML = '';
  if (firstOption) select.appendChild(firstOption);
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.label;
    opt.textContent = item.label;
    select.appendChild(opt);
  });
}

// ─────── Load Stats ───────
async function loadStats() {
  try {
    // Fetch counts for each status
    const total = await fetchCount('');
    const enquired = await fetchCount('enquired');
    const started = await fetchCount('started');
    const progress = await fetchCount('in_progress');
    const completed = await fetchCount('completed');

    animateNumber('statTotal', total);
    animateNumber('statEnquired', enquired);
    animateNumber('statStarted', started);
    animateNumber('statProgress', progress);
    animateNumber('statCompleted', completed);
  } catch (err) {
    console.warn('Stats load error:', err);
  }
}

async function fetchCount(status) {
  const url = status
    ? `${API_BASE}/leads?page=1&limit=1&status=${status}`
    : `${API_BASE}/leads?page=1&limit=1`;
  const res = await fetch(url, { headers: authHeaders() });
  const data = await res.json();
  return data.pagination?.total || 0;
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step = Math.ceil(target / 30);
  const timer = setInterval(() => {
    current += step;
    if (current >= target) { current = target; clearInterval(timer); }
    el.textContent = current;
  }, 30);
}

// ─────── Load Leads ───────
async function loadLeads() {
  const tbody = document.getElementById('leadsBody');
  tbody.innerHTML = '<tr><td colspan="11" class="loading-cell"><span class="spinner"></span> Loading...</td></tr>';

  try {
    let url = `${API_BASE}/leads?page=${currentPage}&limit=15`;
    if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;
    if (currentStatus) url += `&status=${encodeURIComponent(currentStatus)}`;
    if (currentDistrict) url += `&district=${encodeURIComponent(currentDistrict)}`;

    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();

    if (!data.success) {
      tbody.innerHTML = `<tr><td colspan="11" class="loading-cell">Error: ${data.error}</td></tr>`;
      return;
    }

    const leads = data.leads || [];
    const pag = data.pagination || {};

    if (leads.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="11">
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <h3>No Leads Found</h3>
            <p>Add your first lead or adjust your filters.</p>
          </div>
        </td></tr>`;
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    tbody.innerHTML = leads.map((l, i) => {
      const sno = ((pag.page - 1) * pag.limit) + i + 1;
      const statusClass = (l.status || 'enquired').replace(/\s/g, '_');
      const due = parseFloat(l.due) || 0;
      const dueClass = due > 0 ? 'due-positive' : 'due-zero';

      return `
        <tr>
          <td>${sno}</td>
          <td><strong>${esc(l.full_name)}</strong></td>
          <td>${l.mobile_no ? `<a href="tel:${l.mobile_no}" class="phone-link">${esc(l.mobile_no)}</a>` : '—'}</td>
          <td>${esc(l.district) || '—'}</td>
          <td>${esc(l.pan_card_no) || '—'}</td>
          <td>${esc(l.employee_category) || '—'}</td>
          <td>
            <select class="status-select status-badge ${statusClass}" data-id="${l.id}" onchange="updateStatus(this)">
              <option value="enquired" ${l.status === 'enquired' ? 'selected' : ''}>Enquired</option>
              <option value="started" ${l.status === 'started' ? 'selected' : ''}>Started</option>
              <option value="in_progress" ${l.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
              <option value="completed" ${l.status === 'completed' ? 'selected' : ''}>Completed</option>
            </select>
          </td>
          <td class="currency">${formatCurrency(l.total_fee)}</td>
          <td class="currency">${formatCurrency(l.paid)}</td>
          <td class="currency ${dueClass}">${formatCurrency(l.due)}</td>
          <td>
            <div class="action-btns">
              <button class="action-btn" onclick="viewLead(${l.id})" title="View">👁</button>
              <button class="action-btn" onclick="editLead(${l.id})" title="Edit">✏️</button>
              <button class="action-btn danger" onclick="deleteLead(${l.id}, '${esc(l.full_name)}')" title="Delete">🗑</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    renderPagination(pag);
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="11" class="loading-cell">Network error. Please refresh.</td></tr>`;
    console.error('Load leads error:', error);
  }
}

// ─────── Inline Status Update ───────
async function updateStatus(select) {
  const id = select.dataset.id;
  const newStatus = select.value;

  try {
    // Get current lead data first
    const getRes = await fetch(`${API_BASE}/leads/${id}`, { headers: authHeaders() });
    const getData = await getRes.json();
    if (!getData.success) { showToast('Failed to update status', 'error'); return; }

    const lead = getData.lead;
    lead.status = newStatus;

    const res = await fetch(`${API_BASE}/leads/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(lead)
    });

    const data = await res.json();
    if (data.success) {
      showToast('Status updated', 'success');
      // Update class
      select.className = `status-select status-badge ${newStatus}`;
      loadStats();
    } else {
      showToast(data.error || 'Update failed', 'error');
    }
  } catch {
    showToast('Network error', 'error');
  }
}

// ─────── Pagination ───────
function renderPagination(pag) {
  const container = document.getElementById('pagination');
  if (pag.totalPages <= 1) { container.innerHTML = ''; return; }

  let html = '';
  html += `<button class="page-btn" onclick="goToPage(${pag.page - 1})" ${pag.page <= 1 ? 'disabled' : ''}>‹ Prev</button>`;

  const start = Math.max(1, pag.page - 2);
  const end = Math.min(pag.totalPages, pag.page + 2);

  if (start > 1) {
    html += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
    if (start > 2) html += `<span class="page-info">...</span>`;
  }

  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn ${i === pag.page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }

  if (end < pag.totalPages) {
    if (end < pag.totalPages - 1) html += `<span class="page-info">...</span>`;
    html += `<button class="page-btn" onclick="goToPage(${pag.totalPages})">${pag.totalPages}</button>`;
  }

  html += `<button class="page-btn" onclick="goToPage(${pag.page + 1})" ${pag.page >= pag.totalPages ? 'disabled' : ''}>Next ›</button>`;
  html += `<span class="page-info">Page ${pag.page} of ${pag.totalPages} (${pag.total} records)</span>`;

  container.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  loadLeads();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─────── View Lead ───────
async function viewLead(id) {
  viewingLeadId = id;
  try {
    const res = await fetch(`${API_BASE}/leads/${id}`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success) { showToast('Failed to load lead', 'error'); return; }

    const l = data.lead;
    const body = document.getElementById('viewModalBody');

    body.innerHTML = `
      <div class="detail-section">
        <div class="detail-row">
          <span class="label">Status</span>
          <span class="value"><span class="status-badge ${l.status}">${(l.status || 'enquired').replace('_', ' ')}</span></span>
        </div>
      </div>
      <div class="detail-section">
        <h4>Client Identity & Demographics</h4>
        ${detailRow('S.No', l.id)}
        ${detailRow('Full Name', l.full_name)}
        ${detailRow('District', l.district)}
        ${detailRow('Employee Category', l.employee_category)}
        ${detailRow('Date of Birth', formatDate(l.date_of_birth))}
        ${detailRow('Mobile No', l.mobile_no ? `<a href="tel:${l.mobile_no}" class="phone-link">${l.mobile_no}</a>` : '—')}
        ${detailRow('Alt Mobile No', l.alt_mobile_no)}
        ${detailRow('Bank Account No', l.bank_account_no)}
        ${detailRow('IFSC Code', l.ifsc_code)}
      </div>
      <div class="detail-section">
        <h4>Tax & Portal Credentials</h4>
        ${detailRow('PAN Card No', l.pan_card_no)}
        ${detailRow('IT Portal Password', l.portal_password ? '••••••••' : '—')}
        ${detailRow('EVC / Aadhaar Status', l.evc_status)}
        ${detailRow('Date of Filing', formatDate(l.date_of_filing))}
        ${detailRow('Client Since', l.client_since)}
        ${detailRow('Rank / Designation', l.rank_designation)}
      </div>
      <div class="detail-section">
        <h4>Financial Data</h4>
        ${detailRow('Gross Salary', formatCurrency(l.gross_salary))}
        ${detailRow('Deduction 1', formatCurrency(l.deduction_1))}
        ${detailRow('Deduction 2', formatCurrency(l.deduction_2))}
        ${detailRow('Refund', formatCurrency(l.refund))}
      </div>
      <div class="detail-section">
        <h4>Billing & Fees</h4>
        ${detailRow('Total Fee', formatCurrency(l.total_fee))}
        ${detailRow('Paid', formatCurrency(l.paid))}
        ${detailRow('Due', formatCurrency(l.due))}
        ${detailRow('Date of Payment', formatDate(l.date_of_payment))}
        ${detailRow('Mode of Payment', l.mode_of_payment)}
      </div>
      <div class="detail-section">
        <h4>Additional Notes</h4>
        ${detailRow('Remarks (1)', l.remarks_1)}
        ${detailRow('Remarks (2)', l.remarks_2)}
      </div>
    `;

    document.getElementById('viewModal').classList.add('open');
  } catch {
    showToast('Network error', 'error');
  }
}

function detailRow(label, value) {
  return `<div class="detail-row"><span class="label">${label}</span><span class="value">${value || '—'}</span></div>`;
}

// ─────── Add Lead Modal ───────
function openAddModal() {
  document.getElementById('modalTitle').textContent = 'Add New Lead';
  document.getElementById('leadForm').reset();
  document.getElementById('lead_id').value = '';
  document.getElementById('lead_due').value = '';
  document.getElementById('leadModal').classList.add('open');
}

// ─────── Edit Lead ───────
async function editLead(id) {
  try {
    const res = await fetch(`${API_BASE}/leads/${id}`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success) { showToast('Failed to load lead', 'error'); return; }

    const l = data.lead;
    document.getElementById('modalTitle').textContent = 'Edit Lead';
    document.getElementById('lead_id').value = l.id;

    // Fill form fields
    const fields = [
      'status', 'full_name', 'district', 'employee_category', 'mobile_no',
      'alt_mobile_no', 'bank_account_no', 'ifsc_code', 'pan_card_no',
      'portal_password', 'evc_status', 'client_since', 'rank_designation',
      'gross_salary', 'deduction_1', 'deduction_2', 'refund',
      'total_fee', 'paid', 'mode_of_payment', 'remarks_1', 'remarks_2'
    ];

    fields.forEach(f => {
      const el = document.getElementById(`lead_${f}`);
      if (el) el.value = l[f] || '';
    });

    // Date fields
    ['date_of_birth', 'date_of_filing', 'date_of_payment'].forEach(f => {
      const el = document.getElementById(`lead_${f}`);
      if (el && l[f]) el.value = new Date(l[f]).toISOString().split('T')[0];
    });

    // Calculate due
    calcDue();

    document.getElementById('leadModal').classList.add('open');
  } catch {
    showToast('Network error', 'error');
  }
}

// ─────── Delete Lead ───────
async function deleteLead(id, name) {
  if (!confirm(`Delete lead "${name}"? This cannot be undone.`)) return;

  try {
    const res = await fetch(`${API_BASE}/leads/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast('Lead deleted', 'success');
      loadLeads();
      loadStats();
    } else {
      showToast(data.error || 'Delete failed', 'error');
    }
  } catch {
    showToast('Network error', 'error');
  }
}

// ─────── Save Lead (Add/Edit) ───────
async function saveLead(e) {
  e.preventDefault();
  const btn = document.getElementById('saveLeadBtn');
  btn.innerHTML = '<span class="spinner"></span> Saving...';
  btn.disabled = true;

  const form = document.getElementById('leadForm');
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  const id = data.id;
  delete data.id;

  // Calc due
  data.due = (parseFloat(data.total_fee) || 0) - (parseFloat(data.paid) || 0);

  try {
    const url = id ? `${API_BASE}/leads/${id}` : `${API_BASE}/leads`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (result.success) {
      showToast(id ? 'Lead updated' : 'Lead created', 'success');
      closeModal('leadModal');
      loadLeads();
      loadStats();
    } else {
      showToast(result.error || 'Save failed', 'error');
    }
  } catch {
    showToast('Network error', 'error');
  } finally {
    btn.innerHTML = 'Save Lead';
    btn.disabled = false;
  }
}

// ─────── Due Calculation ───────
function calcDue() {
  const fee = parseFloat(document.getElementById('lead_total_fee').value) || 0;
  const paid = parseFloat(document.getElementById('lead_paid').value) || 0;
  document.getElementById('lead_due').value = (fee - paid).toFixed(2);
}

// ─────── Excel Export ───────
async function exportExcel() {
  const btn = document.getElementById('exportBtn');
  btn.innerHTML = '<span class="spinner"></span> Exporting...';
  btn.disabled = true;

  try {
    let url = `${API_BASE}/leads/export-excel`;
    if (currentStatus) url += `?status=${currentStatus}`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (!res.ok) throw new Error('Export failed');

    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Leads_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Excel exported successfully', 'success');
  } catch {
    showToast('Export failed', 'error');
  } finally {
    btn.innerHTML = '📤 Export Excel';
    btn.disabled = false;
  }
}

// ─────── Excel Import ───────
async function importExcel(file) {
  const btn = document.getElementById('importBtn');
  btn.innerHTML = '<span class="spinner"></span> Importing...';
  btn.disabled = true;

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/leads/import-excel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData
    });

    const data = await res.json();
    if (data.success) {
      showToast(`Imported ${data.imported} of ${data.total} leads`, 'success');
      loadLeads();
      loadStats();
    } else {
      showToast(data.error || 'Import failed', 'error');
    }
  } catch {
    showToast('Import failed', 'error');
  } finally {
    btn.innerHTML = '📥 Import Excel';
    btn.disabled = false;
    document.getElementById('importFile').value = '';
  }
}

// ─────── PDF Export ───────
async function exportPdf(id) {
  try {
    const res = await fetch(`${API_BASE}/leads/export-pdf?id=${id}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (!res.ok) throw new Error('PDF export failed');

    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Lead_${id}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('PDF exported', 'success');
  } catch {
    showToast('PDF export failed', 'error');
  }
}

// ─────── DB Setup ───────
async function setupDB() {
  if (!confirm('Run database setup? This will create tables and seed default data.')) return;

  const btn = document.getElementById('setupBtn');
  btn.innerHTML = '<span class="spinner"></span> Setting up...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/setup`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Database setup complete!', 'success');
      loadDropdowns();
      loadLeads();
      loadStats();
    } else {
      showToast(data.error || 'Setup failed', 'error');
    }
  } catch {
    showToast('Setup failed — check database connection', 'error');
  } finally {
    btn.innerHTML = '⚙️ Setup DB';
    btn.disabled = false;
  }
}

// ─────── Modal Helpers ───────
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ─────── Event Listeners ───────
function initEventListeners() {
  // Add lead
  document.getElementById('addLeadBtn').addEventListener('click', openAddModal);

  // Save lead form
  document.getElementById('leadForm').addEventListener('submit', saveLead);

  // Close modals
  document.getElementById('modalClose').addEventListener('click', () => closeModal('leadModal'));
  document.getElementById('modalCancel').addEventListener('click', () => closeModal('leadModal'));
  document.getElementById('viewModalClose').addEventListener('click', () => closeModal('viewModal'));

  // Close on overlay click
  document.getElementById('leadModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('leadModal');
  });
  document.getElementById('viewModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('viewModal');
  });

  // Due calculation
  document.getElementById('lead_total_fee').addEventListener('input', calcDue);
  document.getElementById('lead_paid').addEventListener('input', calcDue);

  // Search (debounced)
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value.trim();
      currentPage = 1;
      loadLeads();
    }, 400);
  });

  // Filters
  document.getElementById('filterStatus').addEventListener('change', (e) => {
    currentStatus = e.target.value;
    currentPage = 1;
    loadLeads();
  });

  document.getElementById('filterDistrict').addEventListener('change', (e) => {
    currentDistrict = e.target.value;
    currentPage = 1;
    loadLeads();
  });

  // Export
  document.getElementById('exportBtn').addEventListener('click', exportExcel);

  // Import
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', (e) => {
    if (e.target.files.length > 0) importExcel(e.target.files[0]);
  });

  // View modal actions
  document.getElementById('viewPdfBtn').addEventListener('click', () => {
    if (viewingLeadId) exportPdf(viewingLeadId);
  });
  document.getElementById('viewEditBtn').addEventListener('click', () => {
    closeModal('viewModal');
    if (viewingLeadId) editLead(viewingLeadId);
  });

  // Setup DB
  document.getElementById('setupBtn').addEventListener('click', setupDB);

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });

  // Sidebar toggle (mobile)
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('sidebarClose').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal('leadModal');
      closeModal('viewModal');
    }
  });
}

// ─────── Utilities ───────
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 4000);
}

function formatCurrency(v) {
  if (!v && v !== 0) return '—';
  return '₹' + parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
