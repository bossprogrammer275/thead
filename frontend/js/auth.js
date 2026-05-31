const AUTH_API_BASE = window.location.port === '5500' || window.location.port === '5501' || window.location.port === '3000'
  ? 'http://localhost:5000' 
  : 'https://mysite-gab1.onrender.com';

let currentAuthMode = 'login'; // 'login' or 'signup'

function getCurrentUser() {
  return localStorage.getItem('find_user') || null;
}

function updateHeaderAuthUI() {
  const user = getCurrentUser();
  const navLoginBtn = document.getElementById('nav-login-btn');
  const navUserPill = document.getElementById('nav-user-pill');
  const navUsername = document.getElementById('nav-username');
  const reviewLoggedOutPrompt = document.getElementById('review-loggedout-prompt');
  const reviewForm = document.getElementById('review-form');

  if (user) {
    if (navLoginBtn) navLoginBtn.classList.add('hidden');
    if (navUserPill) {
      navUserPill.classList.remove('hidden');
      navUserPill.classList.add('animate-scale-in');
    }
    if (navUsername) navUsername.textContent = user;
    
    // Toggle review form inside detailed view if active
    if (reviewLoggedOutPrompt) reviewLoggedOutPrompt.classList.add('hidden');
    if (reviewForm) reviewForm.classList.remove('hidden');
  } else {
    if (navLoginBtn) navLoginBtn.classList.remove('hidden');
    if (navUserPill) navUserPill.classList.add('hidden');
    
    if (reviewLoggedOutPrompt) reviewLoggedOutPrompt.classList.remove('hidden');
    if (reviewForm) reviewForm.classList.add('hidden');
  }
}

function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  switchAuthTab('login');
  document.getElementById('auth-username').focus();
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  document.getElementById('auth-form').reset();
  document.getElementById('auth-error-msg').classList.add('hidden');
}

function switchAuthTab(mode) {
  currentAuthMode = mode;
  const tabLogin = document.getElementById('auth-tab-login');
  const tabSignup = document.getElementById('auth-tab-signup');
  const title = document.getElementById('auth-title');
  const btnSubmit = document.getElementById('auth-submit-btn');
  const hint = document.getElementById('auth-username-hint');
  const errorMsg = document.getElementById('auth-error-msg');

  errorMsg.classList.add('hidden');

  if (mode === 'login') {
    tabLogin.className = 'flex-1 py-3 text-center font-bold border-b-2 border-orange-500 text-white';
    tabSignup.className = 'flex-1 py-3 text-center font-bold border-b-2 border-transparent text-purple-400';
    title.textContent = 'Sign In to FIND';
    btnSubmit.textContent = 'Sign In';
    if (hint) hint.classList.add('hidden');
  } else {
    tabLogin.className = 'flex-1 py-3 text-center font-bold border-b-2 border-transparent text-purple-400';
    tabSignup.className = 'flex-1 py-3 text-center font-bold border-b-2 border-orange-500 text-white';
    title.textContent = 'Create FIND Account';
    btnSubmit.textContent = 'Create Account';
    if (hint) hint.classList.remove('hidden');
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  
  const usernameInput = document.getElementById('auth-username');
  const passwordInput = document.getElementById('auth-password');
  const errorMsg = document.getElementById('auth-error-msg');
  const submitBtn = document.getElementById('auth-submit-btn');

  let username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  errorMsg.classList.add('hidden');

  // Username validation for signup
  if (currentAuthMode === 'signup') {
    const regex = /^@[a-z0-9]+$/;
    if (!regex.test(username)) {
      errorMsg.textContent = 'Username must start with @ and contain only lowercase letters and numbers (e.g. @ismailg).';
      errorMsg.classList.remove('hidden');
      usernameInput.classList.add('border-red-500');
      setTimeout(() => usernameInput.classList.remove('border-red-500'), 2500);
      return;
    }
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Processing...';

  try {
    const endpoint = currentAuthMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
    const res = await fetch(`${AUTH_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Authentication failed');

    // Authentication Success
    localStorage.setItem('find_user', data.username);
    closeAuthModal();
    updateHeaderAuthUI();
    
    // Dispatch event to update reviews forms if needed
    window.dispatchEvent(new Event('authChange'));
  } catch (err) {
    console.error('Auth error:', err);
    errorMsg.textContent = err.message;
    errorMsg.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = currentAuthMode === 'login' ? 'Sign In' : 'Create Account';
  }
}

function handleLogout() {
  localStorage.removeItem('find_user');
  updateHeaderAuthUI();
  window.dispatchEvent(new Event('authChange'));
}

document.addEventListener('DOMContentLoaded', () => {
  updateHeaderAuthUI();
  
  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.addEventListener('submit', handleAuthSubmit);
  }
});
