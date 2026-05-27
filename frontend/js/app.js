const API_BASE = window.location.port === '5500' || window.location.port === '5501' || window.location.port === '3000'
  ? 'http://localhost:5000' 
  : '';

let allResults = [];
let showingAll = false;
let debounceTimer = null;
let currentTool = null; // Store currently viewed tool details
let selectedReviewRating = 4; // Default review rating is 4

function debounce(fn, delay) {
  return function (...args) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function renderStars(rating, size = 12) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25 && rating - full < 0.75;
  const extraFull = rating - full >= 0.75;
  const totalFull = extraFull ? full + 1 : full;
  let html = '';
  for (let i = 0; i < totalFull; i++) {
    html += `<span class="star filled" style="font-size:${size}px">★</span>`;
  }
  if (hasHalf) {
    html += `<span class="star half" style="font-size:${size}px">★</span>`;
  }
  const empty = 5 - totalFull - (hasHalf ? 1 : 0);
  for (let i = 0; i < empty; i++) {
    html += `<span class="star" style="font-size:${size}px">★</span>`;
  }
  return html;
}

function createToolCard(tool, index) {
  const tags = (tool.tags || []).slice(0, 3).map(t =>
    `<span class="tag-pill">${t}</span>`
  ).join(' ');

  return `
    <div onclick="openDetailModalById('${tool.id}')" 
         class="glass-card p-5 cursor-pointer animate-slide-up flex flex-col justify-between h-56 relative overflow-hidden group"
         style="opacity: 0; animation-delay: ${0.05 * index}s; animation-fill-mode: forwards;">
      
      <div class="space-y-2">
        <div class="flex items-start justify-between gap-2">
          <h3 class="text-lg font-bold text-white group-hover:text-orange-400 transition-colors truncate flex-1">${tool.name}</h3>
          <div class="star-rating flex-shrink-0">${renderStars(tool.rating, 11)}</div>
        </div>
        <p class="text-xs text-purple-200 line-clamp-3 leading-relaxed">${tool.intro || 'No description provided.'}</p>
      </div>

      <div class="pt-4 border-t border-purple-900/20">
        <div class="flex items-center justify-between gap-2 text-[10px]">
          <div class="flex flex-wrap gap-1">${tags}</div>
          <div class="flex items-center gap-1.5 text-purple-400 font-semibold uppercase tracking-wider flex-shrink-0">
            <span>Details</span>
            <svg class="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderResultsGrid(tools) {
  const grid = document.getElementById('results-grid');
  const countBadge = document.getElementById('results-count');
  const viewMoreWrap = document.getElementById('view-more-wrap');

  if (!tools || tools.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center animate-fade-in">
        <svg class="w-12 h-12 stroke-[1.25] text-purple-500/50 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <p class="text-base font-bold text-purple-300">No matching tools found</p>
        <p class="text-xs text-purple-500 mt-1">Try keywords like "design", "ai", "writer", or "productivity".</p>
      </div>
    `;
    countBadge.classList.add('hidden');
    viewMoreWrap.classList.add('hidden');
    return;
  }

  countBadge.textContent = `${tools.length} curated tool${tools.length !== 1 ? 's' : ''} found`;
  countBadge.classList.remove('hidden');

  const visibleCount = showingAll ? tools.length : 6;
  const toolsToShow = tools.slice(0, visibleCount);

  grid.innerHTML = toolsToShow.map((t, idx) => createToolCard(t, idx)).join('');

  if (tools.length > visibleCount) {
    viewMoreWrap.classList.remove('hidden');
    document.getElementById('view-more-btn').textContent = `View ${tools.length - visibleCount} More Tools`;
  } else {
    viewMoreWrap.classList.add('hidden');
  }
}

function showLoadingSkeleton() {
  const grid = document.getElementById('results-grid');
  grid.innerHTML = Array(6).fill(0).map(() => `
    <div class="glass-card p-5 h-56 flex flex-col justify-between">
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="loading-skeleton h-5 w-28"></div>
          <div class="loading-skeleton h-3 w-16"></div>
        </div>
        <div class="loading-skeleton h-3 w-full"></div>
        <div class="loading-skeleton h-3 w-5/6"></div>
        <div class="loading-skeleton h-3 w-2/3"></div>
      </div>
      <div class="loading-skeleton h-6 w-20"></div>
    </div>
  `).join('');
}

async function searchTools(query) {
  if (!query.trim()) {
    document.getElementById('results-grid').innerHTML = '';
    document.getElementById('results-count').classList.add('hidden');
    document.getElementById('view-more-wrap').classList.add('hidden');
    document.getElementById('initial-hint').classList.remove('hidden');
    return;
  }

  document.getElementById('initial-hint').classList.add('hidden');
  showLoadingSkeleton();

  try {
    const res = await fetch(`${API_BASE}/api/tools/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Search failed');
    allResults = await res.json();
    showingAll = false;
    renderResultsGrid(allResults);
  } catch (err) {
    console.error('Search error:', err);
    document.getElementById('results-grid').innerHTML = `
      <div class="col-span-full py-8 text-center text-orange-400 text-sm">
        Unable to connect to discovery server. Please ensure the backend is running.
      </div>
    `;
  }
}

function triggerQuickSearch(keyword) {
  const input = document.getElementById('search-input');
  input.value = keyword;
  searchTools(keyword);
}

function toggleViewMore() {
  showingAll = true;
  renderResultsGrid(allResults);
}

// Expansions Detail Modal handling by ID
async function openDetailModalById(toolId) {
  const tool = allResults.find(t => t.id === toolId);
  if (!tool) return;
  
  currentTool = tool;
  const modal = document.getElementById('detail-modal');
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');

  // Fill in specs
  document.getElementById('modal-tool-name').textContent = tool.name;
  document.getElementById('modal-tool-intro').textContent = tool.intro || 'No intro description available.';
  document.getElementById('modal-admin-stars').innerHTML = renderStars(tool.rating, 14);
  document.getElementById('modal-clicks-badge').textContent = `${(tool.views || 0).toLocaleString()} views`;
  document.getElementById('modal-bestfor').textContent = tool.bestFor || '—';
  document.getElementById('modal-weakness').textContent = tool.weakness || '—';
  document.getElementById('modal-verdict').textContent = tool.verdict || 'No verdict provided.';
  
  // Render tags
  const tagsContainer = document.getElementById('modal-tags');
  tagsContainer.innerHTML = (tool.tags || []).map(t => `<span class="badge badge-purple">${t}</span>`).join(' ');

  // Set action button onclick click tracking & redirect
  const visitBtn = document.getElementById('modal-visit-btn');
  visitBtn.onclick = () => handleVisit(tool.id, tool.link);

  // Setup Review rating selector
  resetReviewForm();

  // Load reviews list
  await loadReviews(tool.id);
}

function closeDetailModal() {
  document.getElementById('detail-modal').classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  currentTool = null;
}

// Clicks Tracker
async function handleVisit(toolId, link) {
  try {
    fetch(`${API_BASE}/api/tools/${toolId}/click`, { method: 'POST' });
  } catch (e) {
    console.error('Click trace err:', e);
  }
  window.open(link, '_blank', 'noopener,noreferrer');
}

// Reviews & Ratings fetching
async function loadReviews(toolId) {
  const reviewsFeed = document.getElementById('reviews-feed');
  reviewsFeed.innerHTML = '<p class="text-xs text-purple-400 italic py-2">Loading reviews...</p>';

  try {
    const res = await fetch(`${API_BASE}/api/tools/${toolId}/reviews`);
    if (!res.ok) throw new Error();
    const reviews = await res.json();

    document.getElementById('modal-reviews-count').textContent = `${reviews.length} review${reviews.length !== 1 ? 's' : ''}`;

    if (reviews.length === 0) {
      reviewsFeed.innerHTML = `
        <div class="py-6 text-center text-xs text-purple-500 border border-dashed border-purple-900/30 rounded-xl">
          Be the first to review this tool!
        </div>
      `;
      document.getElementById('modal-user-avg-rating').textContent = '0.0';
      document.getElementById('modal-user-stars').innerHTML = renderStars(0, 12);
      return;
    }

    // Recalculate average user rating purely to display in UI header
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    document.getElementById('modal-user-avg-rating').textContent = avg.toFixed(1);
    document.getElementById('modal-user-stars').innerHTML = renderStars(avg, 12);

    reviewsFeed.innerHTML = reviews.map(r => `
      <div class="bg-purple-950/40 border border-purple-900/30 rounded-xl p-3.5 space-y-1.5 animate-scale-in">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-white tracking-wide">${r.username}</span>
          <div class="star-rating">${renderStars(r.rating, 10)}</div>
        </div>
        <p class="text-xs text-purple-200 leading-normal font-normal">${r.comment}</p>
      </div>
    `).join('');
  } catch (err) {
    reviewsFeed.innerHTML = '<p class="text-xs text-red-400">Failed to load reviews.</p>';
  }
}

// Review form handling
function resetReviewForm() {
  const form = document.getElementById('review-form');
  if (form) form.reset();
  setInteractiveStars(4); // Default to 4
  
  // Set correct visibility based on auth
  if (typeof updateHeaderAuthUI === 'function') {
    updateHeaderAuthUI();
  }
}

function setInteractiveStars(rating) {
  selectedReviewRating = rating;
  const starsContainer = document.getElementById('review-star-selector');
  starsContainer.querySelectorAll('.star-btn').forEach(btn => {
    const r = parseInt(btn.dataset.rating);
    btn.classList.toggle('active', r <= rating);
  });
}

async function handleReviewSubmit(e) {
  e.preventDefault();
  
  const user = getCurrentUser();
  if (!user) {
    openAuthModal();
    return;
  }

  const commentInput = document.getElementById('review-comment');
  const submitBtn = document.getElementById('review-submit-btn');

  const comment = commentInput.value.trim();
  if (!comment) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Posting...';

  try {
    const res = await fetch(`${API_BASE}/api/tools/${currentTool.id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user,
        rating: selectedReviewRating,
        comment
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit review');

    // Reload reviews list immediately
    await loadReviews(currentTool.id);
    
    // Reset review input
    commentInput.value = '';
    setInteractiveStars(4);

    // Refresh general search screen ratings
    if (document.getElementById('search-input').value.trim()) {
      searchTools(document.getElementById('search-input').value);
    }
  } catch (err) {
    alert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Review';
  }
}

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  const debouncedSearch = debounce(searchTools, 300);

  searchInput.addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(debounceTimer);
      searchTools(e.target.value);
    }
  });

  // Star Rating interactive click selectors
  const starsContainer = document.getElementById('review-star-selector');
  if (starsContainer) {
    starsContainer.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rating = parseInt(e.target.dataset.rating);
        setInteractiveStars(rating);
      });
    });
  }

  // Review Form Submit listener
  const reviewForm = document.getElementById('review-form');
  if (reviewForm) {
    reviewForm.addEventListener('submit', handleReviewSubmit);
  }

  // Reload reviews logic on session changes
  window.addEventListener('authChange', () => {
    if (currentTool) {
      resetReviewForm();
    }
  });

  searchInput.focus();
});
