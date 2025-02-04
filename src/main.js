import { supabase } from './supabase';
import './style.css';

// Initialize Feather Icons
if (window.feather) {
  feather.replace();
}

// Auth Modal Management
const authModal = document.getElementById('auth-modal');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const getStartedBtn = document.getElementById('get-started-btn');
const closeAuthBtn = document.getElementById('close-auth');
const authForm = document.getElementById('auth-form');
const toggleAuthBtn = document.getElementById('toggle-auth');

let isSignUp = false;

function showAuthModal(e) {
  e.preventDefault();
  authModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function hideAuthModal() {
  authModal.classList.remove('active');
  document.body.style.overflow = '';
}

function toggleAuthMode() {
  isSignUp = !isSignUp;
  const submitBtn = authForm.querySelector('button[type="submit"]');
  submitBtn.textContent = isSignUp ? 'Sign Up' : 'Sign In';
  toggleAuthBtn.textContent = isSignUp ? 'Switch to Sign In' : 'Switch to Sign Up';
}

async function handleAuth(e) {
  e.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const submitBtn = authForm.querySelector('button[type="submit"]');
  
  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="loading"></div>';

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) throw error;

      if (data?.user) {
        alert('Registration successful! Please check your email to confirm your account.');
        hideAuthModal();
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data?.user) {
        hideAuthModal();
        window.location.href = '/app';
      }
    }
  } catch (error) {
    alert(error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = isSignUp ? 'Sign Up' : 'Sign In';
  }
}

// Event Listeners
loginBtn?.addEventListener('click', showAuthModal);
signupBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  isSignUp = true;
  toggleAuthMode();
  showAuthModal(e);
});
getStartedBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  isSignUp = true;
  toggleAuthMode();
  showAuthModal(e);
});
closeAuthBtn?.addEventListener('click', hideAuthModal);
authForm?.addEventListener('submit', handleAuth);
toggleAuthBtn?.addEventListener('click', toggleAuthMode);

// Close modal when clicking outside
authModal?.addEventListener('click', (e) => {
  if (e.target === authModal) {
    hideAuthModal();
  }
});

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href !== '#' && href.startsWith('#')) {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth'
        });
      }
    }
  });
});

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check for existing session
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      window.location.href = '/app';
    }
  });
});