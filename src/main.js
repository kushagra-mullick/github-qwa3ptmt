import { supabase } from './supabase';
import { categorizeTask, analyzeTaskContext, generateTaskSuggestions, processNaturalLanguage } from './services/ai';
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

// Reminder options for select
const reminderOptions = [
  { value: '', label: 'No reminder' },
  { value: '1h', label: 'In 1 hour' },
  { value: '2h', label: 'In 2 hours' },
  { value: '4h', label: 'In 4 hours' },
  { value: '1d', label: 'In 1 day' },
  { value: '2d', label: 'In 2 days' },
  { value: '1w', label: 'In 1 week' }
];

// Initialize speech recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
  recognition.continuous = false;
  recognition.lang = 'en-US';
  
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById('task').value = transcript;
    processTaskInput(transcript);
  };
}

function toggleVoiceInput() {
  if (!recognition) {
    alert('Speech recognition is not supported in your browser.');
    return;
  }

  if (isRecording) {
    recognition.stop();
    isRecording = false;
  } else {
    recognition.start();
    isRecording = true;
  }

  const voiceButton = document.querySelector('.voice-input-btn');
  voiceButton.innerHTML = isRecording ? '🔴' : '🎤';
}

async function processTaskInput(input) {
  const { task, location, time } = processNaturalLanguage(input);
  const category = categorizeTask(task);
  const { priority, context } = analyzeTaskContext(task);

  // Update UI with processed information
  document.getElementById('task').value = task;
  if (location) {
    document.getElementById('location-search').value = location;
    // Trigger location search
    await searchLocation(location);
  }

  // Show task category
  const categoryTag = document.createElement('div');
  categoryTag.className = `category-tag ${category}`;
  categoryTag.textContent = category.charAt(0).toUpperCase() + category.slice(1);
  document.querySelector('.task-categories').appendChild(categoryTag);

  // Generate and show suggestions
  if (marker) {
    const suggestions = await generateTaskSuggestions(
      marker.getLatLng().lat,
      marker.getLatLng().lng
    );
    showSuggestions(suggestions);
  }
}

function showSuggestions(suggestions) {
  const suggestionsContainer = document.querySelector('.task-suggestions');
  suggestionsContainer.innerHTML = suggestions.map(suggestion => `
    <div class="suggestion-item" onclick="useTaskSuggestion('${suggestion.task}', '${suggestion.category}')">
      <span class="suggestion-icon">💡</span>
      <span>${suggestion.task}</span>
      <span class="suggestion-category">${suggestion.category}</span>
    </div>
  `).join('');
}

function useTaskSuggestion(task, category) {
  document.getElementById('task').value = task;
  // Highlight the corresponding category
  document.querySelectorAll('.category-tag').forEach(tag => {
    tag.classList.toggle('active', tag.classList.contains(category));
  });
}

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
  return date.toLocaleString();
}

// Location search functions
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
      resultsContainer.innerHTML = '<div class="no-results">No locations found</div>';
      return;
    }

    resultsContainer.innerHTML = data
      .map(
        (result) => `
          <div class="search-result" onclick="selectLocation(${result.lat}, ${result.lon}, '${result.display_name}')">
            <span class="result-name">${result.display_name}</span>
          </div>
        `
      )
      .join('');
  } catch (error) {
    console.error('Error searching location:', error);
    document.getElementById('search-results').innerHTML = 
      '<div class="search-error">Error searching for location</div>';
  }
}

function handleLocationSearch(event) {
  const query = event.target.value;
  
  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  // Set new timeout to prevent too many API calls
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
}

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
        password
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          alert('An account with this email already exists. Please sign in instead.');
          toggleAuthMode();
        } else {
          alert(error.message);
        }
        return;
      }

      if (data?.user) {
        alert('Registration successful! Please sign in with your credentials.');
        toggleAuthMode();
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          alert('Invalid email or password. Please try again.');
        } else {
          alert(error.message);
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
    alert('Connection error. Please check your internet connection and try again.');
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
  
  const isSignUp = authButton.textContent === 'Sign In';
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
  } catch (error) {
    console.error('Sign out error:', error);
    alert('Error signing out: ' + error.message);
  }
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
  const reminderSelect = document.getElementById('reminder-time');
  const taskText = taskInput.value.trim();
  const locationText = locationInput.value.trim();
  const reminderOption = reminderSelect.value;

  if (!taskText || !locationText) return;

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
            <div class="task-details">
              <span class="task-text">${task.task}</span>
              <span class="location">
                Location: ${task.latitude.toFixed(6)}, ${task.longitude.toFixed(6)}
              </span>
              ${task.reminder_time ? `
                <span class="reminder-time">
                  🔔 Reminder: ${formatReminderTime(task.reminder_time)}
                </span>
              ` : ''}
            </div>
            <button class="delete-btn" onclick="deleteTask('${task.id}')">
              Delete
            </button>
          </div>
        </li>
      `).join('');
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

// Initialize function
async function init() {
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
  } catch (error) {
    console.error('Initialization error:', error);
    showAuth();
  }
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  init();
  
  // Add voice input button
  const taskInput = document.getElementById('task');
  const voiceButton = document.createElement('button');
  voiceButton.className = 'voice-input-btn';
  voiceButton.innerHTML = '🎤';
  voiceButton.onclick = toggleVoiceInput;
  taskInput.parentElement.appendChild(voiceButton);

  // Add task categories
  const categoriesContainer = document.createElement('div');
  categoriesContainer.className = 'task-categories';
  Object.keys(taskCategories).forEach(category => {
    const tag = document.createElement('div');
    tag.className = `category-tag ${category}`;
    tag.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    categoriesContainer.appendChild(tag);
  });
  document.querySelector('.input-section').insertBefore(
    categoriesContainer,
    document.querySelector('.location-input-group')
  );

  // Add suggestions container
  const suggestionsContainer = document.createElement('div');
  suggestionsContainer.className = 'task-suggestions';
  document.querySelector('.input-section').insertBefore(
    suggestionsContainer,
    document.querySelector('.location-input-group')
  );
});

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