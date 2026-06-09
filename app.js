let lcs = [];
let userLocation = null;
let closestSchoolKey = null;

const statusText = document.getElementById('statusText');
const closestBtn = document.getElementById('closestBtn');
const pdfBtn = document.getElementById('pdfBtn');
const clearBtn = document.getElementById('clearBtn');
const governorateFilter = document.getElementById('governorateFilter');
const cityFilter = document.getElementById('cityFilter');
const searchBox = document.getElementById('searchBox');
const results = document.getElementById('results');
const countText = document.getElementById('countText');
const cardTemplate = document.getElementById('cardTemplate');
const printArea = document.getElementById('printArea');

const CITY_KEYWORDS = [
  ['جباليا', 'جباليا'], ['بيت لاهيا', 'بيت لاهيا'], ['بيت حانون', 'بيت حانون'], ['الصفطاوي', 'الصفطاوي'],
  ['غزة', 'غزة'], ['التفاح', 'التفاح'], ['الدرج', 'الدرج'], ['الزيتون', 'الزيتون'], ['الصبرة', 'الصبرة'], ['الشجاعية', 'الشجاعية'], ['الرمال', 'الرمال'], ['تل الهوا', 'تل الهوا'], ['تل الهوى', 'تل الهوى'], ['النصر', 'النصر'], ['الشيخ رضوان', 'الشيخ رضوان'],
  ['النصيرات', 'النصيرات'], ['البريج', 'البريج'], ['بريج', 'البريج'], ['المغازي', 'المغازي'], ['الزوايدة', 'الزوايدة'], ['دير البلح', 'دير البلح'], ['دير البalah', 'دير البلح'],
  ['خان يونس', 'خان يونس'], ['خانيونس', 'خان يونس'], ['خانبونس', 'خان يونس'], ['المواصي', 'المواصي'], ['مواصي', 'المواصي'], ['القرارة', 'القرارة'], ['حمد', 'مدينة حمد'], ['الأمل', 'حي الأمل'], ['الامل', 'حي الأمل'], ['البلد', 'خان يونس البلد'],
  ['رفح', 'رفح'], ['العطار', 'العطار'], ['بير 18', 'بير 18'], ['بئر 18', 'بئر 18'], ['بير 19', 'بير 19'], ['بئر 19', 'بئر 19'], ['بير 20', 'بير 20'], ['بئر 20', 'بئر 20'], ['بير 22', 'بير 22'], ['بئر 22', 'بئر 22']
];

function displayName(lc) {
  return lc.name_ar || lc.name || 'مركز تعليم';
}

function schoolKey(lc) {
  return `${displayName(lc)}|${lc.lat}|${lc.lon}`;
}

function deriveGovernorate(lc) {
  const d = String(lc.directorate || '').toLowerCase();
  if (d.includes('north')) return 'شمال غزة';
  if (d.includes('gaza')) return 'غزة';
  if (d.includes('middle')) return 'دير البلح';
  if (d.includes('khan') || d.includes('khanyounis')) return 'خان يونس';
  if (d.includes('rafah')) return 'رفح';
  return lc.governorate || 'غير محدد';
}

function deriveCity(lc) {
  if (lc.city) return lc.city;
  const text = `${lc.address || ''} ${lc.name_ar || ''} ${lc.name || ''}`.toLowerCase();
  for (const [keyword, city] of CITY_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) return city;
  }
  return deriveGovernorate(lc);
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

function matchesFilters(lc) {
  const gov = governorateFilter.value;
  const city = cityFilter.value;
  const q = normalizeText(searchBox.value);
  if (gov && lc.governorate !== gov) return false;
  if (city && lc.city !== city) return false;
  if (q) {
    const haystack = normalizeText(`${lc.name_ar || ''} ${lc.name || ''} ${lc.address} ${lc.directorate} ${lc.governorate} ${lc.city} ${lc.grades}`);
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function visibleLCs() {
  let items = lcs.filter(matchesFilters);
  if (userLocation) {
    items = items.map(lc => ({
      ...lc,
      distance_m: haversineMeters(userLocation.lat, userLocation.lon, lc.lat, lc.lon)
    })).sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity));
  } else {
    items = items.sort((a, b) => a.governorate.localeCompare(b.governorate, 'ar') || a.city.localeCompare(b.city, 'ar') || displayName(a).localeCompare(displayName(b), 'ar'));
  }
  return items;
}

function option(value, text) {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = text;
  return opt;
}

function populateGovernorates() {
  governorateFilter.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());
  [...new Set(lcs.map(lc => lc.governorate).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'))
    .forEach(g => governorateFilter.appendChild(option(g, g)));
}

function populateCities() {
  const selectedGov = governorateFilter.value;
  cityFilter.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());
  const cities = lcs
    .filter(lc => !selectedGov || lc.governorate === selectedGov)
    .map(lc => lc.city)
    .filter(Boolean);
  [...new Set(cities)].sort((a, b) => a.localeCompare(b, 'ar'))
    .forEach(c => cityFilter.appendChild(option(c, c)));
}

function renderResults() {
  results.innerHTML = '';
  const items = visibleLCs();
  countText.textContent = `${items.length} مركز`;

  if (!items.length) {
    results.innerHTML = '<div class="panel empty">لا توجد مراكز مطابقة للفلاتر المختارة.</div>';
    return;
  }

  items.forEach(lc => {
    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector('.card');
    if (schoolKey(lc) === closestSchoolKey) card.classList.add('closest');
    node.querySelector('.lc-name').textContent = displayName(lc);
    node.querySelector('.lc-meta').textContent = `${lc.governorate} - ${lc.city}`;
    node.querySelector('.distance').textContent = lc.distance_m == null ? '' : formatDistance(lc.distance_m);
    node.querySelector('.address').textContent = lc.address && lc.address !== 'nan' ? `العنوان: ${lc.address}` : 'العنوان غير متوفر';
    node.querySelector('.grades').textContent = lc.grades ? `الصفوف: ${lc.grades}` : 'الصفوف غير متوفرة';
    node.querySelector('.students').textContent = lc.students ? `عدد الطلبة: ${lc.students}` : '';
    const directions = node.querySelector('.directions');
    directions.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lc.lat + ',' + lc.lon)}`;
    results.appendChild(node);
  });
}

function findClosestSchool() {
  if (!navigator.geolocation) {
    statusText.textContent = 'المتصفح لا يدعم تحديد الموقع.';
    return;
  }
  statusText.textContent = 'يرجى السماح باستخدام الموقع لتحديد أقرب مركز...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      const items = visibleLCs();
      if (!items.length) {
        statusText.textContent = 'لم يتم العثور على مركز مطابق للفلاتر الحالية بالقرب من موقعك.';
        renderResults();
        return;
      }
      closestSchoolKey = schoolKey(items[0]);
      statusText.textContent = `أقرب مركز مطابق للفلاتر الحالية هو: ${displayName(items[0])} (${formatDistance(items[0].distance_m)}).`;
      renderResults();
      window.scrollTo({ top: document.querySelector('.list-header').offsetTop - 10, behavior: 'smooth' });
    },
    () => { statusText.textContent = 'لم يتم السماح باستخدام الموقع. يمكنك اختيار المحافظة والمدينة يدوياً.'; },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

function buildPrintArea() {
  const items = visibleLCs();
  const filters = [
    governorateFilter.value ? `المحافظة: ${governorateFilter.value}` : 'كل المحافظات',
    cityFilter.value ? `المدينة: ${cityFilter.value}` : 'كل المدن / المناطق',
    searchBox.value ? `بحث: ${searchBox.value}` : ''
  ].filter(Boolean).join(' | ');

  const rows = items.map((lc, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(displayName(lc))}</td>
      <td>${escapeHtml(lc.governorate)}</td>
      <td>${escapeHtml(lc.city)}</td>
      <td>${escapeHtml(lc.address && lc.address !== 'nan' ? lc.address : '')}</td>
      <td>${escapeHtml(lc.grades || '')}</td>
      <td>${lc.distance_m == null ? '' : escapeHtml(formatDistance(lc.distance_m))}</td>
    </tr>
  `).join('');

  printArea.innerHTML = `
    <h1>قائمة مراكز التعليم</h1>
    <p>${escapeHtml(filters)}</p>
    <p>عدد المراكز: ${items.length}</p>
    <table>
      <thead><tr><th>#</th><th>المركز</th><th>المحافظة</th><th>المدينة / المنطقة</th><th>العنوان</th><th>الصفوف</th><th>المسافة</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function clearFilters() {
  governorateFilter.value = '';
  cityFilter.value = '';
  searchBox.value = '';
  closestSchoolKey = null;
  populateCities();
  renderResults();
}

async function loadData() {
  const response = await fetch('lcs.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load lcs.json');
  const data = await response.json();
  lcs = data
    .filter(lc => Number.isFinite(Number(lc.lat)) && Number.isFinite(Number(lc.lon)))
    .map(lc => ({
      ...lc,
      lat: Number(lc.lat),
      lon: Number(lc.lon),
      governorate: lc.governorate || deriveGovernorate(lc),
      city: lc.city || deriveCity(lc)
    }));
  populateGovernorates();
  populateCities();
  renderResults();
  statusText.textContent = `تم تحميل ${lcs.length} مركز. يمكن اختيار المحافظة والمدينة أو استخدام زر أقرب مركز.`;
}

governorateFilter.addEventListener('change', () => {
  cityFilter.value = '';
  closestSchoolKey = null;
  populateCities();
  renderResults();
});
[cityFilter, searchBox].forEach(el => el.addEventListener('input', () => { closestSchoolKey = null; renderResults(); }));
closestBtn.addEventListener('click', findClosestSchool);
pdfBtn.addEventListener('click', () => { buildPrintArea(); window.print(); });
clearBtn.addEventListener('click', clearFilters);

loadData().catch(err => {
  console.error(err);
  statusText.textContent = 'تعذر تحميل بيانات المراكز. تأكد من وجود ملف lcs.json.';
});
