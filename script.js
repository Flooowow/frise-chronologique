// -------------------- Données --------------------
let events = [];
let periods = [];
let artists = [];

let selectedItem = null;          // {id, type}
let selectedTextElement = null;   // { owner, obj, key, element } OU ancien {event,textType,element}

let settings = {
  startYear: -500,
  endYear: 2000,
  scale: 50,              // graduation principale
  minorDivisions: 10,     // petites graduations par intervalle
  timelineY: 300,
  timelineThickness: 40,
  zoom: 1,
  pagesH: 3,
  pagesV: 2,
  bgColor: '#ffffff',
  showGrid: true
};

// Pan & Drag
let isDraggingCanvas = false;
let dragStart = { x: 0, y: 0 };
let viewOffset = { x: 0, y: 0 };

let draggedItem = null;   // { type, item, offsetY / etc. }
let resizingItem = null;  // { type, item, ... }

let editMode = false;

const canvas = document.getElementById('timeline');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');
const eventsContainer = document.getElementById('eventsContainer');

// -------------------- Utils coordonnées --------------------
function getMouseWorldPos(e) {
  const rect = container.getBoundingClientRect();
  const xInContainer = (e.clientX - rect.left) + container.scrollLeft;
  const yInContainer = (e.clientY - rect.top) + container.scrollTop;
  const worldX = (xInContainer - viewOffset.x) / settings.zoom;
  const worldY = (yInContainer - viewOffset.y) / settings.zoom;
  return { x: worldX, y: worldY };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// -------------------- Initialisation --------------------
function init() {
  resizeCanvas();
  setupEventListeners();
  loadFromLocalStorage();

  applyBackgroundToContainer();
  render();
}

function resizeCanvas() {
  const canvasWidth = settings.pagesH * 1400;
  const canvasHeight = settings.pagesV * 800;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  eventsContainer.style.width = canvasWidth + 'px';
  eventsContainer.style.height = canvasHeight + 'px';
}

function setupEventListeners() {
  // Menu
  document.getElementById('toggleMenu').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('closed');
    container.classList.toggle('closed');
    document.getElementById('toggleMenu').textContent = sidebar.classList.contains('closed') ? '▶' : '◀';
  });

  // Settings
  document.getElementById('startYear').addEventListener('change', (e) => { settings.startYear = parseInt(e.target.value); render(); saveToLocalStorageSilent(); });
  document.getElementById('endYear').addEventListener('change', (e) => { settings.endYear = parseInt(e.target.value); render(); saveToLocalStorageSilent(); });
  document.getElementById('scale').addEventListener('change', (e) => { settings.scale = parseInt(e.target.value); render(); saveToLocalStorageSilent(); });

  document.getElementById('timelineY').addEventListener('input', (e) => { settings.timelineY = parseInt(e.target.value); render(); saveToLocalStorageSilent(); });
  document.getElementById('timelineThickness').addEventListener('input', (e) => { settings.timelineThickness = parseInt(e.target.value); render(); saveToLocalStorageSilent(); });

  document.getElementById('zoomLevel').addEventListener('input', (e) => {
    settings.zoom = parseFloat(e.target.value);
    updateViewOffset();
    saveToLocalStorageSilent();
  });

  document.getElementById('pagesH').addEventListener('change', (e) => { settings.pagesH = parseInt(e.target.value); resizeCanvas(); render(); saveToLocalStorageSilent(); });
  document.getElementById('pagesV').addEventListener('change', (e) => { settings.pagesV = parseInt(e.target.value); resizeCanvas(); render(); saveToLocalStorageSilent(); });

  document.getElementById('bgColor').addEventListener('input', (e) => {
    settings.bgColor = e.target.value;
    applyBackgroundToContainer();
    render();
    saveToLocalStorageSilent();
  });

  document.getElementById('showGrid').addEventListener('change', (e) => {
    settings.showGrid = e.target.checked;
    applyBackgroundToContainer();
    render();
    saveToLocalStorageSilent();
  });

  document.getElementById('periodHeight')?.addEventListener('input', (e) => {
    document.getElementById('periodHeightValue').textContent = e.target.value + 'px';
  });

  // Outils texte (événements + périodes + artistes)
  document.getElementById('selectedTextSize').addEventListener('input', (e) => {
    const size = parseInt(e.target.value);
    document.getElementById('selectedTextSizeValue').textContent = size + 'px';

    if (!selectedTextElement) return;

    // ancien format (event)
    if (selectedTextElement.event) {
      const ev = selectedTextElement.event;
      if (selectedTextElement.textType === 'title') ev.customTitleSize = size;
      else ev.customYearSize = size;
      ensureEventCardFitsText(ev);
      render(); saveToLocalStorageSilent();
      return;
    }

    // nouveau format (period/artist)
    const { owner, obj, key } = selectedTextElement;
    if (!obj) return;

    if (owner === 'period') {
      if (key === 'name') obj.nameSize = size;
      else if (key === 'dates') obj.datesSize = size;
    } else if (owner === 'artist') {
      if (key === 'name') obj.nameSize = size;
      else if (key === 'dates') obj.datesSize = size;
      // agrandir la box artiste si texte plus grand
      ensureArtistBoxFitsText(obj);
    }

    render(); saveToLocalStorageSilent();
  });

  document.getElementById('selectedTextBold').addEventListener('change', (e) => {
    const bold = e.target.checked;
    if (!selectedTextElement) return;

    if (selectedTextElement.event) {
      const ev = selectedTextElement.event;
      if (selectedTextElement.textType === 'title') ev.customTitleBold = bold;
      else ev.customYearBold = bold;
      render(); saveToLocalStorageSilent();
      return;
    }

    const { owner, obj, key } = selectedTextElement;
    if (!obj) return;

    if (owner === 'period') {
      if (key === 'name') obj.nameBold = bold;
      else if (key === 'dates') obj.datesBold = bold;
    } else if (owner === 'artist') {
      if (key === 'name') obj.nameBold = bold;
      else if (key === 'dates') obj.datesBold = bold;
    }

    render(); saveToLocalStorageSilent();
  });

  // Canvas pan
  container.addEventListener('mousedown', (e) => {
    // uniquement si on clique sur le fond/canvas (pas sur une carte)
    if (e.target === canvas || e.target === container) {
      isDraggingCanvas = true;
      container.classList.add('grabbing');
      dragStart = { x: e.clientX - viewOffset.x, y: e.clientY - viewOffset.y };

      // désélection texte
      clearSelectedText();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isDraggingCanvas) {
      viewOffset.x = e.clientX - dragStart.x;
      viewOffset.y = e.clientY - dragStart.y;
      updateViewOffset();
      return;
    }
    if (draggedItem) handleDrag(e);
    if (resizingItem) handleResize(e);
  });

  window.addEventListener('mouseup', () => {
    isDraggingCanvas = false;
    container.classList.remove('grabbing');
    draggedItem = null;
    resizingItem = null;
  });

  // Image preview
  document.getElementById('eventImage').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const preview = document.getElementById('eventPreview');
      preview.src = ev.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });
}

function applyBackgroundToContainer() {
  container.style.backgroundColor = settings.bgColor;
  container.classList.toggle('grid', !!settings.showGrid);
}

function updateViewOffset() {
  canvas.style.transform = `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${settings.zoom})`;
  eventsContainer.style.transform = `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${settings.zoom})`;
}

// -------------------- Conversions temps <-> X --------------------
function yearToX(year) {
  const totalYears = settings.endYear - settings.startYear;
  return ((year - settings.startYear) / totalYears) * canvas.width;
}

function xToYear(x) {
  const totalYears = settings.endYear - settings.startYear;
  return Math.round((x / canvas.width) * totalYears + settings.startYear);
}

// -------------------- Render --------------------
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawTimeline();   // frise + graduations (avec petites graduations)

  drawPeriods();    // DOM
  drawArtists();    // DOM
  drawEvents();     // DOM

  updateViewOffset();
}

function drawTimeline() {
  const y = settings.timelineY;
  const thickness = settings.timelineThickness;
  const half = thickness / 2;

  // barre
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, y - half, canvas.width, thickness);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, y - half, canvas.width, thickness);

  // grandes graduations + texte
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#000';
  ctx.lineWidth = 2;
  const fontSize = Math.max(12, Math.min(20, thickness * 0.45));
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let year = settings.startYear; year <= settings.endYear; year += settings.scale) {
    const x = yearToX(year);

    ctx.beginPath();
    ctx.moveTo(x, y - half);
    ctx.lineTo(x, y + half);
    ctx.stroke();

    ctx.fillText(String(year), x, y);
  }

  // petites graduations
  const div = Math.max(2, settings.minorDivisions || 10);
  const minorStep = Math.max(1, Math.round(settings.scale / div));

  ctx.lineWidth = 1;

  for (let year = settings.startYear; year <= settings.endYear; year += minorStep) {
    if ((year - settings.startYear) % settings.scale === 0) continue;
    const x = yearToX(year);

    const tick = thickness * 0.35;

    ctx.beginPath();
    ctx.moveTo(x, y - half);
    ctx.lineTo(x, y - half + tick);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y + half);
    ctx.lineTo(x, y + half - tick);
    ctx.stroke();
  }
}

// -------------------- Sélection texte --------------------
function clearSelectedText() {
  if (selectedTextElement?.element) {
    selectedTextElement.element.classList.remove('selected-text');
  }
  selectedTextElement = null;
  document.getElementById('textStyleTools').style.display = 'none';
}

function selectGenericTextElement(domEl) {
  clearSelectedText();

  const owner = domEl.dataset.owner; // event/period/artist
  const id = parseInt(domEl.dataset.id);
  const key = domEl.dataset.key;     // title/year/name/dates

  let obj = null;
  if (owner === 'event') obj = events.find(x => x.id === id);
  if (owner === 'period') obj = periods.find(x => x.id === id);
  if (owner === 'artist') obj = artists.find(x => x.id === id);

  if (!obj) return;

  selectedTextElement = { owner, obj, key, element: domEl };
  domEl.classList.add('selected-text');
  document.getElementById('textStyleTools').style.display = 'block';

  let size = 12;
  let bold = false;

  if (owner === 'event') {
    if (key === 'title') { size = obj.customTitleSize || 12; bold = obj.customTitleBold ?? false; }
    if (key === 'year')  { size = obj.customYearSize || 10; bold = obj.customYearBold ?? false; }
  }
  if (owner === 'period') {
    if (key === 'name') { size = obj.nameSize || 13; bold = obj.nameBold ?? true; }
    if (key === 'dates'){ size = obj.datesSize || 11; bold = obj.datesBold ?? false; }
  }
  if (owner === 'artist') {
    if (key === 'name') { size = obj.nameSize || 12; bold = obj.nameBold ?? true; }
    if (key === 'dates'){ size = obj.datesSize || 10; bold = obj.datesBold ?? false; }
  }

  document.getElementById('selectedTextSize').value = size;
  document.getElementById('selectedTextSizeValue').textContent = size + 'px';
  document.getElementById('selectedTextBold').checked = bold;
}

// -------------------- Events (DOM) --------------------
function ensureEventCardFitsText(ev) {
  const minImg = 50;
  const pad = 26;

  const titleSize = ev.customTitleSize || 12;
  const yearSize = ev.customYearSize || 10;

  // estimation : titre jusqu'à 2 lignes, année 1 ligne
  const titleH = Math.ceil(titleSize * 1.25 * 2);
  const yearH = Math.ceil(yearSize * 1.25 * 1);

  const minTotal = minImg + titleH + yearH + pad;
  if (ev.height < minTotal) ev.height = minTotal;
  if (ev.width < 80) ev.width = 80;
  if (ev.height < 80) ev.height = 80;
}

function drawEvents() {
  document.querySelectorAll('.event-card').forEach(el => el.remove());
  document.querySelectorAll('.connection-line').forEach(el => el.remove());

  for (const ev of events) {
    ensureEventCardFitsText(ev);

    const x = yearToX(parseInt(ev.year));
    const left = x - ev.width / 2;

    const card = document.createElement('div');
    card.className = 'event-card' + (selectedItem?.type === 'event' && selectedItem?.id === ev.id ? ' selected' : '');
    card.style.left = left + 'px';
    card.style.top = ev.y + 'px';
    card.style.width = ev.width + 'px';
    card.style.height = ev.height + 'px';

    const titleSize = ev.customTitleSize || 12;
    const titleBold = ev.customTitleBold ?? false;
    const yearSize = ev.customYearSize || 10;
    const yearBold = ev.customYearBold ?? false;

    card.innerHTML = `
      <img src="${ev.image}" alt="${escapeHtml(ev.name)}">
      <div class="event-title" data-owner="event" data-id="${ev.id}" data-key="title"
           style="font-size:${titleSize}px; font-weight:${titleBold ? 'bold':'normal'}">${escapeHtml(ev.name)}</div>
      <div class="event-year" data-owner="event" data-id="${ev.id}" data-key="year"
           style="font-size:${yearSize}px; font-weight:${yearBold ? 'bold':'normal'}">${escapeHtml(String(ev.year))}</div>

      <div class="resize-h" title="Redimensionner largeur"></div>
      <div class="resize-v" title="Redimensionner hauteur"></div>
      <div class="resize-corner" title="Redimensionner proportionnel"></div>
    `;

    // sélection item
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      selectItem(ev, 'event');
    });

    // drag vertical
    card.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('resize-h') ||
          e.target.classList.contains('resize-v') ||
          e.target.classList.contains('resize-corner')) return;

      // si clique sur texte -> pas drag carte
      if (e.target.classList.contains('event-title') || e.target.classList.contains('event-year')) return;

      const m = getMouseWorldPos(e);
      draggedItem = { type: 'event', item: ev, offsetY: m.y - ev.y };
    });

    // sélection texte
    card.querySelectorAll('[data-owner="event"]').forEach(el => {
      el.addEventListener('click', (e) => { e.stopPropagation(); selectGenericTextElement(el); });
    });

    // resize largeur
    card.querySelector('.resize-h').addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const m = getMouseWorldPos(e);
      resizingItem = { type: 'eventW', item: ev, startX: m.x, startW: ev.width };
    });

    // resize hauteur
    card.querySelector('.resize-v').addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const m = getMouseWorldPos(e);
      resizingItem = { type: 'eventH', item: ev, startY: m.y, startH: ev.height };
    });

    // resize proportionnel
    card.querySelector('.resize-corner').addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const m = getMouseWorldPos(e);
      resizingItem = { type: 'eventP', item: ev, startX: m.x, startY: m.y, startW: ev.width, startH: ev.height };
    });

    // ligne vers frise
    const line = document.createElement('div');
    line.className = 'connection-line';

    const half = settings.timelineThickness / 2;
    const topTimeline = settings.timelineY - half;
    const bottomTimeline = settings.timelineY + half;

    const evBottom = ev.y + ev.height;
    const evAbove = evBottom < topTimeline;

    let lineTop = 0;
    let lineHeight = 0;

    if (evAbove) {
      lineTop = evBottom;
      lineHeight = topTimeline - evBottom;
    } else {
      lineTop = bottomTimeline;
      lineHeight = ev.y - bottomTimeline;
    }

    if (lineHeight > 0) {
      line.style.left = x + 'px';
      line.style.top = lineTop + 'px';
      line.style.height = lineHeight + 'px';
      eventsContainer.appendChild(line);
    }

    eventsContainer.appendChild(card);
  }
}

// -------------------- Periods (DOM) --------------------
function drawPeriods() {
  document.querySelectorAll('.period-bar').forEach(el => el.remove());

  for (const p of periods) {
    const startX = yearToX(parseInt(p.startYear));
    const endX = yearToX(parseInt(p.endYear));
    const width = endX - startX;

    const div = document.createElement('div');
    div.className = 'period-bar' + (selectedItem?.type === 'period' && selectedItem?.id === p.id ? ' selected' : '');
    div.style.left = startX + 'px';
    div.style.top = p.y + 'px';
    div.style.width = width + 'px';
    div.style.height = (p.height || 40) + 'px';
    div.style.background = p.color || '#4299e1';

    const nameSize = p.nameSize || 13;
    const datesSize = p.datesSize || 11;
    const nameBold = p.nameBold ?? true;
    const datesBold = p.datesBold ?? false;

    div.innerHTML = `
      <div class="period-name" data-owner="period" data-id="${p.id}" data-key="name"
           style="font-size:${nameSize}px; font-weight:${nameBold ? 'bold':'normal'}">${escapeHtml(p.name)}</div>
      <div class="period-dates" data-owner="period" data-id="${p.id}" data-key="dates"
           style="font-size:${datesSize}px; font-weight:${datesBold ? 'bold':'normal'}">${escapeHtml(p.startYear)} - ${escapeHtml(p.endYear)}</div>
    `;

    div.addEventListener('click', (e) => { e.stopPropagation(); selectItem(p, 'period'); });

    // drag vertical période
    div.addEventListener('mousedown', (e) => {
      // si clic sur texte : pas drag barre (on laisse le texte sélectionnable)
      if (e.target.dataset && e.target.dataset.owner === 'period') return;
      const m = getMouseWorldPos(e);
      draggedItem = { type: 'period', item: p, offsetY: m.y - p.y };
    });

    // sélection texte
    div.querySelectorAll('[data-owner="period"]').forEach(el => {
      el.addEventListener('click', (e) => { e.stopPropagation(); selectGenericTextElement(el); });
    });

    eventsContainer.appendChild(div);
  }
}

// -------------------- Artists (rectangle) --------------------
function ensureArtistBoxFitsText(a) {
  const pad = 18;
  const nameSize = a.nameSize || 12;
  const datesSize = a.datesSize || 10;

  const nameH = Math.ceil(nameSize * 1.2 * 2);  // jusqu'à 2 lignes
  const datesH = Math.ceil(datesSize * 1.2 * 1);

  const minH = pad + nameH + datesH;
  a.height = Math.max(a.height || 36, minH, 28);
}

function drawArtists() {
  document.querySelectorAll('.artist-box').forEach(el => el.remove());

  for (const a of artists) {
    ensureArtistBoxFitsText(a);

    const birthX = yearToX(parseInt(a.birthYear));
    const deathX = yearToX(parseInt(a.deathYear));
    const width = Math.max(80, deathX - birthX); // min visuel

    const div = document.createElement('div');
    div.className = 'artist-box' + (selectedItem?.type === 'artist' && selectedItem?.id === a.id ? ' selected' : '');
    div.style.left = birthX + 'px';
    div.style.top = a.y + 'px';
    div.style.width = width + 'px';
    div.style.height = a.height + 'px';

    const nameSize = a.nameSize || 12;
    const datesSize = a.datesSize || 10;
    const nameBold = a.nameBold ?? true;
    const datesBold = a.datesBold ?? false;

    div.innerHTML = `
      <div class="artist-name" data-owner="artist" data-id="${a.id}" data-key="name"
           style="font-size:${nameSize}px; font-weight:${nameBold ? 'bold':'normal'}">${escapeHtml(a.name)}</div>
      <div class="artist-dates" data-owner="artist" data-id="${a.id}" data-key="dates"
           style="font-size:${datesSize}px; font-weight:${datesBold ? 'bold':'normal'}">${escapeHtml(a.birthYear)} à ${escapeHtml(a.deathYear)}</div>

      <div class="artist-resize-left" title="Ajuster année début"></div>
      <div class="artist-resize-right" title="Ajuster année fin"></div>
      <div class="artist-resize-bottom" title="Ajuster hauteur"></div>
      <div class="artist-resize-corner" title="Proportionnel"></div>
    `;

    // sélection item
    div.addEventListener('click', (e) => { e.stopPropagation(); selectItem(a, 'artist'); });

    // drag vertical (boîte)
    div.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('artist-resize-left') ||
          e.target.classList.contains('artist-resize-right') ||
          e.target.classList.contains('artist-resize-bottom') ||
          e.target.classList.contains('artist-resize-corner')) return;

      // si on clique sur texte : pas drag boîte
      if (e.target.dataset && e.target.dataset.owner === 'artist') return;

      const m = getMouseWorldPos(e);
      draggedItem = { type: 'artist', item: a, offsetY: m.y - a.y };
    });

    // sélection texte artiste
    div.querySelectorAll('[data-owner="artist"]').forEach(el => {
      el.addEventListener('click', (e) => { e.stopPropagation(); selectGenericTextElement(el); });
    });

    // resize années (gauche/droite)
    div.querySelector('.artist-resize-left').addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const m = getMouseWorldPos(e);
      resizingItem = { type: 'artistLeft', item: a, startX: m.x, startBirth: parseInt(a.birthYear), startDeath: parseInt(a.deathYear) };
    });
    div.querySelector('.artist-resize-right').addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const m = getMouseWorldPos(e);
      resizingItem = { type: 'artistRight', item: a, startX: m.x, startBirth: parseInt(a.birthYear), startDeath: parseInt(a.deathYear) };
    });

    // resize hauteur
    div.querySelector('.artist-resize-bottom').addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const m = getMouseWorldPos(e);
      resizingItem = { type: 'artistH', item: a, startY: m.y, startH: a.height };
    });

    // resize proportionnel (largeur -> années + hauteur)
    div.querySelector('.artist-resize-corner').addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const m = getMouseWorldPos(e);
      resizingItem = {
        type: 'artistP',
        item: a,
        startX: m.x,
        startY: m.y,
        startBirth: parseInt(a.birthYear),
        startDeath: parseInt(a.deathYear),
        startH: a.height
      };
    });

    eventsContainer.appendChild(div);
  }
}

// -------------------- Drag / Resize handlers --------------------
function handleDrag(e) {
  const m = getMouseWorldPos(e);

  if (draggedItem.type === 'event') {
    const ev = draggedItem.item;
    ev.y = clamp(m.y - draggedItem.offsetY, 0, canvas.height - ev.height);
    render(); saveToLocalStorageSilent();
    return;
  }

  if (draggedItem.type === 'period') {
    const p = draggedItem.item;
    const h = p.height || 40;
    p.y = clamp(m.y - draggedItem.offsetY, 0, canvas.height - h);
    render(); saveToLocalStorageSilent();
    return;
  }

  if (draggedItem.type === 'artist') {
    const a = draggedItem.item;
    a.y = clamp(m.y - draggedItem.offsetY, 0, canvas.height - (a.height || 36));
    render(); saveToLocalStorageSilent();
    return;
  }
}

function handleResize(e) {
  const m = getMouseWorldPos(e);

  // Events
  if (resizingItem.type === 'eventW') {
    const ev = resizingItem.item;
    const dx = m.x - resizingItem.startX;
    ev.width = clamp(resizingItem.startW + dx, 80, 800);
    ensureEventCardFitsText(ev);
    render(); saveToLocalStorageSilent();
    return;
  }
  if (resizingItem.type === 'eventH') {
    const ev = resizingItem.item;
    const dy = m.y - resizingItem.startY;
    ev.height = clamp(resizingItem.startH + dy, 80, 900);
    ensureEventCardFitsText(ev);
    render(); saveToLocalStorageSilent();
    return;
  }
  if (resizingItem.type === 'eventP') {
    const ev = resizingItem.item;
    const dx = m.x - resizingItem.startX;
    const dy = m.y - resizingItem.startY;
    const d = Math.max(dx, dy);
    ev.width = clamp(resizingItem.startW + d, 80, 800);
    ev.height = clamp(resizingItem.startH + d, 80, 900);
    ensureEventCardFitsText(ev);
    render(); saveToLocalStorageSilent();
    return;
  }

  // Artists (années + hauteur)
  if (resizingItem.type === 'artistLeft') {
    const a = resizingItem.item;
    const deltaYears = xToYear(yearToX(resizingItem.startBirth) + (m.x - resizingItem.startX)) - resizingItem.startBirth;
    let newBirth = resizingItem.startBirth + deltaYears;
    newBirth = clamp(newBirth, settings.startYear, resizingItem.startDeath - 1);
    a.birthYear = String(newBirth);
    render(); saveToLocalStorageSilent();
    return;
  }

  if (resizingItem.type === 'artistRight') {
    const a = resizingItem.item;
    const deltaYears = xToYear(yearToX(resizingItem.startDeath) + (m.x - resizingItem.startX)) - resizingItem.startDeath;
    let newDeath = resizingItem.startDeath + deltaYears;
    newDeath = clamp(newDeath, resizingItem.startBirth + 1, settings.endYear);
    a.deathYear = String(newDeath);
    render(); saveToLocalStorageSilent();
    return;
  }

  if (resizingItem.type === 'artistH') {
    const a = resizingItem.item;
    const dy = m.y - resizingItem.startY;
    a.height = clamp(resizingItem.startH + dy, 28, 300);
    ensureArtistBoxFitsText(a);
    render(); saveToLocalStorageSilent();
    return;
  }

  if (resizingItem.type === 'artistP') {
    const a = resizingItem.item;

    const dx = m.x - resizingItem.startX;
    const dy = m.y - resizingItem.startY;
    const d = Math.max(dx, dy);

    // proportionnel : on allonge la durée (droite) + hauteur
    const startBirth = resizingItem.startBirth;
    const startDeath = resizingItem.startDeath;
    const startDur = startDeath - startBirth;

    // convert d (pixels) -> années
    const yearAtPx = xToYear(yearToX(startDeath) + d);
    let newDeath = clamp(yearAtPx, startBirth + 1, settings.endYear);

    // garder au moins 1 an
    if (newDeath <= startBirth) newDeath = startBirth + 1;

    a.deathYear = String(newDeath);

    a.height = clamp(resizingItem.startH + d, 28, 300);
    ensureArtistBoxFitsText(a);

    render(); saveToLocalStorageSilent();
    return;
  }
}

// -------------------- Sélection item + actions --------------------
function selectItem(item, type) {
  selectedItem = { id: item.id, type };
  document.getElementById('selectedItemActions').style.display = 'block';
  render();
}

function editSelectedItem() {
  if (!selectedItem) return;
  editMode = true;

  if (selectedItem.type === 'event') {
    const ev = events.find(x => x.id === selectedItem.id);
    if (!ev) return;

    document.getElementById('eventModalTitle').textContent = "Modifier l'événement";
    document.getElementById('eventName').value = ev.name;
    document.getElementById('eventYear').value = ev.year;
    document.getElementById('eventPreview').src = ev.image;
    document.getElementById('eventPreview').style.display = 'block';
    document.getElementById('eventModal').classList.add('show');
    return;
  }

  if (selectedItem.type === 'period') {
    const p = periods.find(x => x.id === selectedItem.id);
    if (!p) return;

    document.getElementById('periodModalTitle').textContent = "Modifier la période";
    document.getElementById('periodName').value = p.name;
    document.getElementById('periodStart').value = p.startYear;
    document.getElementById('periodEnd').value = p.endYear;
    document.getElementById('periodColor').value = p.color || '#4299e1';
    document.getElementById('periodHeight').value = p.height || 40;
    document.getElementById('periodHeightValue').textContent = (p.height || 40) + 'px';
    document.getElementById('periodModal').classList.add('show');
    return;
  }

  if (selectedItem.type === 'artist') {
    const a = artists.find(x => x.id === selectedItem.id);
    if (!a) return;

    document.getElementById('artistModalTitle').textContent = "Modifier l'artiste";
    document.getElementById('artistName').value = a.name;
    document.getElementById('artistBirth').value = a.birthYear;
    document.getElementById('artistDeath').value = a.deathYear;
    document.getElementById('artistModal').classList.add('show');
    return;
  }
}

function deleteSelectedItem() {
  if (!selectedItem) return;

  if (selectedItem.type === 'event') events = events.filter(x => x.id !== selectedItem.id);
  if (selectedItem.type === 'period') periods = periods.filter(x => x.id !== selectedItem.id);
  if (selectedItem.type === 'artist') artists = artists.filter(x => x.id !== selectedItem.id);

  selectedItem = null;
  document.getElementById('selectedItemActions').style.display = 'none';
  clearSelectedText();
  render();
  saveToLocalStorageSilent();
}

// -------------------- Modals --------------------
function showEventModal() {
  document.getElementById('eventModal').classList.add('show');
  editMode = false;
  document.getElementById('eventModalTitle').textContent = 'Ajouter un événement';
  document.getElementById('eventName').value = '';
  document.getElementById('eventYear').value = '';
  document.getElementById('eventImage').value = '';
  document.getElementById('eventPreview').style.display = 'none';
}

function showPeriodModal() {
  document.getElementById('periodModal').classList.add('show');
  editMode = false;
  document.getElementById('periodModalTitle').textContent = 'Ajouter une période';
  document.getElementById('periodName').value = '';
  document.getElementById('periodStart').value = '';
  document.getElementById('periodEnd').value = '';
  document.getElementById('periodColor').value = '#4299e1';
  document.getElementById('periodHeight').value = '40';
  document.getElementById('periodHeightValue').textContent = '40px';
}

function showArtistModal() {
  document.getElementById('artistModal').classList.add('show');
  editMode = false;
  document.getElementById('artistModalTitle').textContent = 'Ajouter un artiste';
  document.getElementById('artistName').value = '';
  document.getElementById('artistBirth').value = '';
  document.getElementById('artistDeath').value = '';
}

function closeModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
}

function saveEvent() {
  const name = document.getElementById('eventName').value.trim();
  const year = document.getElementById('eventYear').value.trim();
  const img = document.getElementById('eventPreview').src;

  if (!name || !year || !img || img === window.location.href) {
    alert('Veuillez remplir tous les champs');
    return;
  }

  if (editMode && selectedItem?.type === 'event') {
    const ev = events.find(x => x.id === selectedItem.id);
    if (ev) {
      ev.name = name;
      ev.year = year;
      ev.image = img;
      ensureEventCardFitsText(ev);
    }
  } else {
    const ev = {
      id: Date.now(),
      name,
      year,
      image: img,
      y: 100,
      width: 140,
      height: 160,
      customTitleSize: 12,
      customYearSize: 10
    };
    ensureEventCardFitsText(ev);
    events.push(ev);
  }

  closeModals();
  render();
  saveToLocalStorageSilent();
}

function savePeriod() {
  const name = document.getElementById('periodName').value.trim();
  const startYear = document.getElementById('periodStart').value.trim();
  const endYear = document.getElementById('periodEnd').value.trim();
  const color = document.getElementById('periodColor').value;
  const height = parseInt(document.getElementById('periodHeight').value, 10);

  if (!name || !startYear || !endYear) {
    alert('Veuillez remplir tous les champs');
    return;
  }

  if (editMode && selectedItem?.type === 'period') {
    const p = periods.find(x => x.id === selectedItem.id);
    if (p) {
      p.name = name;
      p.startYear = startYear;
      p.endYear = endYear;
      p.color = color;
      p.height = height;
    }
  } else {
    periods.push({
      id: Date.now(),
      name,
      startYear,
      endYear,
      color,
      y: 50,
      height: height,
      nameSize: 13,
      datesSize: 11,
      nameBold: true,
      datesBold: false
    });
  }

  closeModals();
  render();
  saveToLocalStorageSilent();
}

function saveArtist() {
  const name = document.getElementById('artistName').value.trim();
  const birthYear = document.getElementById('artistBirth').value.trim();
  const deathYear = document.getElementById('artistDeath').value.trim();

  if (!name || !birthYear || !deathYear) {
    alert('Veuillez remplir tous les champs');
    return;
  }

  if (editMode && selectedItem?.type === 'artist') {
    const a = artists.find(x => x.id === selectedItem.id);
    if (a) {
      a.name = name;
      a.birthYear = birthYear;
      a.deathYear = deathYear;
      ensureArtistBoxFitsText(a);
    }
  } else {
    const a = {
      id: Date.now(),
      name,
      birthYear,
      deathYear,
      y: settings.timelineY - 120,
      height: 44,
      nameSize: 12,
      datesSize: 10,
      nameBold: true,
      datesBold: false
    };
    ensureArtistBoxFitsText(a);
    artists.push(a);
  }

  closeModals();
  render();
  saveToLocalStorageSilent();
}

// -------------------- Actions utilitaires --------------------
function centerOnYearZero() {
  const zeroX = yearToX(0);
  viewOffset.x = (window.innerWidth / 2) - zeroX;
  viewOffset.y = 0;
  updateViewOffset();
}

function applyBackgroundColor() {
  settings.bgColor = document.getElementById('bgColor').value;
  applyBackgroundToContainer();
  render();
  saveToLocalStorageSilent();
}

// -------------------- Sauvegarde fichier --------------------
function saveToFile() {
  try {
    const data = { events, periods, artists, settings, version: '2.0' };
    const str = JSON.stringify(data, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `frise-chronologique-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (err) {
    alert('Erreur sauvegarde : ' + err.message);
  }
}

function loadFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      events = data.events || [];
      periods = data.periods || [];
      artists = data.artists || [];

      if (data.settings) settings = { ...settings, ...data.settings };

      // sync UI
      document.getElementById('startYear').value = settings.startYear;
      document.getElementById('endYear').value = settings.endYear;
      document.getElementById('scale').value = settings.scale;
      document.getElementById('timelineY').value = settings.timelineY;
      document.getElementById('timelineThickness').value = settings.timelineThickness;
      document.getElementById('zoomLevel').value = settings.zoom;
      document.getElementById('pagesH').value = settings.pagesH;
      document.getElementById('pagesV').value = settings.pagesV;
      document.getElementById('bgColor').value = settings.bgColor;
      document.getElementById('showGrid').checked = !!settings.showGrid;

      resizeCanvas();
      applyBackgroundToContainer();
      render();
      saveToLocalStorageSilent();
    } catch (err) {
      alert('Erreur chargement : ' + err.message);
    }
  };
  reader.readAsText(file);

  event.target.value = '';
}

// -------------------- localStorage --------------------
function saveToLocalStorage() {
  localStorage.setItem('timelineData', JSON.stringify({ events, periods, artists, settings }));
  alert('Sauvegarde réussie dans le navigateur.');
}

function saveToLocalStorageSilent() {
  try {
    localStorage.setItem('timelineData', JSON.stringify({ events, periods, artists, settings }));
  } catch (e) {
    // silencieux
  }
}

function loadFromLocalStorage() {
  const raw = localStorage.getItem('timelineData');
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    events = parsed.events || [];
    periods = parsed.periods || [];
    artists = parsed.artists || [];
    if (parsed.settings) settings = { ...settings, ...parsed.settings };

    document.getElementById('startYear').value = settings.startYear;
    document.getElementById('endYear').value = settings.endYear;
    document.getElementById('scale').value = settings.scale;
    document.getElementById('timelineY').value = settings.timelineY;
    document.getElementById('timelineThickness').value = settings.timelineThickness;
    document.getElementById('zoomLevel').value = settings.zoom;
    document.getElementById('pagesH').value = settings.pagesH;
    document.getElementById('pagesV').value = settings.pagesV;
    document.getElementById('bgColor').value = settings.bgColor;
    document.getElementById('showGrid').checked = !!settings.showGrid;

    resizeCanvas();
    applyBackgroundToContainer();
    render();
  } catch (e) {
    // silencieux
  }
}

// -------------------- Sécurité HTML --------------------
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// -------------------- Démarrage --------------------
window.addEventListener('load', init);
window.addEventListener('resize', () => { resizeCanvas(); render(); });
