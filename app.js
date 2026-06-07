let lcs = [];
let userLocation = null;
let map;
let userMarker;
let lcLayer;

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
  if (meters < 1000) return `${Math.round(meters)} متر`;
  return `${(meters / 1000).toFixed(1)} كم`;
}

function normalizeText(value) {
  return String(value || '').toLowerCase().trim();
}

function lcGrades(lc) {
  return String(lc.grades || '').trim();
}

function matchesFilters(lc) {
  const grade = gradeFilter.value;
  const directorate = directorateFilter.value;
  const q = normalizeText(searchBox.value);

  if (grade && !lcGrades(lc).toLowerCase().includes(grade.toLowerCase())) return false;
  if (directorate && String(lc.directorate || '') !== directorate) return false;
  if (q) {
    const haystack = normalizeText(`${lc.name} ${lc.address} ${lc.directorate}`);
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function getFilteredSortedLCs() {
  let items = lcs.filter(matchesFilters);
  if (userLocation) {
    items = items.map(lc => ({
      ...lc,
      distance_m: haversineMeters(userLocation.lat, userLocation.lon, lc.lat, lc.lon)
    })).sort((a, b) => a.distance_m - b.distance_m);
  }
  return items;
}

function renderResults() {
  const items = getFilteredSortedLCs();
  const visible = userLocation ? items.slice(0, 10) : items.slice(0, 50);
  results.innerHTML = '';
  countText.textContent = userLocation ? `يتم عرض أقرب ${visible.length} مراكز` : `يتم عرض ${visible.length} مركزاً`;

  if (!visible.length) {
    results.innerHTML = '<div class="panel status-panel">لا توجد مراكز مطابقة للفلاتر المحددة.</div>';
    renderMarkers([]);
    return;
  }

  visible.forEach(lc => {
    const node = cardTemplate.content.cloneNode(true);
    node.querySelector('.lc-name').textContent = lc.name || 'مركز تعلم';
    node.querySelector('.lc-meta').textContent = lc.directorate || '';
    node.querySelector('.distance').textContent = formatDistance(lc.distance_m);
    node.querySelector('.address').textContent = lc.address ? `العنوان: ${lc.address}` : 'العنوان غير متوفر';
    node.querySelector('.grades').textContent = lc.grades ? `الصفوف: ${lc.grades}` : 'الصفوف غير متوفرة';
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
    userMarker = L.marker([userLocation.lat, userLocation.lon]).addTo(map).bindPopup('موقعك الحالي');
    bounds.push([userLocation.lat, userLocation.lon]);
  }

  items.forEach(lc => {
    const popup = `
      <div class="popup-ar">
        <strong>${lc.name || 'مركز تعلم'}</strong><br>
        ${lc.address || 'العنوان غير متوفر'}<br>
        ${lc.grades ? 'الصفوف: ' + lc.grades + '<br>' : ''}
        ${formatDistance(lc.distance_m)}
      </div>`;
    const marker = L.marker([lc.lat, lc.lon]).bindPopup(popup);
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

  const gradeSet = new Set();
  lcs.forEach(lc => {
    const text = lcGrades(lc);
    const matches = text.match(/KG\d|G\d{1,2}|Grade\s*\d{1,2}|\d{1,2}/gi) || [];
    matches.forEach(g => gradeSet.add(g.toUpperCase().replace(/GRADE\s*/i, 'G')));
  });
  [...gradeSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
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
  statusText.textContent = `تم تحميل ${lcs.length} مركز تعلم. اضغط على “استخدم موقعي الحالي” لعرض أقرب المراكز.`;
}

function useMyLocation() {
  if (!navigator.geolocation) {
    statusText.textContent = 'خدمة تحديد الموقع غير مدعومة في هذا المتصفح.';
    return;
  }
  statusText.textContent = 'جاري طلب السماح بتحديد الموقع...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      statusText.textContent = 'تم تحديد موقعك. يتم الآن عرض أقرب مراكز التعلم.';
      renderResults();
    },
    err => {
      statusText.textContent = 'لم يتم السماح باستخدام الموقع. يمكنك تصفح المراكز واستخدام الفلاتر.';
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
  statusText.textContent = 'تعذر تحميل بيانات مراكز التعلم. يرجى التأكد من ملف lcs.json.';
});
