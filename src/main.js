import { supabase } from './supabase';
import { categorizeTask, analyzeTaskContext, generateTaskSuggestions, processNaturalLanguage, taskCategories } from './services/ai';
import './style.css';

let tasks = [];
let bookmarks = [];
let map;
let marker;
let isMapVisible = false;
let currentFilter = 'all';
let watchId = null;
let searchTimeout = null;
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];

// Auth state management
let currentUser = null;
let isGuestMode = false;

// Auth UI functions
function showAuth() {
  const authSection = document.getElementById('auth-section');
  const appSection = document.getElementById('app-section');
  if (authSection) authSection.style.display = 'block';
  if (appSection) appSection.style.display = 'none';
}

function showApp() {
  const authSection = document.getElementById('auth-section');
  const appSection = document.getElementById('app-section');
  if (authSection) authSection.style.display = 'none';
  if (appSection) appSection.style.display = 'block';
  updateUserStatus();
}

function updateUserStatus() {
  const statusText = document.getElementById('user-status-text');
  if (!statusText) return;
  
  if (isGuestMode) {
    statusText.textContent = 'Guest Mode (tasks will not be saved)';
    statusText.classList.add('guest-mode');
  } else if (currentUser) {
    statusText.textContent = `Signed in as: ${currentUser.email}`;
    statusText.classList.remove('guest-mode');
  }
}

// Location functions
function getCurrentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (position) {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const location = `Latitude: ${latitude}, Longitude: ${longitude}`;
      const locationInput = document.getElementById('location');
      if (locationInput) locationInput.value = location;

      if (marker) {
        marker.setLatLng([latitude, longitude]);
        map?.setView([latitude, longitude]);
      }
    });
  } else {
    alert('Geolocation is not supported by this browser.');
  }
}

function toggleMap() {
  isMapVisible = !isMapVisible;
  const mapElement = document.getElementById('map');
  if (!mapElement) return;
  
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
    const locationInput = document.getElementById('location');
    if (locationInput) locationInput.value = `Latitude: ${lat}, Longitude: ${lng}`;
  });

  map.on('click', function (e) {
    const clickedLocation = e.latlng;
    marker.setLatLng(clickedLocation);
    const lat = clickedLocation.lat;
    const lng = clickedLocation.lng;
    const locationInput = document.getElementById('location');
    if (locationInput) locationInput.value = `Latitude: ${lat}, Longitude: ${lng}`;
  });
}

// Task management functions
async function addTask() {
  const taskInput = document.getElementById('task');
  const locationInput = document.getElementById('location');
  if (!taskInput || !locationInput) return;

  const taskText = taskInput.value.trim();
  const locationText = locationInput.value.trim();

  if (!taskText || !locationText) return;

  const [lat, lon] = locationText.match(/-?\d+\.\d+/g)?.map(Number) || [];
  if (!lat || !lon) return;

  const newTask = {
    task: taskText,
    latitude: lat,
    longitude: lon,
    user_id: currentUser?.id,
  };

  try {
    if (!isGuestMode && currentUser) {
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
    if (!isGuestMode && currentUser) {
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
    if (!isGuestMode && currentUser) {
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

// Initialize function
function init() {
  try {
    // Set up auth form event listeners
    const authForm = document.getElementById('auth-form');
    const toggleAuthBtn = document.getElementById('toggle-auth');
    const guestAccessBtn = document.getElementById('guest-access');
    const signOutBtn = document.getElementById('sign-out');
    const locationSearchInput = document.getElementById('location-search');

    if (authForm) authForm.addEventListener('submit', handleAuth);
    if (toggleAuthBtn) toggleAuthBtn.addEventListener('click', toggleAuthMode);
    if (guestAccessBtn) guestAccessBtn.addEventListener('click', handleGuestAccess);
    if (signOutBtn) signOutBtn.addEventListener('click', handleSignOut);
    if (locationSearchInput) {
      locationSearchInput.addEventListener('input', handleLocationSearch);
    }

    // Add task categories
    const taskInput = document.getElementById('task');
    if (taskInput && taskInput.parentElement) {
      const categoriesContainer = document.createElement('div');
      categoriesContainer.className = 'task-categories';
      
      Object.keys(taskCategories).forEach(category => {
        const tag = document.createElement('div');
        tag.className = `category-tag ${category}`;
        tag.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        tag.onclick = () => selectCategory(category);
        categoriesContainer.appendChild(tag);
      });

      taskInput.parentElement.insertAdjacentElement('afterend', categoriesContainer);
    }

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) throw error;

      if (session) {
        currentUser = session.user;
        showApp();
        Promise.all([loadTasks(), loadBookmarks()]);
      } else {
        showAuth();
      }
    });

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
  } catch (error) {
    console.error('Initialization error:', error);
    showAuth();
  }
}

function selectCategory(category) {
  document.querySelectorAll('.category-tag').forEach(tag => {
    tag.classList.toggle('active', tag.classList.contains(category));
  });
  
  // Filter tasks by category
  currentFilter = `category-${category}`;
  renderTasks();
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
window.useTaskSuggestion = useTaskSuggestion;
window.toggleVoiceInput = toggleVoiceInput;