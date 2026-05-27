const API_BASE = window.location.port === '5500' || window.location.port === '5501' || window.location.port === '3000'
  ? 'http://localhost:5000' 
  : '';
const ADMIN_PASSWORD = 'ojo';

let editingId = null;
let allTools = [];

function checkPassword() {
  const input = document.getElementById('password-input');
  const error = document.getElementById('password-error');
  const overlay = document.getElementById('password-overlay');
  const dashboard = document.getElementById('dashboard');

  if (input.value === ADMIN_PASSWORD) {
    overlay.classList.add('hidden');
    dashboard.classList.remove('hidden');
    dashboard.classList.add('animate-fade-in');
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

async function loadAnalytics() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/analytics`);
    if (!res.ok) throw new Error('Failed to load analytics');
    allTools = await res.json();
    renderTable(allTools);
    renderStats(allTools);
  } catch (err) {
    console.error('Analytics error:', err);
    document.getElementById('table-body').innerHTML = `
      <tr><td colspan="5" class="text-center py-8 text-purple-400">
        Failed to load data. Is the backend running?
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
    html += `<span style="color:${i < full ? '#FBBF24' : 'rgba(196,181,253,0.25)'};font-size:12px">★</span>`;
  }
  return html;
}

function renderTable(tools) {
  const tbody = document.getElementById('table-body');

  if (!tools || tools.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="5" class="text-center py-8 text-purple-400">
        No tools added yet. Use the form above to add your first tool.
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = tools.map((tool, i) => `
    <tr class="group">
      <td>
        <div class="flex items-center gap-2">
          <span class="text-purple-500 text-xs font-mono w-5">${i + 1}</span>
          <div>
            <span class="font-semibold text-white text-sm">${tool.name}</span>
            <div class="flex gap-1 mt-0.5 flex-wrap">
              ${(tool.tags || []).slice(0, 3).map(t => `<span class="tag-pill">${t}</span>`).join('')}
              ${(tool.tags || []).length > 3 ? `<span class="tag-pill">+${tool.tags.length - 3}</span>` : ''}
            </div>
          </div>
        </div>
      </td>
      <td>
        <span class="font-semibold text-white">${(tool.views || 0).toLocaleString()}</span>
      </td>
      <td>
        <div class="flex flex-col gap-0.5">
          <div class="flex items-center gap-1">
            <span class="text-xs text-purple-400">Users:</span>
            <span class="text-xs font-medium text-white">${(tool.avgUserRating || 0).toFixed(1)}</span>
            ${renderStarsSmall(tool.avgUserRating || 0)}
            <span class="text-xs text-purple-500">(${tool.userRatingsCount || 0})</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-xs text-purple-400">Admin:</span>
            <span class="text-xs font-medium text-white">${(tool.rating || 0).toFixed(1)}</span>
            ${renderStarsSmall(tool.rating || 0)}
          </div>
        </div>
      </td>
      <td>
        <div class="flex items-center gap-2">
          <button onclick='editTool(${JSON.stringify(tool).replace(/'/g, "&#39;")})' class="text-xs font-medium text-purple-300 hover:text-white transition-colors px-2 py-1 rounded hover:bg-purple-800/50">
            Edit
          </button>
          <button onclick="deleteTool('${tool.id}')" class="text-xs font-medium text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded hover:bg-red-900/20">
            Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
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

  document.getElementById('form-title').textContent = 'Edit Tool';
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
  toast.className = `fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg animate-slide-up ${isError
    ? 'bg-red-900/90 text-red-200 border border-red-700/30'
    : 'bg-purple-800/90 text-purple-100 border border-purple-600/30'
  }`;
  toast.style.backdropFilter = 'blur(12px)';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

document.addEventListener('DOMContentLoaded', () => {
  const passwordInput = document.getElementById('password-input');
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkPassword();
  });
  passwordInput.focus();

  document.getElementById('tool-form').addEventListener('submit', handleSubmit);
});
