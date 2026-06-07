let lcs = [];
let userLocation = null;
let map;
let userMarker;
let lcLayer;

// Only the nearest centres are shown after the parent shares location.
// Change this number if you want to show more/less results.
const NEAREST_LIMIT = 10;

const statusText = document.getElementById('statusText');
const locateBtn = document.getElementById('locateBtn');
const gradeFilter = document.getElementById('gradeFilter');
const directorateFilter = document.getElementById('directorateFilter');
const searchBox = document.getElementById('searchBox');
const results = document.getElementById('results');
const countText = document.getElementById('countText');
const cardTemplate = document.getElementById('cardTemplate');

function initMap() {
  map = L.map('map').setView([31.45, 34.39], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  lcLayer = L.layerGroup().addTo(map);
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters) {
  if (meters == null) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function normalizeText(value) {
  return String(value || '').toLowerCase().trim();
}

function lcGrades(lc) {
  return String(lc.grades || '').trim();
}

function gradeToNumber(gradeText) {
  const g = String(gradeText || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!g) return null;
  if (g === 'KG2' || g === 'K2') return 0;
  if (g === 'KG1' || g === 'K1') return -1;
  const match = g.match(/^G(\d{1,2})$/) || g.match(/^GRADE(\d{1,2})$/) || g.match(/^(\d{1,2})$/);
  if (match) return Number(match[1]);
  return null;
}

function numberToGrade(n) {
  if (n === -1) return 'KG1';
  if (n === 0) return 'KG2';
  return `G${n}`;
}

function extractGradeTokens(text) {
  const matches = String(text || '').toUpperCase().match(/KG\s*\d|K\s*\d|G\s*\d{1,2}|GRADE\s*\d{1,2}|\b\d{1,2}\b/g) || [];
  return matches
    .map(token => token.replace(/\s+/g, '').replace(/^GRADE/, 'G').replace(/^K(\d)/, 'KG$1'))
    .filter(Boolean);
}

function lcCoversGrade(lc, selectedGrade) {
  if (!selectedGrade) return true;

  const selectedNumber = gradeToNumber(selectedGrade);
  if (selectedNumber === null) return true;

  const text = lcGrades(lc);
  const tokens = extractGradeTokens(text);
  if (!tokens.length) return false;

  const numbers = tokens.map(gradeToNumber).filter(n => n !== null);
  if (!numbers.length) return false;

  // Handles ranges such as KG2-G12, KG2 to G9, G1 - G4.
  const looksLikeRange = /-|–|—|\bTO\b|\bUNTIL\b|\bTHROUGH\b|\bالى\b|\bإلى\b|\bلغاية\b/i.test(text);
  if (looksLikeRange && numbers.length >= 2) {
    const minGrade = Math.min(...numbers);
    const maxGrade = Math.max(...numbers);
    return selectedNumber >= minGrade && selectedNumber <= maxGrade;
  }

  // Handles comma/list values such as G1, G2, G3.
  return numbers.includes(selectedNumber);
}

function matchesFilters(lc) {
  const grade = gradeFilter.value;
  const directorate = directorateFilter.value;
  const q = normalizeText(searchBox.value);

  if (grade && !lcCoversGrade(lc, grade)) return false;
  if (directorate && String(lc.directorate || '') !== directorate) return false;
  if (q) {
    const haystack = normalizeText(`${lc.name} ${lc.address} ${lc.directorate} ${lc.grades}`);
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function getNearbyBaseLCs() {
  if (!userLocation) return [];
  return lcs
    .map(lc => ({
      ...lc,
      distance_m: haversineMeters(userLocation.lat, userLocation.lon, lc.lat, lc.lon)
    }))
    .sort((a, b) => a.distance_m - b.distance_m);
}

function getVisibleLCs() {
  if (!userLocation) return [];
  return getNearbyBaseLCs().filter(matchesFilters).slice(0, NEAREST_LIMIT);
}

function renderResults() {
  results.innerHTML = '';

  if (!userLocation) {
    countText.textContent = '';
    renderMarkers([]);
    results.innerHTML = '<div class="panel status-panel">Tap “Use my location” to show nearby Learning Centres.</div>';
    return;
  }

  const visible = getVisibleLCs();
  countText.textContent = `${visible.length} nearby centre(s) shown`;

  if (!visible.length) {
    results.innerHTML = '<div class="panel status-panel">No nearby centres match the selected filters.</div>';
    renderMarkers([]);
    return;
  }

  visible.forEach(lc => {
    const node = cardTemplate.content.cloneNode(true);
    node.querySelector('.lc-name').textContent = lc.name || 'Learning Centre';
    node.querySelector('.lc-meta').textContent = lc.directorate || '';
    node.querySelector('.distance').textContent = formatDistance(lc.distance_m);
    node.querySelector('.address').textContent = lc.address ? `Address: ${lc.address}` : 'Address not available';
    node.querySelector('.grades').textContent = lc.grades ? `Grades: ${lc.grades}` : 'Grades not available';
    const directions = node.querySelector('.directions');
    directions.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lc.lat + ',' + lc.lon)}`;
    results.appendChild(node);
  });

  renderMarkers(visible);
}

function renderMarkers(items) {
  lcLayer.clearLayers();
  const bounds = [];

  if (userLocation) {
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker([userLocation.lat, userLocation.lon]).addTo(map).bindPopup('Your location');
    bounds.push([userLocation.lat, userLocation.lon]);
  }

  items.forEach(lc => {
    const popupHtml = `
      <strong>${lc.name || 'Learning Centre'}</strong><br>
      ${lc.directorate || ''}<br>
      ${lc.address || ''}<br>
      Grades: ${lc.grades || 'Not available'}<br>
      Distance: ${formatDistance(lc.distance_m)}<br>
      <a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lc.lat + ',' + lc.lon)}">Directions</a>
    `;
    const marker = L.marker([lc.lat, lc.lon]).bindPopup(popupHtml);
    lcLayer.addLayer(marker);
    bounds.push([lc.lat, lc.lon]);
  });

  if (bounds.length) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
}

function populateFilters() {
  const directorates = [...new Set(lcs.map(lc => lc.directorate).filter(Boolean))].sort();
  directorates.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    directorateFilter.appendChild(opt);
  });

  const gradeNumbers = new Set();
  lcs.forEach(lc => {
    const tokens = extractGradeTokens(lcGrades(lc));
    tokens.forEach(token => {
      const n = gradeToNumber(token);
      if (n !== null) gradeNumbers.add(n);
    });
  });

  [...gradeNumbers].sort((a, b) => a - b).forEach(n => {
    const opt = document.createElement('option');
    opt.value = numberToGrade(n);
    opt.textContent = numberToGrade(n);
    gradeFilter.appendChild(opt);
  });
}

async function loadData() {
  const response = await fetch('lcs.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load lcs.json');
  const data = await response.json();
  lcs = data.filter(lc => Number.isFinite(Number(lc.lat)) && Number.isFinite(Number(lc.lon)))
    .map(lc => ({ ...lc, lat: Number(lc.lat), lon: Number(lc.lon) }));
  populateFilters();
  renderResults();
  statusText.textContent = `${lcs.length} Learning Centres loaded. Tap “Use my location” to show nearby centres.`;
}

function useMyLocation() {
  if (!navigator.geolocation) {
    statusText.textContent = 'Location is not supported by this browser.';
    return;
  }
  statusText.textContent = 'Requesting location permission...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      statusText.textContent = `Location detected. Showing the nearest ${NEAREST_LIMIT} Learning Centres that match your filters.`;
      renderResults();
    },
    err => {
      statusText.textContent = 'Location permission was not granted. Nearby centres cannot be shown without location access.';
      console.warn(err);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

locateBtn.addEventListener('click', useMyLocation);
[gradeFilter, directorateFilter, searchBox].forEach(el => el.addEventListener('input', renderResults));

initMap();
loadData().catch(err => {
  console.error(err);
  statusText.textContent = 'Could not load Learning Centre data. Please check lcs.json.';
});
