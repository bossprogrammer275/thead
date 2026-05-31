const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? (window.location.port === '5000' ? '' : 'http://localhost:5000')
  : 'https://mysite-gab1.onrender.com';

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

// Light & Dark Mode Toggle
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
}

function updateThemeIcon(mode) {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  if (mode === 'light') {
    // Sun icon
    icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m0 13.5V21M4.95 4.95l1.59 1.59m10.91 10.91l1.59 1.59M3 12h2.25m13.5 0H21M4.95 19.05l1.59-1.59m10.91-10.91l1.59-1.59M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />`;
  } else {
    // Moon icon
    icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />`;
  }
}

function navigateSidebar(section) {
  // Simple animations or scrolling
  if (section === 'home') {
    document.getElementById('search-input').value = '';
    loadAllTools();
    const allPill = document.getElementById('category-pill-all');
    if (allPill) updateActiveCategoryPill(allPill);
  } else if (section === 'categories') {
    document.getElementById('quick-tags').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function updateActiveCategoryPill(activePill) {
  const pills = document.querySelectorAll('.category-pill');
  pills.forEach(p => p.classList.remove('active'));
  activePill.classList.add('active');
}

function renderStars(rating, size = 11) {
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
  const tags = (tool.tags || []).slice(0, 2).map(t =>
    `<span class="tag-pill">${t}</span>`
  ).join(' ');

  return `
    <div onclick="openDetailModalById('${tool.id}')" 
         class="tool-card flex flex-col justify-between h-40 group animate-slide-up"
         style="animation-delay: ${0.03 * index}s; animation-fill-mode: forwards;">
      
      <div>
        <div class="tool-header">
          <h3 class="tool-title group-hover:text-orange-500 transition-colors truncate flex-1">${tool.name}</h3>
          <div class="star-rating flex-shrink-0">${renderStars(tool.rating, 10)}</div>
        </div>
        <p class="tool-desc">${tool.intro || 'No description provided.'}</p>
      </div>

      <div class="tool-footer">
        <div class="flex gap-1">${tags}</div>
        <div class="flex items-center gap-1 text-orange-500 font-bold uppercase tracking-wider text-[9px] group-hover:translate-x-0.5 transition-transform">
          <span>Get</span>
          <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>
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
      <div class="col-span-full py-12 text-center">
        <svg class="w-10 h-10 text-slate-500/50 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <p class="text-sm font-bold text-slate-400">No matching tools found</p>
        <p class="text-xs text-slate-500 mt-1">Try keywords like "design", "ai", "writer", or "productivity".</p>
      </div>
    `;
    countBadge.classList.add('hidden');
    viewMoreWrap.classList.add('hidden');
    return;
  }

  countBadge.textContent = `${tools.length} tool${tools.length !== 1 ? 's' : ''} available`;
  countBadge.classList.remove('hidden');

  const visibleCount = showingAll ? tools.length : 9;
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
    <div class="tool-card h-40 flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-3">
          <div class="w-24 h-4 bg-slate-800 rounded animate-pulse"></div>
          <div class="w-12 h-3 bg-slate-800 rounded animate-pulse"></div>
        </div>
        <div class="w-full h-3 bg-slate-800 rounded animate-pulse mb-1.5"></div>
        <div class="w-5/6 h-3 bg-slate-800 rounded animate-pulse"></div>
      </div>
      <div class="w-16 h-3 bg-slate-800 rounded animate-pulse"></div>
    </div>
  `).join('');
}

async function searchTools(query) {
  if (!query.trim()) {
    loadAllTools();
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
      <div class="col-span-full py-8 text-center text-orange-400 text-xs">
        Unable to connect to discovery server. Please ensure the backend is running.
      </div>
    `;
  }
}

async function loadAllTools() {
  document.getElementById('initial-hint').classList.add('hidden');
  showLoadingSkeleton();
  try {
    const res = await fetch(`${API_BASE}/api/admin/analytics`);
    if (!res.ok) throw new Error();
    allResults = await res.json();
    showingAll = false;
    renderResultsGrid(allResults);
  } catch (err) {
    console.error('Failed to load initial tools:', err);
  }
}

async function loadTrendingTools() {
  const trendingContainer = document.getElementById('trending-list');
  try {
    const res = await fetch(`${API_BASE}/api/admin/analytics`);
    if (!res.ok) throw new Error();
    const tools = await res.json();
    
    // Sort by views desc, take top 5
    const trending = tools.slice(0, 5);
    if (trending.length === 0) {
      trendingContainer.innerHTML = '<div class="text-xs text-slate-500 italic py-2">No trending tools yet.</div>';
      return;
    }

    trendingContainer.innerHTML = trending.map((tool, idx) => `
      <div class="trending-item" onclick="openDetailModalById('${tool.id}')">
        <span class="trending-index">0${idx + 1}</span>
        <div class="trending-details">
          <div class="trending-name">${tool.name}</div>
          <div class="trending-tags">${(tool.tags || []).slice(0, 2).join(', ') || 'Utilities'}</div>
        </div>
        <div class="text-orange-500 font-bold text-xs flex items-center gap-0.5">
          <span>${tool.rating.toFixed(1)}</span>
          <span class="text-[9px]">★</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Trending fetch err:', err);
    trendingContainer.innerHTML = '<div class="text-xs text-red-400 py-2">Failed to load popular tools.</div>';
  }
}

function triggerQuickSearch(keyword) {
  const input = document.getElementById('search-input');
  
  // Highlight active pill matching category
  const pills = document.querySelectorAll('.category-pill');
  pills.forEach(pill => {
    const text = pill.textContent.toLowerCase();
    if ((keyword === 'all' && text.includes('all')) || 
        (keyword !== 'all' && text.includes(keyword.toLowerCase()))) {
      updateActiveCategoryPill(pill);
    }
  });

  if (keyword === 'all') {
    input.value = '';
    loadAllTools();
  } else {
    input.value = keyword;
    searchTools(keyword);
  }
}

function toggleViewMore() {
  showingAll = true;
  renderResultsGrid(allResults);
}

// Expansions Detail Modal handling by ID
async function openDetailModalById(toolId) {
  // Find in allResults or fetch from server
  let tool = allResults.find(t => t.id === toolId);
  if (!tool) {
    // If not found in memory, try to load it from server
    try {
      const res = await fetch(`${API_BASE}/api/admin/analytics`);
      const tools = await res.json();
      tool = tools.find(t => t.id === toolId);
    } catch (e) {}
  }
  if (!tool) return;
  
  currentTool = tool;
  const modal = document.getElementById('detail-modal');
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');

  // Fill in specs
  document.getElementById('modal-tool-name').textContent = tool.name;
  document.getElementById('modal-tool-intro').textContent = tool.intro || 'No intro description available.';
  document.getElementById('modal-admin-stars').innerHTML = renderStars(tool.rating, 12);
  document.getElementById('modal-clicks-badge').textContent = `${(tool.views || 0).toLocaleString()} views`;
  document.getElementById('modal-bestfor').textContent = tool.bestFor || '—';
  document.getElementById('modal-weakness').textContent = tool.weakness || '—';
  document.getElementById('modal-verdict').textContent = tool.verdict || 'No verdict provided.';
  
  // Render tags
  const tagsContainer = document.getElementById('modal-tags');
  tagsContainer.innerHTML = (tool.tags || []).map(t => `<span class="tag-pill">${t}</span>`).join(' ');

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
    // Update local view count
    if (currentTool) {
      currentTool.views = (currentTool.views || 0) + 1;
      document.getElementById('modal-clicks-badge').textContent = `${currentTool.views.toLocaleString()} views`;
    }
  } catch (e) {
    console.error('Click trace err:', e);
  }
  window.open(link, '_blank', 'noopener,noreferrer');
  // reload trending to show updated view count
  loadTrendingTools();
}

// Reviews & Ratings fetching
async function loadReviews(toolId) {
  const reviewsFeed = document.getElementById('reviews-feed');
  reviewsFeed.innerHTML = '<p class="text-xs text-slate-500 italic py-1">Loading reviews...</p>';

  try {
    const res = await fetch(`${API_BASE}/api/tools/${toolId}/reviews`);
    if (!res.ok) throw new Error();
    const reviews = await res.json();

    document.getElementById('modal-reviews-count').textContent = `${reviews.length} rating${reviews.length !== 1 ? 's' : ''}`;

    if (reviews.length === 0) {
      reviewsFeed.innerHTML = `
        <div class="py-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
          Be the first to review this tool!
        </div>
      `;
      document.getElementById('modal-user-avg-rating').textContent = '0.0';
      document.getElementById('modal-user-stars').innerHTML = renderStars(0, 11);
      return;
    }

    // Recalculate average user rating purely to display in UI header
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    document.getElementById('modal-user-avg-rating').textContent = avg.toFixed(1);
    document.getElementById('modal-user-stars').innerHTML = renderStars(avg, 11);

    reviewsFeed.innerHTML = reviews.map(r => `
      <div class="bg-black/10 border border-slate-800/80 rounded-lg p-2.5 space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-white tracking-wide">${r.username}</span>
          <div class="star-rating">${renderStars(r.rating, 9)}</div>
        </div>
        <p class="text-xs text-slate-300 leading-normal font-normal">${r.comment}</p>
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
    loadAllTools();
  } catch (err) {
    alert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Review';
  }
}

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

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

  // Initial load
  loadAllTools();
  loadTrendingTools();
  searchInput.focus();
});
