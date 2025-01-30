import { supabase } from './supabase';
import './style.css';

// Initialize Feather Icons
function initializeIcons() {
  if (window.feather) {
    feather.replace();
  }
}

// Toast Notification System
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type} animate-slide-up`;
  toast.innerHTML = `
    <i data-feather="${type === 'success' ? 'check-circle' : 'alert-circle'}"></i>
    <span>${message}</span>
  `;
  
  const container = document.getElementById('toast-container');
  container.appendChild(toast);
  initializeIcons();
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Mobile Menu Toggle
function initializeMobileMenu() {
  const menuToggle = document.getElementById('menu-toggle');
  const navbarMenu = document.querySelector('.navbar-menu');
  
  menuToggle?.addEventListener('click', () => {
    navbarMenu.classList.toggle('active');
  });
}

// Task Management
let tasks = [];
let bookmarks = [];
let map;
let marker;
let isMapVisible = false;
let currentFilter = 'all';
let searchTimeout = null;

// Auth state management
let currentUser = null;
let isGuestMode = false;

// Reminder Management
function getReminderTime(option) {
  if (!option) return null;
  
  const now = new Date();
  switch (option) {
    case '1h': return new Date(now.getTime() + 60 * 60 * 1000);
    case '2h': return new Date(now.getTime() + 2 * 60 * 60 * 1000);
    case '4h': return new Date(now.getTime() + 4 * 60 * 60 * 1000);
    case '1d': return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case '2d': return new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    case '1w': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    default: return null;
  }
}

function formatReminderTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Location Search
async function searchLocation(query) {
  if (!query.trim()) {
    document.getElementById('search-results').innerHTML = '';
    return;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=5`
    );
    const data = await response.json();
    
    const resultsContainer = document.getElementById('search-results');
    if (data.length === 0) {
      resultsContainer.innerHTML = `
        <div class="search-result">
          <i data-feather="x-circle"></i>
          <span>No locations found</span>
        </div>
      `;
      initializeIcons();
      return;
    }

    resultsContainer.innerHTML = data
      .map(
        (result) => `
          <div class="search-result" onclick="selectLocation(${result.lat}, ${result.lon}, '${result.display_name}')">
            <i data-feather="map-pin"></i>
            <span>${result.display_name}</span>
          </div>
        `
      )
      .join('');
    initializeIcons();
  } catch (error) {
    console.error('Error searching location:', error);
    showToast('Error searching for location', 'error');
  }
}

function handleLocationSearch(event) {
  const query = event.target.value;
  
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  searchTimeout = setTimeout(() => {
    searchLocation(query);
  }, 500);
}

function selectLocation(lat, lon, displayName) {
  document.getElementById('location').value = `Latitude: ${lat}, Longitude: ${lon}`;
  document.getElementById('location-search').value = displayName;
  document.getElementById('search-results').innerHTML = '';
  
  if (marker) {
    marker.setLatLng([lat, lon]);
    map.setView([lat, lon], 15);
  }
  
  showToast('Location selected');
}

// UI State Management
function showAuth() {
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('app-section').style.display = 'none';
}

function showApp() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('app-section').style.display = 'block';
  updateUserStatus();
}

function updateUserStatus() {
  const userMenu = document.getElementById('user-menu');
  if (!userMenu) return;
  
  if (isGuestMode) {
    userMenu.innerHTML = `
      <div class="user-status guest">
        <i data-feather="user"></i>
        <span>Guest Mode</span>
      </div>
    `;
  } else if (currentUser) {
    userMenu.innerHTML = `
      <div class="user-status">
        <i data-feather="user"></i>
        <span>${currentUser.email}</span>
        <button onclick="handleSignOut()" class="btn btn-outline">
          <i data-feather="log-out"></i>
          Sign Out
        </button>
      </div>
    `;
  }
  initializeIcons();
}

// Bookmark Management
async function loadBookmarks() {
  if (isGuestMode) return;

  try {
    const { data, error } = await supabase
      .from('location_bookmarks')
      .select('*')
      .order('name');

    if (error) throw error;
    bookmarks = data;
    renderBookmarksList();
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    showToast('Error loading bookmarks', 'error');
  }
}

async function addBookmark() {
  const name = document.getElementById('bookmark-name').value.trim();
  const locationInput = document.getElementById('location').value.trim();

  if (!name || !locationInput) {
    showToast('Please enter both name and location', 'error');
    return;
  }

  const [lat, lon] = locationInput.match(/-?\d+\.\d+/g).map(Number);

  try {
    if (!isGuestMode) {
      const { error } = await supabase
        .from('location_bookmarks')
        .insert([{
          name,
          latitude: lat,
          longitude: lon,
          user_id: currentUser.id
        }]);

      if (error) throw error;
      document.getElementById('bookmark-name').value = '';
      await loadBookmarks();
      showToast('Location bookmarked successfully');
    }
  } catch (error) {
    console.error('Error adding bookmark:', error);
    showToast('Error adding bookmark', 'error');
  }
}

async function deleteBookmark(bookmarkId) {
  try {
    if (!isGuestMode) {
      const { error } = await supabase
        .from('location_bookmarks')
        .delete()
        .eq('id', bookmarkId);

      if (error) throw error;
      await loadBookmarks();
      showToast('Bookmark deleted successfully');
    }
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    showToast('Error deleting bookmark', 'error');
  }
}

function useBookmark(latitude, longitude) {
  document.getElementById('location').value = `Latitude: ${latitude}, Longitude: ${longitude}`;
  if (marker) {
    marker.setLatLng([latitude, longitude]);
    map.setView([latitude, longitude], 15);
  }
  showToast('Location loaded from bookmark');
}

function renderBookmarksList() {
  const bookmarksList = document.getElementById('bookmarks-list');
  if (!bookmarksList) return;

  bookmarksList.innerHTML = bookmarks.length === 0 
    ? `
      <li class="no-bookmarks">
        <i data-feather="bookmark"></i>
        <span>No saved locations</span>
      </li>
    `
    : bookmarks.map(bookmark => `
        <li class="bookmark-item animate-slide-up">
          <button onclick="useBookmark(${bookmark.latitude}, ${bookmark.longitude})" class="btn btn-outline">
            <i data-feather="map-pin"></i>
            ${bookmark.name}
          </button>
          <button onclick="deleteBookmark('${bookmark.id}')" class="btn btn-outline delete">
            <i data-feather="trash-2"></i>
          </button>
        </li>
      `).join('');
  
  initializeIcons();
}

// Auth Management
async function handleAuth(e) {
  e.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const authButton = document.getElementById('auth-button');
  const isSignUp = authButton.textContent.includes('Sign Up');

  try {
    authButton.disabled = true;
    authButton.innerHTML = '<div class="loading"></div>';

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          showToast('Account already exists. Please sign in.', 'error');
          toggleAuthMode();
        } else {
          showToast(error.message, 'error');
        }
        return;
      }

      if (data?.user) {
        showToast('Registration successful! Please sign in.');
        toggleAuthMode();
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        showToast(error.message, 'error');
        return;
       Continuing the main.js file content exactly where it left off:

```javascript
      }

      if (data?.user) {
        currentUser = data.user;
        showApp();
        await Promise.all([loadTasks(), loadBookmarks()]);
        showToast('Successfully signed in');
      }
    }
  } catch (error) {
    console.error('Auth error:', error);
    showToast('Connection error. Please try again.', 'error');
  } finally {
    authButton.disabled = false;
    authButton.innerHTML = isSignUp ? 'Sign Up' : 'Sign In';
  }
}

function handleGuestAccess() {
  isGuestMode = true;
  tasks = [];
  showApp();
  showToast('Entered guest mode');
}

function toggleAuthMode() {
  const authButton = document.getElementById('auth-button');
  const toggleButton = document.getElementById('toggle-auth');
  const form = document.getElementById('auth-form');
  
  const isSignUp = authButton.textContent.includes('Sign In');
  authButton.textContent = isSignUp ? 'Sign Up' : 'Sign In';
  toggleButton.textContent = isSignUp ? 'Switch to Sign In' : 'Switch to Sign Up';
  form.reset();
}

async function handleSignOut() {
  try {
    if (!isGuestMode) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    isGuestMode = false;
    currentUser = null;
    tasks = [];
    bookmarks = [];
    showAuth();
    showToast('Successfully signed out');
  } catch (error) {
    console.error('Sign out error:', error);
    showToast('Error signing out', 'error');
  }
}

// Task Management
async function loadTasks() {
  if (isGuestMode) return;

  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    tasks = data;
    renderTasks();
  } catch (error) {
    console.error('Error loading tasks:', error);
    showToast('Error loading tasks', 'error');
  }
}

async function addTask() {
  const taskInput = document.getElementById('task');
  const locationInput = document.getElementById('location');
  const reminderSelect = document.getElementById('reminder-time');
  const taskText = taskInput.value.trim();
  const locationText = locationInput.value.trim();
  const reminderOption = reminderSelect.value;

  if (!taskText || !locationText) {
    showToast('Please enter both task and location', 'error');
    return;
  }

  const [lat, lon] = locationText.match(/-?\d+\.\d+/g).map(Number);
  const reminderTime = getReminderTime(reminderOption);

  const newTask = {
    task: taskText,
    latitude: lat,
    longitude: lon,
    user_id: currentUser?.id,
    reminder_time: reminderTime,
    reminder_sent: false
  };

  try {
    if (!isGuestMode) {
      const { error } = await supabase
        .from('tasks')
        .insert([newTask]);

      if (error) throw error;
      await loadTasks();
    } else {
      tasks.unshift({ ...newTask, id: Date.now() });
      renderTasks();
    }

    taskInput.value = '';
    locationInput.value = '';
    reminderSelect.value = '';
    showToast('Task added successfully');
  } catch (error) {
    console.error('Error adding task:', error);
    showToast('Error adding task', 'error');
  }
}

async function toggleTaskComplete(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  try {
    if (!isGuestMode) {
      const { error } = await supabase
        .from('tasks')
        .update({ completed: !task.completed })
        .eq('id', taskId);

      if (error) throw error;
      await loadTasks();
    } else {
      task.completed = !task.completed;
      renderTasks();
    }
    showToast(`Task marked as ${task.completed ? 'completed' : 'active'}`);
  } catch (error) {
    console.error('Error updating task:', error);
    showToast('Error updating task', 'error');
  }
}

async function deleteTask(taskId) {
  try {
    if (!isGuestMode) {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      await loadTasks();
    } else {
      tasks = tasks.filter(t => t.id !== taskId);
      renderTasks();
    }
    showToast('Task deleted successfully');
  } catch (error) {
    console.error('Error deleting task:', error);
    showToast('Error deleting task', 'error');
  }
}

function filterTasks(filter) {
  currentFilter = filter;
  renderTasks();
  
  // Update filter button states
  document.querySelectorAll('.task-filters button').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase() === filter);
  });
}

function renderTasks() {
  const taskList = document.getElementById('tasks');
  const filteredTasks = tasks.filter(task => {
    if (currentFilter === 'active') return !task.completed;
    if (currentFilter === 'completed') return task.completed;
    return true;
  });

  taskList.innerHTML = filteredTasks.length === 0 
    ? `
      <li class="no-tasks">
        <i data-feather="clipboard"></i>
        <span>No tasks found</span>
      </li>
    `
    : filteredTasks.map(task => `
        <li class="task-card animate-slide-up">
          <div class="task-header">
            <div class="task-title-group">
              <input 
                type="checkbox" 
                ${task.completed ? 'checked' : ''} 
                onchange="toggleTaskComplete('${task.id}')"
                class="task-checkbox"
              />
              <h3 class="task-title ${task.completed ? 'completed' : ''}">${task.task}</h3>
            </div>
            <button onclick="deleteTask('${task.id}')" class="btn btn-outline delete">
              <i data-feather="trash-2"></i>
            </button>
          </div>
          <div class="task-content">
            <div class="location-info">
              <i data-feather="map-pin"></i>
              <span>${task.latitude.toFixed(6)}, ${task.longitude.toFixed(6)}</span>
            </div>
            ${task.reminder_time ? `
              <div class="reminder-badge">
                <i data-feather="bell"></i>
                <span>${formatReminderTime(task.reminder_time)}</span>
              </div>
            ` : ''}
          </div>
        </li>
      `).join('');
  
  initializeIcons();
}

// Location and Map Management
function getCurrentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function (position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const location = `Latitude: ${latitude}, Longitude: ${longitude}`;
        document.getElementById('location').value = location;

        if (marker) {
          marker.setLatLng([latitude, longitude]);
          map.setView([latitude, longitude]);
        }
        showToast('Current location detected');
      },
      function (error) {
        console.error('Geolocation error:', error);
        showToast('Error getting current location', 'error');
      }
    );
  } else {
    showToast('Geolocation is not supported by this browser', 'error');
  }
}

function toggleMap() {
  isMapVisible = !isMapVisible;
  const mapElement = document.getElementById('map');
  if (isMapVisible) {
    mapElement.style.display = 'block';
    initMap();
  } else {
    mapElement.style.display = 'none';
  }
}

function initMap() {
  if (map) return;

  const initialPosition = [51.5074, -0.1278];
  map = L.map('map').setView(initialPosition, 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  marker = L.marker(initialPosition, { draggable: true }).addTo(map);

  marker.on('dragend', function (event) {
    const lat = event.target.getLatLng().lat;
    const lng = event.target.getLatLng().lng;
    document.getElementById('location').value = `Latitude: ${lat}, Longitude: ${lng}`;
  });

  map.on('click', function (e) {
    const clickedLocation = e.latlng;
    marker.setLatLng(clickedLocation);
    const lat = clickedLocation.lat;
    const lng = clickedLocation.lng;
    document.getElementById('location').value = `Latitude: ${lat}, Longitude: ${lng}`;
  });
}

// Initialize Application
async function init() {
  try {
    // Set up event listeners
    const authForm = document.getElementById('auth-form');
    const toggleAuthBtn = document.getElementById('toggle-auth');
    const guestAccessBtn = document.getElementById('guest-access');
    const locationSearchInput = document.getElementById('location-search');

    if (authForm) authForm.addEventListener('submit', handleAuth);
    if (toggleAuthBtn) toggleAuthBtn.addEventListener('click', toggleAuthMode);
    if (guestAccessBtn) guestAccessBtn.addEventListener('click', handleGuestAccess);
    if (locationSearchInput) {
      locationSearchInput.addEventListener('input', handleLocationSearch);
    }

    // Initialize mobile menu
    initializeMobileMenu();

    // Check for existing session
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (session) {
      currentUser = session.user;
      showApp();
      await Promise.all([loadTasks(), loadBookmarks()]);
    } else {
      showAuth();
    }

    // Set up auth state change listener
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        currentUser = session.user;
        showApp();
        await Promise.all([loadTasks(), loadBookmarks()]);
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        showAuth();
      }
    });

    // Initialize icons
    initializeIcons();
  } catch (error) {
    console.error('Initialization error:', error);
    showAuth();
    showToast('Error initializing application', 'error');
  }
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

// Make functions available globally
window.getCurrentLocation = getCurrentLocation;
window.toggleMap = toggleMap;
window.addTask = addTask;
window.toggleTaskComplete = toggleTaskComplete;
window.deleteTask = deleteTask;
window.filterTasks = filterTasks;
window.handleAuth = handleAuth;
window.toggleAuthMode = toggleAuthMode;
window.handleGuestAccess = handleGuestAccess;
window.useBookmark = useBookmark;
window.addBookmark = addBookmark;
window.deleteBookmark = deleteBookmark;
window.selectLocation = selectLocation;
```