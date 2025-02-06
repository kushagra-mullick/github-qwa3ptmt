let tasks = [];
let map;
let marker;
let isMapVisible = false;

function getCurrentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (position) {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const location = `Latitude: ${latitude}, Longitude: ${longitude}`;
      document.getElementById('location').value = location;

      // Move marker to the current location
      if (marker) {
        marker.setLatLng([latitude, longitude]);
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
    initMap(); // Initialize the map only when the user wants to select a location
  } else {
    mapElement.style.display = 'none';
  }
}

function initMap() {
  if (map) {
    return; // Map already initialized
  }

  // Default to London coordinates, you can change it as needed
  const initialPosition = [51.5074, -0.1278];

  // Initialize the map
  map = L.map('map').setView(initialPosition, 15);

  // Add OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Add a draggable marker
  marker = L.marker(initialPosition, { draggable: true }).addTo(map);

  // Update location input when marker is dragged
  marker.on('dragend', function (event) {
    const lat = event.target.getLatLng().lat;
    const lng = event.target.getLatLng().lng;
    document.getElementById(
      'location'
    ).value = `Latitude: ${lat}, Longitude: ${lng}`;
  });

  // Add click listener on the map
  map.on('click', function (e) {
    const clickedLocation = e.latlng;
    marker.setLatLng(clickedLocation);
    const lat = clickedLocation.lat;
    const lng = clickedLocation.lng;
    document.getElementById(
      'location'
    ).value = `Latitude: ${lat}, Longitude: ${lng}`;
  });
}

function addTask() {
  const taskInput = document.getElementById('task');
  const locationInput = document.getElementById('location');
  const taskText = taskInput.value.trim();
  const locationText = locationInput.value.trim();

  if (taskText && locationText) {
    const newTask = {
      task: taskText,
      location: locationText,
    };
    tasks.push(newTask);
    taskInput.value = '';
    locationInput.value = '';
    renderTasks();
  }
}

function renderTasks() {
  const taskList = document.getElementById('tasks');
  taskList.innerHTML = '';

  tasks.forEach((task, index) => {
    const taskItem = document.createElement('li');
    taskItem.innerHTML = `
            <span>${task.task}</span>
            <span class="location">Location: ${task.location}</span>
        `;
    taskList.appendChild(taskItem);
  });
}
