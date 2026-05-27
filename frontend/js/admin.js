const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? (window.location.port === '5000' ? '' : 'http://localhost:5000')
  : '';
const ADMIN_PASSWORD = 'ojo';

let editingId = null;
let allTools = [];
let allReviews = [];

// Chart objects for updates
let viewsChartInstance = null;
let ratingsChartInstance = null;

// Light / Dark Mode Toggle for Admin Portal
function initTheme() {
  const theme = localStorage.getItem('find_theme') || 'dark';
  if (theme === 'light') {
    document.body.classList.add('light-mode');
    document.body.classList.remove('dark-mode');
    updateThemeIcon('light');
  } else {
    document.body.classList.add('dark-mode');
    document.body.classList.remove('light-mode');
    updateThemeIcon('dark');
  }
}

function toggleTheme() {
  const isLight = document.body.classList.contains('light-mode');
  if (isLight) {
    document.body.classList.remove('light-mode');
    document.body.classList.add('dark-mode');
    localStorage.setItem('find_theme', 'dark');
    updateThemeIcon('dark');
  } else {
    document.body.classList.add('light-mode');
    document.body.classList.remove('dark-mode');
    localStorage.setItem('find_theme', 'light');
    updateThemeIcon('light');
  }
  // Re-render charts on theme change to match grid line colors
  if (document.getElementById('tab-charts').classList.contains('active')) {
    renderCharts();
  }
}

function updateThemeIcon(mode) {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  if (mode === 'light') {
    icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m0 13.5V21M4.95 4.95l1.59 1.59m10.91 10.91l1.59 1.59M3 12h2.25m13.5 0H21M4.95 19.05l1.59-1.59m10.91-10.91l1.59-1.59M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />`;
  } else {
    icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />`;
  }
}

// Check admin portal password
function checkPassword() {
  const input = document.getElementById('password-input');
  const error = document.getElementById('password-error');
  const overlay = document.getElementById('password-overlay');
  const dashboard = document.getElementById('dashboard');

  if (input.value === ADMIN_PASSWORD) {
    overlay.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadAnalytics();
  } else {
    error.textContent = 'Wrong password.';
    error.classList.remove('hidden');
    input.value = '';
    input.focus();
    input.classList.add('border-red-500');
    setTimeout(() => {
      input.classList.remove('border-red-500');
      error.classList.add('hidden');
    }, 2000);
  }
}

// Tab Switching logic
function switchAdminTab(tab) {
  const btnTools = document.getElementById('tab-tools');
  const btnReviews = document.getElementById('tab-reviews');
  const btnCharts = document.getElementById('tab-charts');

  const panelTools = document.getElementById('panel-tools');
  const panelReviews = document.getElementById('panel-reviews');
  const panelCharts = document.getElementById('panel-charts');

  // Deactivate all
  btnTools.classList.remove('active');
  btnReviews.classList.remove('active');
  btnCharts.classList.remove('active');

  panelTools.classList.add('hidden');
  panelReviews.classList.add('hidden');
  panelCharts.classList.add('hidden');

  // Activate chosen
  if (tab === 'tools') {
    btnTools.classList.add('active');
    panelTools.classList.remove('hidden');
  } else if (tab === 'reviews') {
    btnReviews.classList.add('active');
    panelReviews.classList.remove('hidden');
    loadAdminReviews();
  } else if (tab === 'charts') {
    btnCharts.classList.add('active');
    panelCharts.classList.remove('hidden');
    renderCharts();
  }
}

async function loadAnalytics() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/analytics`);
    if (!res.ok) throw new Error('Failed to load analytics');
    allTools = await res.json();
    renderTable(allTools);
    renderStats(allTools);

    // Refresh charts if we are on chart tab
    if (document.getElementById('tab-charts').classList.contains('active')) {
      renderCharts();
    }
  } catch (err) {
    console.error('Analytics error:', err);
    document.getElementById('table-body').innerHTML = `
      <tr><td colspan="4" class="text-center py-6 text-slate-500">
        Failed to load tools. Is the backend running?
      </td></tr>
    `;
  }
}

function renderStats(tools) {
  const totalViews = tools.reduce((sum, t) => sum + (t.views || 0), 0);
  const avgRating = tools.length > 0
    ? (tools.reduce((sum, t) => sum + (t.avgUserRating || 0), 0) / tools.length).toFixed(1)
    : '0.0';
  const topTool = tools.length > 0 ? tools[0].name : '—';

  document.getElementById('stat-total').textContent = tools.length;
  document.getElementById('stat-views').textContent = totalViews.toLocaleString();
  document.getElementById('stat-avg-rating').textContent = avgRating;
  document.getElementById('stat-top-tool').textContent = topTool;
}

function renderStarsSmall(rating) {
  const full = Math.floor(rating);
  let html = '';
  for (let i = 0; i < 5; i++) {
    html += `<span style="color:${i < full ? '#ea580c' : 'var(--border-color)'};font-size:12px">★</span>`;
  }
  return html;
}

function renderTable(tools) {
  const tbody = document.getElementById('table-body');

  if (!tools || tools.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="4" class="text-center py-6 text-slate-500">
        No tools added yet. Use the form above to add your first tool.
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = tools.map((tool, i) => `
    <tr>
      <td>
        <div class="flex items-center gap-2">
          <span class="text-slate-500 text-xs font-mono w-5">${i + 1}</span>
          <div>
            <span class="font-bold text-white text-sm">${tool.name}</span>
            <div class="flex gap-1 mt-1 flex-wrap">
              ${(tool.tags || []).slice(0, 2).map(t => `<span class="tag-pill">${t}</span>`).join('')}
              ${(tool.tags || []).length > 2 ? `<span class="tag-pill">+${tool.tags.length - 2}</span>` : ''}
            </div>
          </div>
        </div>
      </td>
      <td>
        <span class="font-bold text-white">${(tool.views || 0).toLocaleString()} views</span>
      </td>
      <td>
        <div class="flex flex-col gap-0.5">
          <div class="flex items-center gap-1">
            <span class="text-[10px] text-slate-500 font-semibold uppercase">Users:</span>
            <span class="text-xs font-bold text-white">${(tool.avgUserRating || 0).toFixed(1)}</span>
            ${renderStarsSmall(tool.avgUserRating || 0)}
            <span class="text-[10px] text-slate-500">(${tool.userRatingsCount || 0})</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-[10px] text-slate-500 font-semibold uppercase">Admin:</span>
            <span class="text-xs font-bold text-white">${(tool.rating || 0).toFixed(1)}</span>
            ${renderStarsSmall(tool.rating || 0)}
          </div>
        </div>
      </td>
      <td>
        <div class="flex items-center gap-2">
          <button onclick='editTool(${JSON.stringify(tool).replace(/'/g, "&#39;")})' class="text-xs font-medium text-slate-400 hover:text-white transition-colors px-2 py-1 rounded bg-black/20 border border-slate-800">
            Edit
          </button>
          <button onclick="deleteTool('${tool.id}')" class="text-xs font-medium text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded bg-red-950/10 border border-red-900/20">
            Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Fetch and load reviews for moderation
async function loadAdminReviews() {
  const container = document.getElementById('admin-reviews-list');
  container.innerHTML = '<div class="text-xs text-slate-500 italic py-2 text-center">Loading reviews...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/admin/reviews`);
    if (!res.ok) throw new Error();
    allReviews = await res.json();

    if (allReviews.length === 0) {
      container.innerHTML = '<div class="text-xs text-slate-500 py-6 text-center">No reviews have been left yet.</div>';
      return;
    }

    container.innerHTML = allReviews.map(review => `
      <div class="bg-black/10 border border-slate-800 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="space-y-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-bold text-white">${review.username}</span>
            <span class="text-[10px] text-slate-500">reviewed</span>
            <span class="text-xs font-bold text-orange-500">${review.toolName}</span>
            <span class="text-xs">${renderStarsSmall(review.rating)}</span>
          </div>
          <p class="text-xs text-slate-300 leading-normal font-normal">${review.comment}</p>
        </div>
        <button onclick="deleteReview('${review.toolId}', '${review.id}')" class="btn-orange bg-red-600 hover:bg-red-700 text-xs py-1 px-3 self-start sm:self-center">
          Delete
        </button>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<div class="text-xs text-red-400 py-2 text-center">Failed to load reviews list.</div>';
  }
}

async function deleteReview(toolId, reviewId) {
  if (!confirm('Delete this user review? This updates the tools rating score average.')) return;
  try {
    const res = await fetch(`${API_BASE}/api/tools/${toolId}/reviews/${reviewId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error();
    showToast('Review deleted successfully.');
    loadAdminReviews();
    loadAnalytics();
  } catch (e) {
    showToast('Error deleting review.', true);
  }
}

// Chart renders
function renderCharts() {
  if (allTools.length === 0) return;

  const isLight = document.body.classList.contains('light-mode');
  const textColor = isLight ? '#0f172a' : '#f8fafc';
  const gridColor = isLight ? '#e2e8f0' : '#21202e';

  // Prepare data
  const labels = allTools.map(t => t.name);
  const viewsData = allTools.map(t => t.views || 0);
  const ratingsData = allTools.map(t => t.avgUserRating || 0);

  // Views Chart
  const ctxViews = document.getElementById('viewsChart').getContext('2d');
  if (viewsChartInstance) viewsChartInstance.destroy();
  
  viewsChartInstance = new Chart(ctxViews, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Views / Click Count',
        data: viewsData,
        backgroundColor: '#ea580c',
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { family: 'Inter', size: 10 } }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Inter', size: 10 } }
        }
      }
    }
  });

  // Ratings Chart
  const ctxRatings = document.getElementById('ratingsChart').getContext('2d');
  if (ratingsChartInstance) ratingsChartInstance.destroy();

  ratingsChartInstance = new Chart(ctxRatings, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Average User Rating',
        data: ratingsData,
        backgroundColor: '#eab308',
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { family: 'Inter', size: 10 } }
        },
        y: {
          min: 0,
          max: 5,
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Inter', size: 10 } }
        }
      }
    }
  });
}

function editTool(tool) {
  editingId = tool.id;

  document.getElementById('field-name').value = tool.name || '';
  document.getElementById('field-intro').value = tool.intro || '';
  document.getElementById('field-rating').value = tool.rating || '';
  document.getElementById('field-bestfor').value = tool.bestFor || '';
  document.getElementById('field-weakness').value = tool.weakness || '';
  document.getElementById('field-verdict').value = tool.verdict || '';
  document.getElementById('field-link').value = tool.link || '';
  document.getElementById('field-tags').value = (tool.tags || []).join(', ');

  document.getElementById('form-title').textContent = 'Edit Tool Details';
  document.getElementById('submit-btn').textContent = 'Update Tool';
  document.getElementById('cancel-btn').classList.remove('hidden');

  document.getElementById('tool-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEdit() {
  editingId = null;
  document.getElementById('tool-form').reset();
  document.getElementById('form-title').textContent = 'Add New Tool';
  document.getElementById('submit-btn').textContent = 'Add Tool';
  document.getElementById('cancel-btn').classList.add('hidden');
}

async function handleSubmit(e) {
  e.preventDefault();

  const btn = document.getElementById('submit-btn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const payload = {
    name: document.getElementById('field-name').value,
    intro: document.getElementById('field-intro').value,
    rating: parseFloat(document.getElementById('field-rating').value) || 0,
    bestFor: document.getElementById('field-bestfor').value,
    weakness: document.getElementById('field-weakness').value,
    verdict: document.getElementById('field-verdict').value,
    link: document.getElementById('field-link').value,
    tags: document.getElementById('field-tags').value
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean)
  };

  try {
    let res;
    if (editingId) {
      res = await fetch(`${API_BASE}/api/tools/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch(`${API_BASE}/api/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (!res.ok) throw new Error('Save failed');

    cancelEdit();
    await loadAnalytics();
    showToast(editingId ? 'Tool updated!' : 'Tool added!');
  } catch (err) {
    console.error('Submit error:', err);
    showToast('Error saving tool.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function deleteTool(id) {
  if (!confirm('Delete this tool? This cannot be undone.')) return;

  try {
    const res = await fetch(`${API_BASE}/api/tools/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    await loadAnalytics();
    showToast('Tool deleted.');
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Error deleting tool.', true);
  }
}

function showToast(message, isError = false) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = `fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg text-xs font-semibold shadow-lg ${isError
    ? 'bg-red-600 text-white'
    : 'bg-orange-500 text-white'
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  
  const passwordInput = document.getElementById('password-input');
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkPassword();
  });
  passwordInput.focus();

  document.getElementById('tool-form').addEventListener('submit', handleSubmit);
});
