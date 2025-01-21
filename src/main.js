import { supabase } from './supabase';
import './style.css';

let tasks = [];
let bookmarks = [];
let map;
let marker;
let isMapVisible = false;
let currentFilter = 'all';
let watchId = null;

// Auth state management
let currentUser = null;
let isGuestMode = false;

// Auth UI functions
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
  const statusText = document.getElementById('user-status-text');
  if (isGuestMode) {
    statusText.textContent = 'Guest Mode (tasks will not be saved)';
    statusText.classList.add('guest-mode');
  } else if (currentUser) {
    statusText.textContent = `Signed in as: ${currentUser.email}`;
    statusText.classList.remove('guest-mode');
  }
}

// Bookmark Management Functions
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
    alert('Error loading bookmarks: ' + error.message);
  }
}

async function addBookmark() {
  const name = document.getElementById('bookmark-name').value.trim();
  const locationInput = document.getElementById('location').value.trim();

  if (!name || !locationInput) {
    alert('Please enter both a name and location for the bookmark');
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
    }
  } catch (error) {
    console.error('Error adding bookmark:', error);
    alert('Error adding bookmark: ' + error.message);
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
    }
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    alert('Error deleting bookmark: ' + error.message);
  }
}

function useBookmark(latitude, longitude) {
  document.getElementById('location').value = `Latitude: ${latitude}, Longitude: ${longitude}`;
  if (marker) {
    marker.setLatLng([latitude, longitude]);
    map.setView([latitude, longitude]);
  }
}

function renderBookmarksList() {
  const bookmarksList = document.getElementById('bookmarks-list');
  if (!bookmarksList) return;

  bookmarksList.innerHTML = bookmarks.length === 0 
    ? '<li class="no-bookmarks">No saved locations</li>'
    : bookmarks.map(bookmark => `
        <li class="bookmark-item">
          <button onclick="useBookmark(${bookmark.latitude}, ${bookmark.longitude})" class="use-bookmark-btn">
            ${bookmark.name}
          </button>
          <button onclick="deleteBookmark('${bookmark.id}')" class="delete-bookmark-btn">
            Delete
          </button>
        </li>
      `).join('');
}

// Auth form handling
async function handleAuth(e) {
  e.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const authButton = document.getElementById('auth-button');
  const isSignUp = authButton.textContent === 'Sign Up';

  try {
    authButton.disabled = true;

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          alert('An account with this email already exists. Please sign in instead.');
          toggleAuthMode();
          return;
        }
        throw error;
      }

      if (data?.user) {
        alert('Registration successful! You can now sign in.');
        toggleAuthMode();
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          alert('Invalid email or password. Please try again.');
        } else if (error.message.includes('Failed to fetch')) {
          alert('Connection error. Please check your internet connection and try again.');
        } else {
          throw error;
        }
        return;
      }

      if (data?.user) {
        currentUser = data.user;
        showApp();
        await Promise.all([loadTasks(), loadBookmarks()]);
      }
    }
  } catch (error) {
    console.error('Auth error:', error);
    alert('An error occurred. Please try again later.');
  } finally {
    authButton.disabled = false;
  }
}

function handleGuestAccess() {
  isGuestMode = true;
  tasks = [];
  showApp();
}

function toggleAuthMode() {
  const authButton = document.getElementById('auth-button');
  const toggleButton = document.getElementById('toggle-auth');
  const form = document.getElementById('auth-form');
  
  if (authButton.textContent === 'Sign In') {
    authButton.textContent = 'Sign Up';
    toggleButton.textContent = 'Switch to Sign In';
  } else {
    authButton.textContent = 'Sign In';
    toggleButton.textContent = 'Switch to Sign Up';
  }
  form.reset();
}

async function handleSignOut() {
  try {
    if (!isGuestMode) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    isGuestMode = false;
    tasks = [];
    bookmarks = [];
    showAuth();
  } catch (error) {
    console.error('Sign out error:', error);
    alert('Error signing out: ' + error.message);
  }
}

// Location and Map functions
function getCurrentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (position) {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const location = `Latitude: ${latitude}, Longitude: ${longitude}`;
      document.getElementById('location').value = location;

      if (marker) {
        marker.setLatLng([latitude, longitude]);
        map.setView([latitude, longitude]);
      }
    });
  } else {
    alert('Geolocation is not supported by this browser.');
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

// Task Management Functions
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
    alert('Error loading tasks: ' + error.message);
  }
}

async function addTask() {
  const taskInput = document.getElementById('task');
  const locationInput = document.getElementById('location');
  const taskText = taskInput.value.trim();
  const locationText = locationInput.value.trim();

  if (!taskText || !locationText) return;

  const [lat, lon] = locationText.match(/-?\d+\.\d+/g).map(Number);

  const newTask = {
    task: taskText,
    latitude: lat,
    longitude: lon,
    user_id: currentUser?.id
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
  } catch (error) {
    console.error('Error adding task:', error);
    alert('Error adding task: ' + error.message);
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
  } catch (error) {
    console.error('Error updating task:', error);
    alert('Error updating task: ' + error.message);
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
  } catch (error) {
    console.error('Error deleting task:', error);
    alert('Error deleting task: ' + error.message);
  }
}

function filterTasks(filter) {
  currentFilter = filter;
  renderTasks();
}

function renderTasks() {
  const taskList = document.getElementById('tasks');
  const filteredTasks = tasks.filter(task => {
    if (currentFilter === 'active') return !task.completed;
    if (currentFilter === 'completed') return task.completed;
    return true;
  });

  taskList.innerHTML = filteredTasks.length === 0 
    ? '<li class="no-tasks">No tasks found</li>'
    : filteredTasks.map(task => `
        <li>
          <div class="task-content ${task.completed ? 'completed' : ''}">
            <input type="checkbox" 
              ${task.completed ? 'checked' : ''} 
              onchange="toggleTaskComplete('${task.id}')"
            />
            <span class="task-text">${task.task}</span>
            <span class="location">
              Location: ${task.latitude.toFixed(6)}, ${task.longitude.toFixed(6)}
            </span>
            <button class="delete-btn" onclick="deleteTask('${task.id}')">
              Delete
            </button>
          </div>
        </li>
      `).join('');
}

// Initialize function
async function init() {
  // Remove URL parameters on load
  if (window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Set up auth form event listeners
  const authForm = document.getElementById('auth-form');
  const toggleAuthBtn = document.getElementById('toggle-auth');
  const guestAccessBtn = document.getElementById('guest-access');
  const signOutBtn = document.getElementById('sign-out');

  if (authForm) authForm.addEventListener('submit', handleAuth);
  if (toggleAuthBtn) toggleAuthBtn.addEventListener('click', toggleAuthMode);
  if (guestAccessBtn) guestAccessBtn.addEventListener('click', handleGuestAccess);
  if (signOutBtn) signOutBtn.addEventListener('click', handleSignOut);

  // Check for existing session
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error checking auth session:', error);
    showAuth();
    return;
  }

  if (session) {
    currentUser = session.user;
    showApp();
    await Promise.all([loadTasks(), loadBookmarks()]);
  } else {
    showAuth();
  }

  // Set up auth state change listener
  supabase.auth.onAuthStateChange(async (event, session) => {
    // Remove URL parameters on auth state change
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (event === 'SIGNED_IN') {
      currentUser = session.user;
      showApp();
      await Promise.all([loadTasks(), loadBookmarks()]);
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      showAuth();
    }
  });
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