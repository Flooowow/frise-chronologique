// ==================== DONNÉES ====================
let events = [];
let periods = [];
let artists = [];
let selectedItem = null;
let selectedTextElement = null;

let settings = {
  startYear: -500,
  endYear: 2000,
  scale: 50,
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
let draggedItem = null;
let resizingItem = null;
let editMode = false;

const canvas = document.getElementById('timeline');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');
const eventsContainer = document.getElementById('eventsContainer');

// ==================== UTILS ====================
function getMouseWorldPos(e) {
  const rect = container.getBoundingClientRect();
  const xInContainer = (e.clientX - rect.left) + container.scrollLeft;
  const yInContainer = (e.clientY - rect.top) + container.scrollTop;
  return {
    x: (xInContainer - viewOffset.x) / settings.zoom,
    y: (yInContainer - viewOffset.y) / settings.zoom
  };
}

function yearToX(year) {
  const totalYears = settings.endYear - settings.startYear;
  return ((year - settings.startYear) / totalYears) * canvas.width;
}

function xToYear(x) {
  const totalYears = settings.endYear - settings.startYear;
  return Math.round((x / canvas.width) * totalYears + settings.startYear);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ==================== INIT ====================
function init() {
  resizeCanvas();
  setupEventListeners();
  loadFromLocalStorage();
  applyBackgroundToContainer();
  render();
}

function resizeCanvas() {
  canvas.width = settings.pagesH * 1400;
  canvas.height = settings.pagesV * 800;
  eventsContainer.style.width = canvas.width + 'px';
  eventsContainer.style.height = canvas.height + 'px';
}

function setupEventListeners() {
  // Menu toggle
  document.getElementById('toggleMenu').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('closed');
    container.classList.toggle('closed');
const toggleBtn = document.getElementById('toggleMenu');
toggleBtn.textContent = sidebar.classList.contains('closed') ? '▶' : '◀';
toggleBtn.style.left = sidebar.classList.contains('closed') ? '0' : 'auto';
  });

  // Settings
  const updateSetting = (id, key, parser = parseInt) => {
    document.getElementById(id).addEventListener('change', (e) => {
      settings[key] = parser(e.target.value);
      if (id.includes('pages')) resizeCanvas();
      render();
      saveToLocalStorageSilent();
    });
  };

  updateSetting('startYear', 'startYear');
  updateSetting('endYear', 'endYear');
  updateSetting('scale', 'scale');
  updateSetting('pagesH', 'pagesH');
  updateSetting('pagesV', 'pagesV');

  document.getElementById('timelineY').addEventListener('input', (e) => {
    settings.timelineY = parseInt(e.target.value);
    render();
    saveToLocalStorageSilent();
  });

  document.getElementById('timelineThickness').addEventListener('input', (e) => {
    settings.timelineThickness = parseInt(e.target.value);
    render();
    saveToLocalStorageSilent();
  });

  document.getElementById('zoomLevel').addEventListener('input', (e) => {
    settings.zoom = parseFloat(e.target.value);
    updateViewOffset();
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

  // Text tools
  document.getElementById('selectedTextSize').addEventListener('input', (e) => {
    const size = parseInt(e.target.value);
    document.getElementById('selectedTextSizeValue').textContent = size + 'px';
    if (!selectedTextElement) return;

    const { owner, obj, key } = selectedTextElement;
    if (owner === 'event') {
      if (key === 'title') obj.customTitleSize = size;
      else obj.customYearSize = size;
    } else if (owner === 'period') {
      if (key === 'name') obj.nameSize = size;
      else obj.datesSize = size;
    } else if (owner === 'artist') {
      if (key === 'name') obj.nameSize = size;
      else obj.datesSize = size;
    }
    render();
    saveToLocalStorageSilent();
  });

  document.getElementById('selectedTextBold').addEventListener('change', (e) => {
    const bold = e.target.checked;
    if (!selectedTextElement) return;

    const { owner, obj, key } = selectedTextElement;
    if (owner === 'event') {
      if (key === 'title') obj.customTitleBold = bold;
      else obj.customYearBold = bold;
    } else if (owner === 'period') {
      if (key === 'name') obj.nameBold = bold;
      else obj.datesBold = bold;
    } else if (owner === 'artist') {
      if (key === 'name') obj.nameBold = bold;
      else obj.datesBold = bold;
    }
    render();
    saveToLocalStorageSilent();
  });

  // Canvas interactions
  container.addEventListener('mousedown', (e) => {
    if (e.target === canvas || e.target === container) {
      isDraggingCanvas = true;
      container.classList.add('grabbing');
      dragStart = { x: e.clientX - viewOffset.x, y: e.clientY - viewOffset.y };
      clearSelectedText();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isDraggingCanvas) {
      viewOffset.x = e.clientX - dragStart.x;
      viewOffset.y = e.clientY - dragStart.y;
      updateViewOffset();
    } else if (draggedItem) {
      handleDrag(e);
    } else if (resizingItem) {
      handleResize(e);
    }
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
  if (settings.showGrid) {
    container.style.backgroundImage = 'linear-gradient(to right, #d0d0d0 1px, transparent 1px), linear-gradient(to bottom, #d0d0d0 1px, transparent 1px)';
    container.style.backgroundSize = '37.8px 37.8px';
  } else {
    container.style.backgroundImage = 'none';
  }
}

function updateViewOffset() {
  canvas.style.transform = `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${settings.zoom})`;
  eventsContainer.style.transform = `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${settings.zoom})`;
}

// ==================== RENDER ====================
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTimeline();
  drawPeriods();
  drawArtists();
  drawEvents();
  updateViewOffset();
}

function drawTimeline() {
  const y = settings.timelineY;
  const half = settings.timelineThickness / 2;

  // Barre principale
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, y - half, canvas.width, settings.timelineThickness);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 5;
  ctx.strokeRect(0, y - half, canvas.width, settings.timelineThickness);

  // Graduations
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.fillStyle = '#000000';
  const fontSize = Math.max(14, Math.min(22, settings.timelineThickness * 0.45));
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let year = settings.startYear; year <= settings.endYear; year += settings.scale) {
    const x = yearToX(year);
    ctx.beginPath();
    ctx.moveTo(x, y - half);
    ctx.lineTo(x, y + half);
    ctx.stroke();
    ctx.fillText(year.toString(), x, y);
  }
}

// ==================== EVENTS ====================
function drawEvents() {
  document.querySelectorAll('.event-card, .connection-line').forEach(el => el.remove());

  events.forEach(ev => {
    const x = yearToX(parseInt(ev.year));
    const card = document.createElement('div');
    card.className = 'event-card' + (selectedItem?.type === 'event' && selectedItem?.id === ev.id ? ' selected' : '');
    card.style.left = (x - ev.width / 2) + 'px';
    card.style.top = ev.y + 'px';
    card.style.width = ev.width + 'px';
    card.style.height = ev.height + 'px';

    const titleSize = ev.customTitleSize || 12;
    const titleBold = ev.customTitleBold ? 'bold' : 'normal';
    const yearSize = ev.customYearSize || 10;
    const yearBold = ev.customYearBold ? 'bold' : 'normal';

    card.innerHTML = `
      <img src="${ev.image}" alt="${escapeHtml(ev.name)}">
      <div class="event-title" data-owner="event" data-id="${ev.id}" data-key="title"
           style="font-size:${titleSize}px; font-weight:${titleBold}">${escapeHtml(ev.name)}</div>
      <div class="event-year" data-owner="event" data-id="${ev.id}" data-key="year"
           style="font-size:${yearSize}px; font-weight:${yearBold}">${escapeHtml(String(ev.year))}</div>
      <div class="resize-corner"></div>
    `;

    // Ligne de connexion
    const half = settings.timelineThickness / 2;
    const timelineTop = settings.timelineY - half;
    const timelineBottom = settings.timelineY + half;
    const eventBottom = ev.y + ev.height;

    if (eventBottom < timelineTop) {
      // Au-dessus
      const line = document.createElement('div');
      line.className = 'connection-line';
      line.style.left = x + 'px';
      line.style.top = eventBottom + 'px';
      line.style.height = (timelineTop - eventBottom) + 'px';
      eventsContainer.appendChild(line);
    } else if (ev.y > timelineBottom) {
      // En-dessous
      const line = document.createElement('div');
      line.className = 'connection-line';
      line.style.left = x + 'px';
      line.style.top = timelineBottom + 'px';
      line.style.height = (ev.y - timelineBottom) + 'px';
      eventsContainer.appendChild(line);
    }

    // Event listeners
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      selectItem(ev, 'event');
    });

    card.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('resize-corner')) return;
      if (e.target.dataset.owner === 'event') return;
      const m = getMouseWorldPos(e);
      draggedItem = { type: 'event', item: ev, offsetY: m.y - ev.y };
    div.innerHTML = `
      <div class="artist-marker" style="left: 0;"></div>
      <div class="artist-marker" style="left: ${width - 10}px;"></div>
      <div class="artist-name" data-owner="artist" data-id="${a.id}" data-key="name"
           style="font-size:${nameSize}px; font-weight:${nameBold ? 'bold':'normal'}; white-space: nowrap;">${escapeHtml(a.name)}</div>
      <div class="artist-dates" data-owner="artist" data-id="${a.id}" data-key="dates"
           style="font-size:${datesSize}px; font-weight:${datesBold ? 'bold':'normal'}; white-space: nowrap;">${escapeHtml(a.birthYear)} à ${escapeHtml(a.deathYear)}</div>
    `;
      e.stopPropagation();
      const m = getMouseWorldPos(e);
      resizingItem = { type: 'eventP', item: ev, startX: m.x, startY: m.y, startW: ev.width, startH: ev.height };
    });

    eventsContainer.appendChild(card);
  });
}

// ==================== PERIODS ====================
function drawPeriods() {
  document.querySelectorAll('.period-bar').forEach(el => el.remove());

  periods.forEach(p => {
    const startX = yearToX(parseInt(p.startYear));
    const endX = yearToX(parseInt(p.endYear));
    const div = document.createElement('div');
    div.className = 'period-bar' + (selectedItem?.type === 'period' && selectedItem?.id === p.id ? ' selected' : '');
    div.style.left = startX + 'px';
    div.style.top = p.y + 'px';
    div.style.width = (endX - startX) + 'px';
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

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      selectItem(p, 'period');
    });

    div.addEventListener('mousedown', (e) => {
      if (e.target.dataset?.owner === 'period') return;
      const m = getMouseWorldPos(e);
      draggedItem = { type: 'period', item: p, offsetY: m.y - p.y };
    });

    div.querySelectorAll('[data-owner="period"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectTextElement(el);
      });
    });

    eventsContainer.appendChild(div);
  });
}

// ==================== ARTISTS ====================
function drawArtists() {
  document.querySelectorAll('.artist-line').forEach(el => el.remove());

  artists.forEach(a => {
    const birthX = yearToX(parseInt(a.birthYear));
    const deathX = yearToX(parseInt(a.deathYear));
    const width = deathX - birthX;
    const div = document.createElement('div');
    div.className = 'artist-line' + (selectedItem?.type === 'artist' && selectedItem?.id === a.id ? ' selected' : '');
    div.style.left = birthX + 'px';
    div.style.top = a.y + 'px';
    div.style.width = width + 'px';

    const nameSize = a.nameSize || 12;
    const datesSize = a.datesSize || 10;
    const nameBold = a.nameBold ?? true;
    const datesBold = a.datesBold ?? false;

    div.innerHTML = `
      div.innerHTML = `
  <div class="artist-marker" style="left: 0;"></div>
  <div class="artist-marker" style="left: ${width - 10}px;"></div>
  <div class="artist-name" data-owner="artist" data-id="${a.id}" data-key="name"
       style="font-size:${nameSize}px; font-weight:${nameBold ? 'bold':'normal'}; white-space: nowrap;">${escapeHtml(a.name)}</div>
  <div class="artist-dates" data-owner="artist" data-id="${a.id}" data-key="dates"
       style="font-size:${datesSize}px; font-weight:${datesBold ? 'bold':'normal'}; white-space: nowrap;">${escapeHtml(a.birthYear)} à ${escapeHtml(a.deathYear)}</div>
`;

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      selectItem(a, 'artist');
    });

    div.addEventListener('mousedown', (e) => {
      if (e.target.dataset?.owner === 'artist') return;
      const m = getMouseWorldPos(e);
      draggedItem = { type: 'artist', item: a, offsetY: m.y - a.y };
    });

    div.querySelectorAll('[data-owner="artist"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectTextElement(el);
      });
    });

    eventsContainer.appendChild(div);
  });
}

// ==================== DRAG & RESIZE ====================
function handleDrag(e) {
  const m = getMouseWorldPos(e);
  const item = draggedItem.item;
  
  // PAS DE LIMITE - déplacement vertical illimité !
  item.y = m.y - draggedItem.offsetY;
  
  render();
  saveToLocalStorageSilent();
}

function handleResize(e) {
  const m = getMouseWorldPos(e);

  if (resizingItem.type === 'eventP') {
    const ev = resizingItem.item;
    const dx = m.x - resizingItem.startX;
    const dy = m.y - resizingItem.startY;
    const d = Math.max(dx, dy);
    ev.width = Math.max(80, resizingItem.startW + d);
    ev.height = Math.max(80, resizingItem.startH + d);
    render();
    saveToLocalStorageSilent();
  }
}

// ==================== SELECTION ====================
function selectItem(item, type) {
  selectedItem = { id: item.id, type };
  document.getElementById('selectedItemActions').style.display = 'block';
  render();
}

function clearSelectedText() {
  if (selectedTextElement?.element) {
    selectedTextElement.element.classList.remove('selected-text');
  }
  selectedTextElement = null;
  document.getElementById('textStyleTools').style.display = 'none';
}

function selectTextElement(domEl) {
  clearSelectedText();

  const owner = domEl.dataset.owner;
  const id = parseInt(domEl.dataset.id);
  const key = domEl.dataset.key;

  let obj = null;
  if (owner === 'event') obj = events.find(x => x.id === id);
  if (owner === 'period') obj = periods.find(x => x.id === id);
  if (owner === 'artist') obj = artists.find(x => x.id === id);
  if (!obj) return;

  selectedTextElement = { owner, obj, key, element: domEl };
  domEl.classList.add('selected-text');
  document.getElementById('textStyleTools').style.display = 'block';

  let size = 12, bold = false;
  if (owner === 'event') {
    if (key === 'title') { size = obj.customTitleSize || 12; bold = obj.customTitleBold ?? false; }
    if (key === 'year') { size = obj.customYearSize || 10; bold = obj.customYearBold ?? false; }
  } else if (owner === 'period') {
    if (key === 'name') { size = obj.nameSize || 13; bold = obj.nameBold ?? true; }
    if (key === 'dates') { size = obj.datesSize || 11; bold = obj.datesBold ?? false; }
  } else if (owner === 'artist') {
    if (key === 'name') { size = obj.nameSize || 12; bold = obj.nameBold ?? true; }
    if (key === 'dates') { size = obj.datesSize || 10; bold = obj.datesBold ?? false; }
  }

  document.getElementById('selectedTextSize').value = size;
  document.getElementById('selectedTextSizeValue').textContent = size + 'px';
  document.getElementById('selectedTextBold').checked = bold;
}

// ==================== MODALS ====================
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
    }
  } else {
    events.push({
      id: Date.now(),
      name, year, image: img,
      y: 100, width: 120, height: 120
    });
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
  const height = parseInt(document.getElementById('periodHeight').value);

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
      name, startYear, endYear, color,
      y: 50, height
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
    }
  } else {
    artists.push({
      id: Date.now(),
      name, birthYear, deathYear,
      y: settings.timelineY - 100
    });
  }

  closeModals();
  render();
  saveToLocalStorageSilent();
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
  } else if (selectedItem.type === 'period') {
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
  } else if (selectedItem.type === 'artist') {
    const a = artists.find(x => x.id === selectedItem.id);
    if (!a) return;
    document.getElementById('artistModalTitle').textContent = "Modifier l'artiste";
    document.getElementById('artistName').value = a.name;
    document.getElementById('artistBirth').value = a.birthYear;
    document.getElementById('artistDeath').value = a.deathYear;
    document.getElementById('artistModal').classList.add('show');
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

// ==================== ACTIONS ====================
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

// ==================== SAUVEGARDE ====================
function saveToFile() {
  try {
    const data = { events, periods, artists, settings, version: '2.0' };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `frise-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
    alert('Sauvegarde téléchargée ! 💾');
  } catch (err) {
    alert('Erreur: ' + err.message);
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
      
      // Sync UI
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
      alert('Sauvegarde chargée ! 📂');
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function saveToLocalStorage() {
  localStorage.setItem('timelineData', JSON.stringify({ events, periods, artists, settings }));
  alert('Sauvegarde navigateur réussie ! 💾');
}

function saveToLocalStorageSilent() {
  try {
    localStorage.setItem('timelineData', JSON.stringify({ events, periods, artists, settings }));
  } catch (e) {}
}

function loadFromLocalStorage() {
  const raw = localStorage.getItem('timelineData');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    events = data.events || [];
    periods = data.periods || [];
    artists = data.artists || [];
    if (data.settings) settings = { ...settings, ...data.settings };
    
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
  } catch (e) {}
}

// ==================== START ====================
window.addEventListener('load', init);
window.addEventListener('resize', () => {
  resizeCanvas();
  render();
});
