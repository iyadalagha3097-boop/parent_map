let lcs = [];

const statusText = document.getElementById('statusText');
const pdfBtn = document.getElementById('pdfBtn');
const clearBtn = document.getElementById('clearBtn');
const governorateFilter = document.getElementById('governorateFilter');
const cityFilter = document.getElementById('cityFilter');
const gradeFilter = document.getElementById('gradeFilter');
const searchBox = document.getElementById('searchBox');
const results = document.getElementById('results');
const countText = document.getElementById('countText');
const cardTemplate = document.getElementById('cardTemplate');
const printArea = document.getElementById('printArea');

const GRADE_AR_LABELS = {
  'KG1': 'بستان',
  'KG2': 'تمهيدي',
  'G1': 'الأول',
  'G2': 'الثاني',
  'G3': 'الثالث',
  'G4': 'الرابع',
  'G5': 'الخامس',
  'G6': 'السادس',
  'G7': 'السابع',
  'G8': 'الثامن',
  'G9': 'التاسع',
  'G10': 'العاشر',
  'G11': 'الحادي عشر',
  'G12': 'الثاني عشر'
};

const AR_GRADE_NUMBERS = {
  'بستان': -1,
  'تمهيدي': 0,
  'أول': 1,
  'اول': 1,
  'الأول': 1,
  'الاول': 1,
  'ثاني': 2,
  'الثاني': 2,
  'ثالث': 3,
  'الثالث': 3,
  'رابع': 4,
  'الرابع': 4,
  'خامس': 5,
  'الخامس': 5,
  'سادس': 6,
  'السادس': 6,
  'سابع': 7,
  'السابع': 7,
  'ثامن': 8,
  'الثامن': 8,
  'تاسع': 9,
  'التاسع': 9,
  'عاشر': 10,
  'العاشر': 10,
  'حادي عشر': 11,
  'الحادي عشر': 11,
  'ثاني عشر': 12,
  'الثاني عشر': 12
};

function normalizeText(value) {
  return String(value || '').toLowerCase().trim();
}

function getValue(lc, keys, fallback = '') {
  for (const key of keys) {
    const value = lc[key];
    if (value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim().toLowerCase() !== 'nan') {
      return String(value).trim();
    }
  }
  return fallback;
}

function displayName(lc) {
  return getValue(lc, ['اسم النقطة التعليمية', 'name_ar', 'name'], 'مركز تعليم');
}

function governorate(lc) {
  return getValue(lc, ['المحافظة', 'governorate', 'directorate'], 'غير محدد');
}

function city(lc) {
  return getValue(lc, ['المدينة- المنطقة', 'المدينة / المنطقة', 'city'], 'غير محدد');
}

function address(lc) {
  return getValue(lc, ['العنوان', 'address'], '');
}

function grades(lc) {
  return getValue(lc, ['الصفوف', 'grades'], '');
}

function students(lc) {
  return getValue(lc, ['عدد الطلبة', 'students'], '');
}

function lat(lc) {
  const value = Number(getValue(lc, ['lat', 'Latitude', 'خط العرض'], ''));
  return Number.isFinite(value) ? value : null;
}

function lon(lc) {
  const value = Number(getValue(lc, ['lon', 'lng', 'Longitude', 'خط الطول'], ''));
  return Number.isFinite(value) ? value : null;
}

function hasCoordinates(lc) {
  return lat(lc) !== null && lon(lc) !== null;
}

function googleMapsUrl(lc) {
  if (!hasCoordinates(lc)) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat(lc) + ',' + lon(lc))}`;
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

function gradeArabicLabel(code) {
  return GRADE_AR_LABELS[code] || code;
}

function extractGradeNumbers(text) {
  const source = String(text || '');
  const numbers = [];

  const enMatches = source.toUpperCase().match(/KG\s*\d|K\s*\d|G\s*\d{1,2}|GRADE\s*\d{1,2}|\b\d{1,2}\b/g) || [];
  enMatches.forEach(token => {
    const clean = token.replace(/\s+/g, '').replace(/^GRADE/, 'G').replace(/^K(\d)/, 'KG$1');
    const n = gradeToNumber(clean);
    if (n !== null) numbers.push(n);
  });

  Object.entries(AR_GRADE_NUMBERS).forEach(([label, n]) => {
    if (source.includes(label)) numbers.push(n);
  });

  return [...new Set(numbers)].sort((a, b) => a - b);
}

function gradesStartWithKg(lc) {
  const text = grades(lc).trim();
  const compact = text.toUpperCase().replace(/\s+/g, '');

  return (
    compact.startsWith('KG1') ||
    compact.startsWith('K1') ||
    compact.startsWith('KG2') ||
    compact.startsWith('K2') ||
    compact.startsWith('G1') ||
    text.startsWith('بستان') ||
    text.startsWith('تمهيدي') ||
    text.startsWith('أول') ||
    text.startsWith('اول') ||
    text.startsWith('الأول') ||
    text.startsWith('الاول')
  );
}

function lcCoversGrade(lc, selectedGrade) {
  if (!selectedGrade) return true;
  if (selectedGrade === 'KG_START') return gradesStartWithKg(lc);

  const selectedNumber = gradeToNumber(selectedGrade);
  if (selectedNumber === null) return true;

  const text = grades(lc);
  const numbers = extractGradeNumbers(text);
  if (!numbers.length) return false;

  const looksLikeRange = /-|–|—|\bTO\b|\bUNTIL\b|\bTHROUGH\b|الى|إلى|لغاية/i.test(text);
  if (looksLikeRange && numbers.length >= 2) {
    const minGrade = Math.min(...numbers);
    const maxGrade = Math.max(...numbers);
    return selectedNumber >= minGrade && selectedNumber <= maxGrade;
  }
  return numbers.includes(selectedNumber);
}

function gradesArabicText(text) {
  const original = String(text || '').trim();
  if (!original) return '';
  return original.replace(/KG\s*1|K\s*1|KG\s*2|K\s*2|G\s*\d{1,2}|GRADE\s*\d{1,2}/gi, token => {
    const clean = token.toUpperCase().replace(/\s+/g, '').replace(/^GRADE/, 'G').replace(/^K(\d)/, 'KG$1');
    return gradeArabicLabel(clean);
  }).replace(/\s*-\s*|\s*–\s*|\s*—\s*/g, ' إلى ');
}

function matchesFilters(lc) {
  const gov = governorateFilter.value;
  const selectedCity = cityFilter.value;
  const grade = gradeFilter.value;
  const q = normalizeText(searchBox.value);

  if (gov && governorate(lc) !== gov) return false;
  if (selectedCity && city(lc) !== selectedCity) return false;
  if (grade && !lcCoversGrade(lc, grade)) return false;

  if (q) {
    const haystack = normalizeText(`${displayName(lc)} ${address(lc)} ${governorate(lc)} ${city(lc)} ${grades(lc)}`);
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function visibleLCs() {
  return lcs
    .filter(matchesFilters)
    .sort((a, b) =>
      governorate(a).localeCompare(governorate(b), 'ar') ||
      city(a).localeCompare(city(b), 'ar') ||
      displayName(a).localeCompare(displayName(b), 'ar')
    );
}

function option(value, text) {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = text;
  return opt;
}

function populateGovernorates() {
  governorateFilter.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());

  const governorateOrder = [
    'شمال غزة',
    'شرق غزة',
    'غرب غزة',
    'الوسطى',
    'شرق خانيونس',
    'غرب خانيونس',
    'رفح'
  ];

  governorateOrder.forEach(g => {
    if (lcs.some(lc => governorate(lc) === g)) {
      governorateFilter.appendChild(option(g, g));
    }
  });
}

function populateCities() {
  const selectedGov = governorateFilter.value;
  cityFilter.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());
  const cities = lcs
    .filter(lc => !selectedGov || governorate(lc) === selectedGov)
    .map(city)
    .filter(Boolean);
  [...new Set(cities)]
    .sort((a, b) => a.localeCompare(b, 'ar'))
    .forEach(c => cityFilter.appendChild(option(c, c)));
}

function populateGrades() {
  gradeFilter.querySelectorAll('option.dynamic-grade').forEach(o => o.remove());
  const gradeNumbers = new Set();
  lcs.forEach(lc => extractGradeNumbers(grades(lc)).forEach(n => gradeNumbers.add(n)));

  [...gradeNumbers].sort((a, b) => a - b).forEach(n => {
    const code = numberToGrade(n);
    const opt = option(code, gradeArabicLabel(code));
    opt.classList.add('dynamic-grade');
    gradeFilter.appendChild(opt);
  });
  gradeFilter.value = 'KG_START';
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
    node.querySelector('.lc-name').textContent = displayName(lc);
    node.querySelector('.lc-meta').textContent = `${governorate(lc)} - ${city(lc)}`;
    node.querySelector('.address').textContent = address(lc) ? `العنوان: ${address(lc)}` : 'العنوان غير متوفر';
    node.querySelector('.grades').textContent = grades(lc) ? `الصفوف: ${gradesArabicText(grades(lc))}` : 'الصفوف غير متوفرة';
    node.querySelector('.students').textContent = students(lc) ? `عدد الطلبة: ${students(lc)}` : '';
    const directions = node.querySelector('.directions');
    if (hasCoordinates(lc)) {
      directions.href = googleMapsUrl(lc);
    } else {
      directions.remove();
    }
    results.appendChild(node);
  });
}

function currentFiltersText() {
  return [
    governorateFilter.value ? `المحافظة: ${governorateFilter.value}` : 'كل المحافظات',
    cityFilter.value ? `المدينة: ${cityFilter.value}` : 'كل المدن / المناطق',
    gradeFilter.value === 'KG_START' ? 'الصف الدراسي: البستان والتمهيدي والأول' : (gradeFilter.value ? `الصف الدراسي: ${gradeArabicLabel(gradeFilter.value)}` : 'كل الصفوف'),
    searchBox.value ? `بحث: ${searchBox.value}` : ''
  ].filter(Boolean).join(' | ');
}

function makePdfRows(items) {
  return items.map((lc, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(displayName(lc))}</td>
      <td>${escapeHtml(governorate(lc))}</td>
      <td>${escapeHtml(city(lc))}</td>
      <td>${escapeHtml(address(lc))}</td>
      <td>${escapeHtml(gradesArabicText(grades(lc)))}</td>
    </tr>
  `).join('');
}

function buildPrintArea() {
  const items = visibleLCs();
  const rowsPerFirstPage = 16;
  const rowsPerPage = 22;
  const pages = [];

  pages.push(items.slice(0, rowsPerFirstPage));
  for (let i = rowsPerFirstPage; i < items.length; i += rowsPerPage) {
    pages.push(items.slice(i, i + rowsPerPage));
  }

  const pageHtml = pages.map((pageItems, pageIndex) => `
    <section class="pdf-page">
      ${pageIndex === 0 ? `
        <div class="pdf-header">
          <div class="pdf-title-block">
            <h1>دليل مراكز التعليم في قطاع غزة</h1>
            <p class="pdf-instruction">للوصول إلى الدليل الإلكتروني والبحث عن مراكز أخرى، يرجى مسح رمز QR.</p>
            <p class="pdf-link">tinyurl.com/4fuhmz8b</p>
          </div>
          <div class="pdf-qr-block">
            <img src="qr.jpeg" alt="QR code" class="pdf-qr" />
          </div>
        </div>
        <p class="pdf-filters">${escapeHtml(currentFiltersText())}</p>
        <p class="pdf-count">عدد المراكز: ${items.length}</p>
      ` : `
        <h2 class="pdf-page-title">دليل مراكز التعليم في قطاع غزة</h2>
      `}
      <table>
        <thead>
          <tr><th>#</th><th>المركز</th><th>المحافظة</th><th>المدينة / المنطقة</th><th>العنوان</th><th>الصفوف</th></tr>
        </thead>
        <tbody>${makePdfRows(pageItems)}</tbody>
      </table>
      <div class="pdf-page-number">${pageIndex + 1} / ${pages.length}</div>
    </section>
  `).join('');

  printArea.innerHTML = pageHtml;
}

async function downloadPdf() {
  if (!window.html2canvas || !window.jspdf) {
    statusText.textContent = 'تعذر إنشاء ملف PDF. تأكد من اتصال الإنترنت ثم حاول مرة أخرى.';
    return;
  }

  const oldText = pdfBtn.textContent;
  pdfBtn.disabled = true;
  pdfBtn.textContent = 'جاري إنشاء PDF...';
  statusText.textContent = 'جاري إنشاء ملف PDF...';

  try {
    buildPrintArea();
    printArea.classList.add('rendering-pdf');
    await new Promise(resolve => setTimeout(resolve, 250));

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pages = [...printArea.querySelectorAll('.pdf-page')];

    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    }

    pdf.save('دليل_مراكز_التعليم.pdf');
    statusText.textContent = `تم إنشاء ملف PDF لعدد ${visibleLCs().length} مركز.`;
  } catch (err) {
    console.error(err);
    statusText.textContent = 'حدث خطأ أثناء إنشاء ملف PDF. يرجى المحاولة مرة أخرى.';
  } finally {
    printArea.classList.remove('rendering-pdf');
    pdfBtn.disabled = false;
    pdfBtn.textContent = oldText;
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function clearFilters() {
  governorateFilter.value = '';
  cityFilter.value = '';
  gradeFilter.value = 'KG_START';
  searchBox.value = '';
  populateCities();
  renderResults();
}

async function loadData() {
  const response = await fetch('lcs.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load lcs.json');
  const data = await response.json();
  lcs = data.filter(lc => displayName(lc) && displayName(lc) !== 'مركز تعليم');
  populateGovernorates();
  populateCities();
  populateGrades();
  renderResults();
  statusText.textContent = `تم تحميل ${lcs.length} مركز. القائمة تعرض افتراضياً المراكز التي تبدأ بالبستان أو التمهيدي أو الأول.`;
}

governorateFilter.addEventListener('change', () => {
  cityFilter.value = '';
  populateCities();
  renderResults();
});
[cityFilter, gradeFilter, searchBox].forEach(el => el.addEventListener('input', renderResults));
pdfBtn.addEventListener('click', downloadPdf);
clearBtn.addEventListener('click', clearFilters);

loadData().catch(err => {
  console.error(err);
  statusText.textContent = 'تعذر تحميل بيانات المراكز. تأكد من وجود ملف lcs.json.';
});
