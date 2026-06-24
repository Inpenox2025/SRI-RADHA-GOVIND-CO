// ═══════════════════════════════════════
// LANDING PAGE — index.js
// ═══════════════════════════════════════

const API_BASE = '/api';

// ─────── DOM Ready ───────
document.addEventListener('DOMContentLoaded', () => {
  loadDropdowns();
  loadTestimonials();
  initNavbar();
  initScrollAnimations();
  initForm();
});

// ─────── Load Dropdowns from API ───────
async function loadDropdowns() {
  try {
    const res = await fetch(`${API_BASE}/dropdowns`);
    const data = await res.json();

    if (data.success && data.grouped) {
      populateSelect('eq_district', data.grouped.district || []);
      populateSelect('eq_category', data.grouped.employee_category || []);
    }
  } catch (err) {
    console.warn('Could not load dropdowns:', err);
    // Fallback defaults
    const districts = ['Visakhapatnam', 'East Godavari', 'West Godavari', 'Krishna', 'Guntur', 'Prakasam', 'Nellore'];
    const categories = ['Police TDS', 'Police Non TDS', 'Excise and SEB', 'Other Professionals'];
    populateSelectFromArray('eq_district', districts);
    populateSelectFromArray('eq_category', categories);
  }
}

function populateSelect(id, items) {
  const select = document.getElementById(id);
  if (!select) return;
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.label;
    opt.textContent = item.label;
    select.appendChild(opt);
  });
}

function populateSelectFromArray(id, items) {
  const select = document.getElementById(id);
  if (!select) return;
  items.forEach(label => {
    const opt = document.createElement('option');
    opt.value = label;
    opt.textContent = label;
    select.appendChild(opt);
  });
}

// ─────── Load Testimonials ───────
async function loadTestimonials() {
  const grid = document.getElementById('testimonialsGrid');
  if (!grid) return;

  let testimonials = [];
  try {
    const res = await fetch(`${API_BASE}/testimonials`);
    const data = await res.json();
    if (data.success) testimonials = data.testimonials;
  } catch {
    // Fallback
    testimonials = [
      { client_name: 'Rajesh Kumar', message: 'Excellent service! Sri Radha Govind & CO made my tax filing process so smooth and hassle-free. Highly recommended!', rating: 5 },
      { client_name: 'Priya Sharma', message: 'Very professional team. They handled all my tax requirements with great care and precision. Will definitely come back.', rating: 5 },
      { client_name: 'Venkat Rao', message: 'Outstanding support throughout the entire process. Their attention to detail is remarkable. Best tax consultants in the region.', rating: 5 }
    ];
  }

  grid.innerHTML = testimonials.map(t => `
    <div class="testimonial-card fade-in">
      <div class="quote-icon">"</div>
      <div class="message">${escapeHtml(t.message)}</div>
      <div class="stars">${'★'.repeat(t.rating || 5)}${'☆'.repeat(5 - (t.rating || 5))}</div>
      <div class="testimonial-author">
        <div class="avatar">${(t.client_name || 'U').charAt(0).toUpperCase()}</div>
        <div>
          <div class="name">${escapeHtml(t.client_name)}</div>
          <div class="role">Verified Client</div>
        </div>
      </div>
    </div>
  `).join('');

  // Re-init scroll animations for new content
  initScrollAnimations();
}

// ─────── Enquiry Form ───────
function initForm() {
  const form = document.getElementById('enquiryForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const original = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Submitting...';
    btn.disabled = true;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    data.status = 'enquired';

    try {
      const res = await fetch(`${API_BASE}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await res.json();

      if (result.success) {
        document.getElementById('enquiryFormContent').style.display = 'none';
        document.getElementById('formSuccess').classList.add('show');
        showToast('Enquiry submitted successfully!', 'success');
      } else {
        showToast(result.error || 'Failed to submit', 'error');
      }
    } catch (err) {
      showToast('Network error. Please try again.', 'error');
    } finally {
      btn.innerHTML = original;
      btn.disabled = false;
    }
  });
}

function resetForm() {
  document.getElementById('enquiryForm').reset();
  document.getElementById('enquiryFormContent').style.display = 'block';
  document.getElementById('formSuccess').classList.remove('show');
}

// ─────── Navbar ───────
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');

  // Scroll effect
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });

  // Mobile toggle
  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
  });

  // Close on link click (mobile)
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => links.classList.remove('open'));
  });
}

// ─────── Scroll Animations ───────
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.fade-in:not(.visible)').forEach(el => observer.observe(el));
}

// ─────── Toast ───────
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 4000);
}

// ─────── Utility ───────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
