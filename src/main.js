import { supabase } from './supabase';

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');
const authSubmit = document.getElementById('auth-submit');
const toggleAuthBtn = document.getElementById('toggle-auth');
const guestAccessBtn = document.getElementById('guest-access');

let isSignUp = false;

// Event Listeners
loginBtn.addEventListener('click', () => {
    isSignUp = false;
    authSubmit.textContent = 'Sign In';
    toggleAuthBtn.textContent = 'Switch to Sign Up';
    authModal.style.display = 'flex';
});

signupBtn.addEventListener('click', () => {
    isSignUp = true;
    authSubmit.textContent = 'Sign Up';
    toggleAuthBtn.textContent = 'Switch to Sign In';
    authModal.style.display = 'flex';
});

toggleAuthBtn.addEventListener('click', () => {
    isSignUp = !isSignUp;
    authSubmit.textContent = isSignUp ? 'Sign Up' : 'Sign In';
    toggleAuthBtn.textContent = isSignUp ? 'Switch to Sign In' : 'Switch to Sign Up';
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        if (isSignUp) {
            const { data, error } = await supabase.auth.signUp({
                email,
                password
            });
            if (error) throw error;
            alert('Registration successful! Please sign in.');
            isSignUp = false;
            authSubmit.textContent = 'Sign In';
            toggleAuthBtn.textContent = 'Switch to Sign Up';
        } else {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;
            window.location.href = '/app';
        }
    } catch (error) {
        alert(error.message);
    }
});

guestAccessBtn.addEventListener('click', () => {
    window.location.href = '/app';
});

// Close modal when clicking outside
authModal.addEventListener('click', (e) => {
    if (e.target === authModal) {
        authModal.style.display = 'none';
    }
});

// Check for existing session
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.href = '/app';
    }
}

checkSession();