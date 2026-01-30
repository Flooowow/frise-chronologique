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
  bgColor: '#F5F0E8',
  showGrid: true
};

// Pan & Drag
let isDraggingCanvas = false;
let dragStart = { x: 0, y: 0 };
let viewOffset = { x: 0, y: 0 };
let draggedItem = null;
let resizingItem = null;
let resizingPeriod = null;
let editMode = false;

const canvas = document.getElementById('timeline');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');
const eventsContainer = document.getElementById('eventsContainer');

// ==================== UTILS ====================
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 🔧 FONCTION DE REDIMENSIONNEMENT D'IMAGE
function resizeImage(file, maxWidth = 400, maxHeight = 400, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculer les nouvelles dimensions en gardant le ratio
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        
        // Créer un canvas pour redimensionner
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convertir en base64 avec compression
        const resizedBase64 = canvas.toDataURL('image/jpeg', quality);
        
        console.log(`Image redimensionnée: ${img.width}x${img.height} → ${width}x${height}`);
        resolve(resizedBase64);
      };
      
      img.onerror = reject;
      img.src = e.target.result;
    };
    
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showToast(message, type = 'info') {
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

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

// ==================== COLLAPSIBLE SECTIONS ====================
function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  const header = section.previousElementSibling;
  const icon = header.querySelector('.toggle-icon');
  
  section.classList.toggle('collapsed');
  
  // Rotation de l'icône
  if (section.classList.contains('collapsed')) {
    icon.style.transform = 'rotate(-90deg)';
  } else {
    icon.style.transform = 'rotate(0deg)';
  }
}

// ==================== INIT ====================
function init() {
  resizeCanvas();
  setupEventListeners();
  // 🔧 Plus de chargement automatique depuis le navigateur
  // L'utilisateur doit charger manuellement un fichier JSON
  applyBackgroundToContainer();
  render();
}

function resizeCanvas() {
  // 🔧 Calcul dynamique de la largeur en fonction de l'échelle
  // Plus l'échelle est petite, plus la frise est longue
  const totalYears = settings.endYear - settings.startYear;
  const pixelsPerYear = 140 / settings.scale; // 140px pour l'échelle par défaut (50 ans)
  const calculatedWidth = totalYears * pixelsPerYear;
  
  // Largeur minimale basée sur le nombre de pages
  const minWidth = settings.pagesH * 1400;
  
  // 🔧 LIMITE MAXIMALE pour éviter les erreurs canvas
  // La plupart des navigateurs limitent à 32767px ou moins
  const MAX_CANVAS_SIZE = 30000; // Limite sécuritaire
  
  // Utiliser la plus grande des deux valeurs, mais limiter au maximum
  let targetWidth = Math.max(calculatedWidth, minWidth);
  
  if (targetWidth > MAX_CANVAS_SIZE) {
    targetWidth = MAX_CANVAS_SIZE;
    console.warn(`Canvas limité à ${MAX_CANVAS_SIZE}px. Utilisez une échelle plus grande ou réduisez la plage d'années.`);
    showToast(`⚠️ Frise limitée à ${MAX_CANVAS_SIZE}px. Augmentez l'échelle pour éviter cette limite.`, 'error');
  }
  
  canvas.width = targetWidth;
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

  // Settings avec debouncing pour la performance
  const debouncedRender = debounce(() => {
    render();
    saveToLocalStorageSilent();
  }, 150);
  
  // 🔧 Sauvegarde séparée pour éviter les appels trop fréquents
  const debouncedSave = debounce(() => {
    saveToLocalStorageSilent();
  }, 1000);

  const updateSetting = (id, key, parser = parseInt, needsResize = false) => {
    document.getElementById(id).addEventListener('change', (e) => {
      settings[key] = parser(e.target.value);
      if (needsResize) resizeCanvas();
      debouncedRender();
    });
  };

  updateSetting('startYear', 'startYear');
  updateSetting('endYear', 'endYear');
  updateSetting('scale', 'scale');
  updateSetting('pagesH', 'pagesH', parseInt, true);
  updateSetting('pagesV', 'pagesV', parseInt, true);

  document.getElementById('timelineY').addEventListener('input', (e) => {
    settings.timelineY = parseInt(e.target.value);
    debouncedRender();
  });

  document.getElementById('timelineThickness').addEventListener('input', (e) => {
    settings.timelineThickness = parseInt(e.target.value);
    debouncedRender();
  });

  document.getElementById('zoomLevel').addEventListener('input', (e) => {
    settings.zoom = parseFloat(e.target.value);
    updateViewOffset(); // 🔧 Pas de render() ici, juste le transform
    // La sauvegarde se fait avec debounce
    debouncedSave();
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

  // Text tools - Uniquement pour périodes et artistes
  document.getElementById('selectedTextSize').addEventListener('input', (e) => {
    const size = parseInt(e.target.value);
    document.getElementById('selectedTextSizeValue').textContent = size + 'px';
    if (!selectedTextElement) return;

    const { owner, obj, key } = selectedTextElement;
    // 🔧 Les événements ont des tailles fixes, on ignore
    if (owner === 'period') {
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
    // 🔧 Les événements ont des styles fixes, on ignore
    if (owner === 'period') {
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
      deselectItem();
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
    } else if (resizingPeriod) {
      handlePeriodResize(e);
    }
  });

  window.addEventListener('mouseup', () => {
    // 🔧 Sauvegarder uniquement à la fin du drag/resize pour optimiser
    if (isDraggingCanvas || draggedItem || resizingItem || resizingPeriod) {
      saveToLocalStorageSilent();
    }
    
    isDraggingCanvas = false;
    container.classList.remove('grabbing');
    draggedItem = null;
    resizingItem = null;
    resizingPeriod = null;
  });

  // Image preview avec redimensionnement automatique
  document.getElementById('eventImage').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      // Afficher un message de chargement
      const preview = document.getElementById('eventPreview');
      preview.style.display = 'block';
      preview.src = '';
      preview.alt = 'Redimensionnement en cours...';
      
      // Redimensionner l'image (max 400x400, qualité 85%)
      const resizedImage = await resizeImage(file, 400, 400, 0.85);
      
      preview.src = resizedImage;
      preview.alt = 'Aperçu';
      
      showToast('Image optimisée !', 'success');
    } catch (error) {
      console.error('Erreur lors du redimensionnement:', error);
      showToast('Erreur lors du chargement de l\'image', 'error');
    }
  });

  // Raccourcis clavier
  document.addEventListener('keydown', (e) => {
    // ESC pour fermer modals
    if (e.key === 'Escape') {
      closeModals();
      deselectItem();
      clearSelectedText();
    }
    
    // Delete pour supprimer l'élément sélectionné
    if (e.key === 'Delete' && selectedItem) {
      e.preventDefault();
      deleteSelectedItem();
    }
    
    // Ctrl+S pour sauvegarder
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      saveToFile();
    }
    
    // Entrée pour valider dans les modals
    if (e.key === 'Enter' && document.querySelector('.modal.show')) {
      e.preventDefault();
      const activeModal = document.querySelector('.modal.show');
      if (activeModal.id === 'eventModal') saveEvent();
      else if (activeModal.id === 'periodModal') savePeriod();
      else if (activeModal.id === 'artistModal') saveArtist();
    }
  });
}

function applyBackgroundToContainer() {
  container.style.backgroundColor = settings.bgColor;
  if (settings.showGrid) {
    container.style.backgroundImage = 'linear-gradient(to right, #E8DCC8 1px, transparent 1px), linear-gradient(to bottom, #E8DCC8 1px, transparent 1px)';
    container.style.backgroundSize = '37.8px 37.8px';
  } else {
    container.style.backgroundImage = 'none';
  }
}

function updateViewOffset() {
  const transform = `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${settings.zoom})`;
  canvas.style.transform = transform;
  eventsContainer.style.transform = transform;
}

// ==================== RENDER ====================
let renderScheduled = false;

// 🔧 Utiliser requestAnimationFrame pour des animations fluides
function scheduleRender() {
  if (!renderScheduled) {
    renderScheduled = true;
    requestAnimationFrame(() => {
      render();
      renderScheduled = false;
    });
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTimeline();
  drawPeriods();
  drawArtists();
  drawEvents();
  updateViewOffset();
}

function drawTimeline() {
  // 🔧 Vérifier si le canvas est valide
  if (!canvas || !ctx || canvas.width === 0 || canvas.height === 0) {
    console.error('Canvas invalide, abandon du dessin');
    return;
  }
  
  try {
    const y = settings.timelineY;
    const half = settings.timelineThickness / 2;

    // Barre principale avec couleur crème
    ctx.fillStyle = '#F5F0E8';
    ctx.fillRect(0, y - half, canvas.width, settings.timelineThickness);
    ctx.strokeStyle = '#2D3436'; // Anthracite
    ctx.lineWidth = 5;
    ctx.strokeRect(0, y - half, canvas.width, settings.timelineThickness);

    // Graduations avec accents or
    ctx.strokeStyle = '#D4AF37'; // Or
    ctx.lineWidth = 3;
    ctx.fillStyle = '#2D3436'; // Anthracite
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
  } catch (error) {
    console.error('Erreur lors du dessin de la timeline:', error);
    showToast('Erreur de rendu. Canvas trop grand ?', 'error');
  }
}

// ==================== EVENTS ====================
function drawEvents() {
  // 🔧 Suppression en une seule fois
  const toRemove = document.querySelectorAll('.event-card, .connection-line');
  toRemove.forEach(el => el.remove());

  // 🔧 Utiliser un fragment pour ajouter tous les éléments d'un coup
  const fragment = document.createDocumentFragment();
  const lineFragment = document.createDocumentFragment();

  events.forEach(ev => {
    const x = yearToX(parseInt(ev.year));
    const card = document.createElement('div');
    card.className = 'event-card' + (selectedItem?.type === 'event' && selectedItem?.id === ev.id ? ' selected' : '');
    card.style.left = (x - ev.width / 2) + 'px';
    card.style.top = ev.y + 'px';
    card.style.width = ev.width + 'px';
    card.style.height = ev.height + 'px';

    // 🔧 Tailles fixes : 23px pour le titre, 20px gras pour l'année
    card.innerHTML = `
      <img src="${ev.image}" alt="${escapeHtml(ev.name)}">
      <div class="event-title" data-owner="event" data-id="${ev.id}" data-key="title">${escapeHtml(ev.name)}</div>
      <div class="event-year" data-owner="event" data-id="${ev.id}" data-key="year">${escapeHtml(String(ev.year))}</div>
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
      lineFragment.appendChild(line); // 🔧 Ajouter au fragment
    } else if (ev.y > timelineBottom) {
      // En-dessous
      const line = document.createElement('div');
      line.className = 'connection-line';
      line.style.left = x + 'px';
      line.style.top = timelineBottom + 'px';
      line.style.height = (ev.y - timelineBottom) + 'px';
      lineFragment.appendChild(line); // 🔧 Ajouter au fragment
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
    });

    // Texte sélectionnable - DÉSACTIVÉ pour les événements
    // Les tailles sont maintenant fixes (23px titre, 20px année en gras)
    /* card.querySelectorAll('[data-owner="event"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectTextElement(el);
      });
    }); */

    fragment.appendChild(card); // 🔧 Ajouter au fragment
    
    // Gestion du resize corner
    const resizeCorner = card.querySelector('.resize-corner');
    resizeCorner.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const m = getMouseWorldPos(e);
      resizingItem = { 
        type: 'event', 
        item: ev, 
        startX: m.x, 
        startY: m.y, 
        startW: ev.width, 
        startH: ev.height 
      };
    });
  });
  
  // 🔧 Ajouter tous les éléments d'un coup (1 seul reflow au lieu de N)
  eventsContainer.appendChild(lineFragment);
  eventsContainer.appendChild(fragment);
}

// ==================== PERIODS ====================
function drawPeriods() {
  document.querySelectorAll('.period-bar').forEach(el => el.remove());

  // 🔧 Utiliser un fragment pour ajouter tous les éléments d'un coup
  const fragment = document.createDocumentFragment();

  periods.forEach(p => {
    const startX = yearToX(parseInt(p.startYear));
    const endX = yearToX(parseInt(p.endYear));
    const div = document.createElement('div');
    div.className = 'period-bar' + (selectedItem?.type === 'period' && selectedItem?.id === p.id ? ' selected' : '');
    div.style.left = startX + 'px';
    div.style.top = p.y + 'px';
    div.style.width = (endX - startX) + 'px';
    div.style.height = (p.height || 40) + 'px';
    div.style.background = p.color || '#7C1D1D';

    const nameSize = p.nameSize || 13;
    const datesSize = p.datesSize || 11;
    const nameBold = p.nameBold ?? true;
    const datesBold = p.datesBold ?? false;

    div.innerHTML = `
      <div class="period-resize-handle left"></div>
      <div class="period-resize-handle right"></div>
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
      // Ignorer si c'est un handle de resize ou du texte
      if (e.target.classList.contains('period-resize-handle')) return;
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

    // 🔧 HANDLES DE REDIMENSIONNEMENT
    const leftHandle = div.querySelector('.period-resize-handle.left');
    const rightHandle = div.querySelector('.period-resize-handle.right');

    leftHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const m = getMouseWorldPos(e);
      resizingPeriod = {
        item: p,
        side: 'left',
        startX: m.x,
        originalStart: parseInt(p.startYear)
      };
    });

    rightHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const m = getMouseWorldPos(e);
      resizingPeriod = {
        item: p,
        side: 'right',
        startX: m.x,
        originalEnd: parseInt(p.endYear)
      };
    });

    fragment.appendChild(div); // 🔧 Ajouter au fragment
  });
  
  // 🔧 Ajouter tous les éléments d'un coup
  eventsContainer.appendChild(fragment);
}

// 🔧 GESTION DU REDIMENSIONNEMENT DES PÉRIODES - En largeur uniquement
function handlePeriodResize(e) {
  if (!resizingPeriod) return;
  
  const m = getMouseWorldPos(e);
  const deltaX = m.x - resizingPeriod.startX;
  const deltaYear = xToYear(deltaX) - xToYear(0);
  
  if (resizingPeriod.side === 'left') {
    const newStart = resizingPeriod.originalStart + deltaYear;
    const currentEnd = parseInt(resizingPeriod.item.endYear);
    
    // Empêcher que le début dépasse la fin (minimum 10 ans)
    if (newStart < currentEnd - 10) {
      resizingPeriod.item.startYear = String(newStart);
    }
  } else if (resizingPeriod.side === 'right') {
    const newEnd = resizingPeriod.originalEnd + deltaYear;
    const currentStart = parseInt(resizingPeriod.item.startYear);
    
    // Empêcher que la fin soit avant le début (minimum 10 ans)
    if (newEnd > currentStart + 10) {
      resizingPeriod.item.endYear = String(newEnd);
    }
  }
  
  scheduleRender(); // 🔧 Utiliser scheduleRender
}

// ==================== ARTISTS ====================
function drawArtists() {
  document.querySelectorAll('.artist-line').forEach(el => el.remove());

  // 🔧 Utiliser un fragment pour ajouter tous les éléments d'un coup
  const fragment = document.createDocumentFragment();

  artists.forEach(a => {
    const birthX = yearToX(parseInt(a.birthYear));
    const deathX = yearToX(parseInt(a.deathYear));
    
    // 🔧 Gérer les dates inversées (erreur de saisie)
    const startX = Math.min(birthX, deathX);
    const endX = Math.max(birthX, deathX);
    const width = Math.abs(endX - startX);
    
    // 🔧 Si les dates sont inversées, afficher un avertissement visuel
    const isInverted = birthX > deathX;
    
    const div = document.createElement('div');
    div.className = 'artist-line' + (selectedItem?.type === 'artist' && selectedItem?.id === a.id ? ' selected' : '');
    if (isInverted) {
      div.style.borderTopColor = '#ff0000'; // Rouge si dates inversées
      div.style.borderTopWidth = '3px';
    }
    div.style.left = startX + 'px';
    div.style.top = a.y + 'px';
    div.style.width = width + 'px';

    const nameSize = a.nameSize || 12;
    const datesSize = a.datesSize || 10;
    const nameBold = a.nameBold ?? true;
    const datesBold = a.datesBold ?? false;

    div.innerHTML = `
      <div class="artist-marker" style="left: 0;"></div>
      <div class="artist-marker" style="left: ${width - 10}px;"></div>
      <div class="artist-name" data-owner="artist" data-id="${a.id}" data-key="name"
           style="font-size:${nameSize}px; font-weight:${nameBold ? 'bold':'normal'}; white-space: nowrap; ${isInverted ? 'color: #ff0000;' : ''}">${escapeHtml(a.name)}${isInverted ? ' ⚠️ Dates inversées' : ''}</div>
      <div class="artist-dates" data-owner="artist" data-id="${a.id}" data-key="dates"
           style="font-size:${datesSize}px; font-weight:${datesBold ? 'bold':'normal'}; white-space: nowrap;">${escapeHtml(a.birthYear)} à ${escapeHtml(a.deathYear)}</div>
    `;

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      selectItem(a, 'artist');
    });

    div.addEventListener('mousedown', (e) => {
      if (e.target.dataset?.owner === 'artist') return;
      const mousePos = getMouseWorldPos(e);
      draggedItem = { type: 'artist', item: a, offsetY: mousePos.y - a.y };
    });

    div.querySelectorAll('[data-owner="artist"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectTextElement(el);
      });
    });

    fragment.appendChild(div); // 🔧 Ajouter au fragment
  });
  
  // 🔧 Ajouter tous les éléments d'un coup
  eventsContainer.appendChild(fragment);
}

function handleDrag(e) {
  const m = getMouseWorldPos(e);
  const item = draggedItem.item;
  
  // Déplacement vertical illimité
  item.y = m.y - draggedItem.offsetY;
  
  scheduleRender(); // 🔧 Utiliser scheduleRender au lieu de render
  // La sauvegarde se fait uniquement au mouseup pour éviter trop d'appels
}

function handleResize(e) {
  const m = getMouseWorldPos(e);

  if (resizingItem.type === 'event') {
    const ev = resizingItem.item;
    const dx = m.x - resizingItem.startX;
    const dy = m.y - resizingItem.startY;
    const d = Math.max(dx, dy);
    ev.width = Math.max(80, resizingItem.startW + d);
    ev.height = Math.max(80, resizingItem.startH + d);
    scheduleRender(); // 🔧 Utiliser scheduleRender
  }
}

// ==================== SELECTION ====================
function selectItem(item, type) {
  selectedItem = { id: item.id, type };
  document.getElementById('selectedItemActions').style.display = 'block';
  render();
}

function deselectItem() {
  selectedItem = null;
  document.getElementById('selectedItemActions').style.display = 'none';
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

  // 🔧 Ignorer les événements (tailles fixes)
  if (owner === 'event') return;

  let obj = null;
  if (owner === 'period') obj = periods.find(x => x.id === id);
  if (owner === 'artist') obj = artists.find(x => x.id === id);
  if (!obj) return;

  selectedTextElement = { owner, obj, key, element: domEl };
  domEl.classList.add('selected-text');
  document.getElementById('textStyleTools').style.display = 'block';

  let size = 12, bold = false;
  if (owner === 'period') {
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
  document.getElementById('periodColor').value = '#7C1D1D';
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
    showToast('Veuillez remplir tous les champs', 'error');
    return;
  }

  if (editMode && selectedItem?.type === 'event') {
    const ev = events.find(x => x.id === selectedItem.id);
    if (ev) {
      ev.name = name;
      ev.year = year;
      ev.image = img;
      showToast('Événement modifié !', 'success');
    }
  } else {
    events.push({
      id: Date.now(),
      name, year, image: img,
      y: 100, width: 180, height: 180  // 🔧 Taille par défaut optimisée
    });
    showToast('Événement ajouté !', 'success');
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
    showToast('Veuillez remplir tous les champs', 'error');
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
      showToast('Période modifiée !', 'success');
    }
  } else {
    periods.push({
      id: Date.now(),
      name, startYear, endYear, color,
      y: 50, height
    });
    showToast('Période ajoutée !', 'success');
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
    showToast('Veuillez remplir tous les champs', 'error');
    return;
  }

  if (editMode && selectedItem?.type === 'artist') {
    const a = artists.find(x => x.id === selectedItem.id);
    if (a) {
      a.name = name;
      a.birthYear = birthYear;
      a.deathYear = deathYear;
      showToast('Artiste modifié !', 'success');
    }
  } else {
    artists.push({
      id: Date.now(),
      name, birthYear, deathYear,
      y: settings.timelineY - 100
    });
    showToast('Artiste ajouté !', 'success');
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
    document.getElementById('periodColor').value = p.color || '#7C1D1D';
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
  
  // Confirmation avant suppression
  const type = selectedItem.type === 'event' ? "l'événement" : 
               selectedItem.type === 'period' ? 'la période' : "l'artiste";
  
  if (!confirm(`Voulez-vous vraiment supprimer ${type} ?`)) return;
  
  if (selectedItem.type === 'event') events = events.filter(x => x.id !== selectedItem.id);
  if (selectedItem.type === 'period') periods = periods.filter(x => x.id !== selectedItem.id);
  if (selectedItem.type === 'artist') artists = artists.filter(x => x.id !== selectedItem.id);
  
  showToast('Élément supprimé', 'info');
  selectedItem = null;
  document.getElementById('selectedItemActions').style.display = 'none';
  clearSelectedText();
  render();
  saveToLocalStorageSilent();
}

// ==================== ACTIONS ====================
function setScale(newScale) {
  settings.scale = newScale;
  document.getElementById('scale').value = newScale;
  resizeCanvas();
  render();
  saveToLocalStorageSilent();
  showToast(`Échelle : ${newScale} ans`, 'info');
}

function centerOnYearZero() {
  const zeroX = yearToX(0);
  viewOffset.x = (window.innerWidth / 2) - zeroX;
  viewOffset.y = 0;
  updateViewOffset();
  showToast('Centré sur l\'année 0', 'info');
}

function resetView() {
  viewOffset = { x: 0, y: 0 };
  settings.zoom = 1;
  document.getElementById('zoomLevel').value = 1;
  updateViewOffset();
  showToast('Vue réinitialisée', 'info');
}

function applyBackgroundColor() {
  settings.bgColor = document.getElementById('bgColor').value;
  applyBackgroundToContainer();
  render();
  saveToLocalStorageSilent();
  showToast('Couleur de fond appliquée', 'success');
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
    showToast('Sauvegarde téléchargée ! 💾', 'success');
  } catch (err) {
    showToast('Erreur: ' + err.message, 'error');
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
      showToast('Sauvegarde chargée ! 📂', 'success');
    } catch (err) {
      showToast('Erreur: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// 🔧 Sauvegarde automatique DÉSACTIVÉE car elle sature le localStorage avec les images
// Utilisez plutôt le bouton "Télécharger sauvegarde" (Ctrl+S)
function saveToLocalStorageSilent() {
  // Désactivé pour éviter le dépassement de quota
  // Les images base64 prennent trop de place dans localStorage (limite ~5-10 Mo)
  return;
}

// ==================== START ====================
window.addEventListener('load', init);
window.addEventListener('resize', debounce(() => {
  resizeCanvas();
  render();
}, 250));
