// Variables globales
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

let isDragging = false;
let draggedItem = null;
let resizingItem = null;
let viewOffset = { x: 0, y: 0 };
let dragStart = { x: 0, y: 0 };
let editMode = false;

const canvas = document.getElementById('timeline');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');
const eventsContainer = document.getElementById('eventsContainer');

// Initialisation
function init() {
    resizeCanvas();
    setupEventListeners();
    loadFromLocalStorage();

    // Appliquer immédiatement fond + grille (CSS)
    applyBackgroundToContainer();

    // Forcer le premier rendu
    setTimeout(() => {
        render();
        console.log('Timeline initialized');
    }, 100);
}

function resizeCanvas() {
    const canvasWidth = settings.pagesH * 1400;
    const canvasHeight = settings.pagesV * 800;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    eventsContainer.style.width = canvasWidth + 'px';
    eventsContainer.style.height = canvasHeight + 'px';
    console.log('Canvas resized:', canvasWidth, 'x', canvasHeight);
}

function setupEventListeners() {
    // Menu toggle
    document.getElementById('toggleMenu').addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const container = document.getElementById('canvasContainer');
        sidebar.classList.toggle('closed');
        container.classList.toggle('closed');
        document.getElementById('toggleMenu').textContent = sidebar.classList.contains('closed') ? '▶' : '◀';
    });

    // Settings inputs
    document.getElementById('startYear').addEventListener('change', (e) => {
        settings.startYear = parseInt(e.target.value);
        render();
        saveToLocalStorageSilent();
    });
    document.getElementById('endYear').addEventListener('change', (e) => {
        settings.endYear = parseInt(e.target.value);
        render();
        saveToLocalStorageSilent();
    });
    document.getElementById('scale').addEventListener('change', (e) => {
        settings.scale = parseInt(e.target.value);
        render();
        saveToLocalStorageSilent();
    });
    document.getElementById('timelineY').addEventListener('input', (e) => {
        settings.timelineY = parseInt(e.target.value);
        render();
        saveToLocalStorageSilent();
    });
    document.getElementById('zoomLevel').addEventListener('input', (e) => {
        settings.zoom = parseFloat(e.target.value);
        render();
        saveToLocalStorageSilent();
    });
    document.getElementById('timelineThickness').addEventListener('input', (e) => {
        settings.timelineThickness = parseInt(e.target.value);
        render();
        saveToLocalStorageSilent();
    });
    document.getElementById('pagesH').addEventListener('change', (e) => {
        settings.pagesH = parseInt(e.target.value);
        resizeCanvas();
        render();
        saveToLocalStorageSilent();
    });
    document.getElementById('pagesV').addEventListener('change', (e) => {
        settings.pagesV = parseInt(e.target.value);
        resizeCanvas();
        render();
        saveToLocalStorageSilent();
    });

    // Couleur du fond : appliquer immédiatement
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

    // Text selection tools
    document.getElementById('selectedTextSize')?.addEventListener('input', (e) => {
        document.getElementById('selectedTextSizeValue').textContent = e.target.value + 'px';
        if (selectedTextElement) {
            const event = selectedTextElement.event;
            const newSize = parseInt(e.target.value);

            if (selectedTextElement.textType === 'title') {
                event.customTitleSize = newSize;
            } else {
                event.customYearSize = newSize;
            }

            selectedTextElement.element.style.fontSize = newSize + 'px';
            saveToLocalStorageSilent();
        }
    });
    document.getElementById('selectedTextBold')?.addEventListener('change', (e) => {
        if (selectedTextElement) {
            const event = selectedTextElement.event;
            const isBold = e.target.checked;

            if (selectedTextElement.textType === 'title') {
                event.customTitleBold = isBold;
            } else {
                event.customYearBold = isBold;
            }

            selectedTextElement.element.style.fontWeight = isBold ? 'bold' : 'normal';
            saveToLocalStorageSilent();
        }
    });

    // Canvas dragging
    container.addEventListener('mousedown', handleCanvasMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Image preview
    document.getElementById('eventImage').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const preview = document.getElementById('eventPreview');
                preview.src = event.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
}

function handleCanvasMouseDown(e) {
    if (e.target === canvas || e.target === container) {
        isDragging = true;
        container.classList.add('grabbing');
        dragStart = {
            x: e.clientX - viewOffset.x,
            y: e.clientY - viewOffset.y
        };

        // Désélectionner le texte si on clique sur le canvas
        if (selectedTextElement) {
            selectedTextElement.element.classList.remove('selected-text');
            selectedTextElement = null;
            document.getElementById('textStyleTools').style.display = 'none';
        }
    }
}

function handleMouseMove(e) {
    if (isDragging) {
        viewOffset = {
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        };
        updateViewOffset();
    } else if (draggedItem) {
        handleItemDrag(e);
    } else if (resizingItem) {
        handleItemResize(e);
    }
}

function handleMouseUp() {
    isDragging = false;
    draggedItem = null;
    resizingItem = null;
    container.classList.remove('grabbing');
}

function updateViewOffset() {
    canvas.style.transform = `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${settings.zoom})`;
    eventsContainer.style.transform = `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${settings.zoom})`;
}

// Conversion année -> position X
function yearToX(year) {
    const totalYears = settings.endYear - settings.startYear;
    const canvasWidth = canvas.width;
    return ((year - settings.startYear) / totalYears) * canvasWidth;
}

function getMouseWorldPos(e) {
    // coordonnées souris -> coordonnées monde (canvas)
    const rect = container.getBoundingClientRect();

    // position dans le viewport -> position dans le container scrollé
    const xInContainer = (e.clientX - rect.left) + container.scrollLeft;
    const yInContainer = (e.clientY - rect.top) + container.scrollTop;

    // retirer le pan (viewOffset) et le zoom
    const worldX = (xInContainer - viewOffset.x) / settings.zoom;
    const worldY = (yInContainer - viewOffset.y) / settings.zoom;

    return { x: worldX, y: worldY };
}

// Render la frise
function render() {
    // Effacer tout
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fond + grille : via CSS sur le container
    applyBackgroundToContainer();

    // IMPORTANT : ne pas remplir le canvas, sinon on ne voit pas la grille CSS
    // (on garde le canvas transparent et on ne dessine que la frise + graduations)
    drawTimeline();

    // DOM
    drawPeriods();
    drawArtists();
    drawEvents();

    updateViewOffset();
}

function applyBackgroundToContainer() {
    container.style.backgroundColor = settings.bgColor;
    container.classList.toggle('grid', !!settings.showGrid);
}

function drawTimeline() {
    const y = settings.timelineY;
    const thickness = settings.timelineThickness;
    const halfThickness = thickness / 2;

    // Barre principale avec fond blanc (comme avant)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, y - halfThickness, canvas.width, thickness);

    // Contour noir épais
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, y - halfThickness, canvas.width, thickness);

    // Graduations noires
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#000000';
    const fontSize = Math.max(14, Math.min(22, thickness * 0.45));
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let year = settings.startYear; year <= settings.endYear; year += settings.scale) {
        const x = yearToX(year);

        ctx.beginPath();
        ctx.moveTo(x, y - halfThickness);
        ctx.lineTo(x, y + halfThickness);
        ctx.stroke();

        ctx.fillText(year.toString(), x, y);
    }
}

function drawPeriods() {
    const existingPeriods = document.querySelectorAll('.period-bar');
    existingPeriods.forEach(el => el.remove());

    periods.forEach(period => {
        const startX = yearToX(parseInt(period.startYear));
        const endX = yearToX(parseInt(period.endYear));
        const width = endX - startX;

        const div = document.createElement('div');
        div.className = 'period-bar' + (selectedItem?.id === period.id ? ' selected' : '');
        div.style.left = startX + 'px';
        div.style.top = period.y + 'px';
        div.style.width = width + 'px';
        div.style.height = period.height + 'px';
        div.style.background = period.color;

        const nameSize = period.nameSize || 13;
const datesSize = period.datesSize || 11;
const nameBold = period.nameBold !== undefined ? period.nameBold : true;
const datesBold = period.datesBold !== undefined ? period.datesBold : false;
const textOffsetY = period.textOffsetY || 0;

div.innerHTML = `
  <div class="period-name selectable-text"
       data-owner="period" data-id="${period.id}" data-text="name"
       style="font-size:${nameSize}px; font-weight:${nameBold ? 'bold':'normal'}; transform: translateY(${textOffsetY}px);">
       ${period.name}
  </div>
  <div class="period-dates selectable-text"
       data-owner="period" data-id="${period.id}" data-text="dates"
       style="font-size:${datesSize}px; font-weight:${datesBold ? 'bold':'normal'}; transform: translateY(${textOffsetY}px);">
       ${period.startYear} - ${period.endYear}
  </div>
`;
        div.querySelectorAll('.selectable-text').forEach(el => {
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectGenericTextElement(el);
    });
    el.addEventListener('mousedown', (e) => {
        // drag vertical du texte seulement
        if (selectedTextElement && selectedTextElement.element === el) {
            e.stopPropagation();
            const p = periods.find(x => x.id === period.id);
            if (!p) return;
            const m = getMouseWorldPos(e);
            draggedItem = { type: 'periodText', item: p, baseY: m.y - (p.textOffsetY || 0) };
        }
    });
});

        div.addEventListener('mousedown', (e) => startDragPeriod(e, period));
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            selectItem(period, 'period');
        });

        eventsContainer.appendChild(div);
    });
}

function drawArtists() {
    const existingArtists = document.querySelectorAll('.artist-line');
    existingArtists.forEach(el => el.remove());

    artists.forEach(artist => {
        const birthX = yearToX(parseInt(artist.birthYear));
        const deathX = yearToX(parseInt(artist.deathYear));
        const width = deathX - birthX;

        const div = document.createElement('div');
        div.className = 'artist-line' + (selectedItem?.id === artist.id ? ' selected' : '');
        div.style.left = birthX + 'px';
        div.style.top = artist.y + 'px';
        div.style.width = width + 'px';

       const nameSize = artist.nameSize || 12;
const datesSize = artist.datesSize || 10;
const nameBold = artist.nameBold !== undefined ? artist.nameBold : true;
const datesBold = artist.datesBold !== undefined ? artist.datesBold : false;
const textOffsetY = artist.textOffsetY || 0;

div.innerHTML = `
  <div class="artist-marker" style="left: 0;"></div>
  <div class="artist-marker" style="left: ${width - 10}px;"></div>

  <div class="artist-name selectable-text"
       data-owner="artist" data-id="${artist.id}" data-text="name"
       style="font-size:${nameSize}px; font-weight:${nameBold ? 'bold':'normal'}; transform: translate(-50%, ${textOffsetY}px);">
       ${artist.name}
  </div>

  <div class="artist-dates selectable-text"
       data-owner="artist" data-id="${artist.id}" data-text="dates"
       style="font-size:${datesSize}px; font-weight:${datesBold ? 'bold':'normal'}; transform: translate(-50%, ${textOffsetY}px);">
       ${artist.birthYear} à ${artist.deathYear}
  </div>
`;
        
div.querySelectorAll('.selectable-text').forEach(el => {
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectGenericTextElement(el);
    });
    el.addEventListener('mousedown', (e) => {
        if (selectedTextElement && selectedTextElement.element === el) {
            e.stopPropagation();
            const a = artists.find(x => x.id === artist.id);
            if (!a) return;
            const m = getMouseWorldPos(e);
            draggedItem = { type: 'artistText', item: a, baseY: m.y - (a.textOffsetY || 0) };
        }
    });
});

        div.addEventListener('mousedown', (e) => startDragArtist(e, artist));
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            selectItem(artist, 'artist');
        });

        eventsContainer.appendChild(div);
    });
}

function drawEvents() {
    const existingEvents = document.querySelectorAll('.event-card');
    existingEvents.forEach(el => el.remove());

    const existingLines = document.querySelectorAll('.connection-line');
    existingLines.forEach(el => el.remove());

    events.forEach(event => {
        const x = yearToX(parseInt(event.year));
        const halfThickness = settings.timelineThickness / 2;
        const timelineTop = settings.timelineY - halfThickness;
        const timelineBottom = settings.timelineY + halfThickness;
        const eventBottom = event.y + event.height;
        const eventAboveTimeline = eventBottom < timelineTop;

        const card = document.createElement('div');
        card.className = 'event-card' + (selectedItem?.id === event.id ? ' selected' : '');
        card.style.left = (x - event.width / 2) + 'px';
        card.style.top = event.y + 'px';
        card.style.width = event.width + 'px';
        card.style.height = event.height + 'px';

        const titleSize = event.customTitleSize || 12;
        const titleBold = event.customTitleBold !== undefined ? event.customTitleBold : false;
        const yearSize = event.customYearSize || 10;
        const yearBold = event.customYearBold !== undefined ? event.customYearBold : false;

        card.innerHTML = `
            <img src="${event.image}" alt="${event.name}">
            <div class="event-title" data-event-id="${event.id}" data-text-type="title" style="font-size: ${titleSize}px; font-weight: ${titleBold ? 'bold' : 'normal'};">${event.name}</div>
            <div class="event-year" data-event-id="${event.id}" data-text-type="year" style="font-size: ${yearSize}px; font-weight: ${yearBold ? 'bold' : 'normal'};">${event.year}</div>
            <div class="resize-corner"></div>
        `;

        const lineDiv = document.createElement('div');
        lineDiv.className = 'connection-line';

        if (eventAboveTimeline) {
            const lineHeight = timelineTop - eventBottom;
            if (lineHeight > 0) {
                lineDiv.style.left = x + 'px';
                lineDiv.style.top = eventBottom + 'px';
                lineDiv.style.height = lineHeight + 'px';
                eventsContainer.appendChild(lineDiv);
            }
        } else {
            const lineHeight = event.y - timelineBottom;
            if (lineHeight > 0) {
                lineDiv.style.left = x + 'px';
                lineDiv.style.top = timelineBottom + 'px';
                lineDiv.style.height = lineHeight + 'px';
                eventsContainer.appendChild(lineDiv);
            }
        }

        card.addEventListener('mousedown', (e) => {
            if (!e.target.classList.contains('event-title') && !e.target.classList.contains('event-year')) {
                startDragEvent(e, event);
            }
        });
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            selectItem(event, 'event');
        });

        const titleEl = card.querySelector('.event-title');
        const yearEl = card.querySelector('.event-year');

        titleEl.addEventListener('click', (e) => {
            e.stopPropagation();
            selectTextElement(event, 'title', titleEl);
        });

        yearEl.addEventListener('click', (e) => {
            e.stopPropagation();
            selectTextElement(event, 'year', yearEl);
        });

        const resizeHandle = card.querySelector('.resize-corner');
        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startResizeEvent(e, event);
        });

        eventsContainer.appendChild(card);
    });
}

function selectTextElement(event, textType, element) {
    if (selectedTextElement) {
        selectedTextElement.element.classList.remove('selected-text');
    }

    selectedTextElement = { event, textType, element };
    element.classList.add('selected-text');

    document.getElementById('textStyleTools').style.display = 'block';

    if (textType === 'title') {
        const size = event.customTitleSize || 12;
        const bold = event.customTitleBold !== undefined ? event.customTitleBold : false;
        document.getElementById('selectedTextSize').value = size;
        document.getElementById('selectedTextSizeValue').textContent = size + 'px';
        document.getElementById('selectedTextBold').checked = bold;
    } else {
        const size = event.customYearSize || 10;
        const bold = event.customYearBold !== undefined ? event.customYearBold : false;
        document.getElementById('selectedTextSize').value = size;
        document.getElementById('selectedTextSizeValue').textContent = size + 'px';
        document.getElementById('selectedTextBold').checked = bold;
    }
}

function selectGenericTextElement(domEl) {
    // nettoyer ancienne sélection
    if (selectedTextElement?.element) {
        selectedTextElement.element.classList.remove('selected-text');
    }

    const owner = domEl.dataset.owner; // "event" / "period" / "artist"
    const id = parseInt(domEl.dataset.id);
    const textKey = domEl.dataset.text; // "title/year/name/dates"

    let obj = null;
    if (owner === 'period') obj = periods.find(x => x.id === id);
    if (owner === 'artist') obj = artists.find(x => x.id === id);

    if (!obj) return;

    selectedTextElement = { owner, obj, textKey, element: domEl };
    domEl.classList.add('selected-text');

    document.getElementById('textStyleTools').style.display = 'block';

    // charger valeurs dans l'UI
    let size = 12;
    let bold = false;

    if (owner === 'period') {
        size = (textKey === 'name') ? (obj.nameSize || 13) : (obj.datesSize || 11);
        bold = (textKey === 'name') ? (obj.nameBold ?? true) : (obj.datesBold ?? false);
    } else if (owner === 'artist') {
        size = (textKey === 'name') ? (obj.nameSize || 12) : (obj.datesSize || 10);
        bold = (textKey === 'name') ? (obj.nameBold ?? true) : (obj.datesBold ?? false);
    }

    document.getElementById('selectedTextSize').value = size;
    document.getElementById('selectedTextSizeValue').textContent = size + 'px';
    document.getElementById('selectedTextBold').checked = bold;
}


// Drag & Drop handlers
function startDragEvent(e, event) {
    e.stopPropagation();
    const m = getMouseWorldPos(e);
    draggedItem = {
        item: event,
        type: 'event',
        offsetY: m.y - event.y
    };
}

function startDragPeriod(e, period) {
    e.stopPropagation();
    const m = getMouseWorldPos(e);
    draggedItem = {
        item: period,
        type: 'period',
        offsetY: m.y - period.y
    };
}

function startDragArtist(e, artist) {
    e.stopPropagation();
    const m = getMouseWorldPos(e);
    draggedItem = {
        item: artist,
        type: 'artist',
        offsetY: m.y - artist.y
    };
}

function handleItemDrag(e) {
    if (!draggedItem) return;

    const m = getMouseWorldPos(e);
    const newY = m.y - draggedItem.offsetY;

    if (draggedItem.type === 'event') {
        const ev = events.find(x => x.id === draggedItem.item.id);
        if (ev) {
            // autoriser tout le haut, mais pas au-delà des limites du canvas
            ev.y = Math.max(0, Math.min(canvas.height - ev.height, newY));
            render();
            saveToLocalStorageSilent();
        }
    } else if (draggedItem.type === 'period') {
        const p = periods.find(x => x.id === draggedItem.item.id);
        if (p) {
            p.y = Math.max(0, Math.min(canvas.height - p.height, newY));
            render();
            saveToLocalStorageSilent();
        }
    } else if (draggedItem.type === 'artist') {
        const a = artists.find(x => x.id === draggedItem.item.id);
        if (a) {
            a.y = Math.max(0, Math.min(canvas.height, newY));
            render();
            saveToLocalStorageSilent();
        }
    } else if (draggedItem.type === 'periodText') {
        const p = periods.find(x => x.id === draggedItem.item.id);
        if (p) {
            p.textOffsetY = Math.max(-200, Math.min(200, m.y - draggedItem.baseY));
            render();
            saveToLocalStorageSilent();
        }
    } else if (draggedItem.type === 'artistText') {
        const a = artists.find(x => x.id === draggedItem.item.id);
        if (a) {
            a.textOffsetY = Math.max(-200, Math.min(200, m.y - draggedItem.baseY));
            render();
            saveToLocalStorageSilent();
        }
    }
}

function handleItemResize(e) {
    if (!resizingItem) return;

    const deltaX = (e.clientX - resizingItem.startX) / settings.zoom;
    const deltaY = (e.clientY - resizingItem.startY) / settings.zoom;
    const delta = Math.max(deltaX, deltaY);

    const event = events.find(ev => ev.id === resizingItem.item.id);
    if (event) {
        event.width = Math.max(80, resizingItem.startWidth + delta);
        event.height = Math.max(80, resizingItem.startHeight + delta);
        render();
        saveToLocalStorageSilent();
    }
}
function ensureEventCardFitsText(event) {
    // Hauteurs minimales (ajustables)
    const minImg = 50;
    const paddingAndGaps = 22; // marge/padding approximatifs

    const titleSize = event.customTitleSize || 12;
    const yearSize = event.customYearSize || 10;

    // Estimation simple de hauteur texte (robuste sans mesure DOM)
    // 2 lignes max pour le titre, 1 ligne pour l'année
    const titleH = Math.ceil(titleSize * 1.2 * 2);
    const yearH = Math.ceil(yearSize * 1.2 * 1);

    const minTotal = minImg + titleH + yearH + paddingAndGaps;

    if (event.height < minTotal) {
        event.height = minTotal;
    }
}

// Sélection d'item
function selectItem(item, type) {
    selectedItem = { ...item, type };
    document.getElementById('selectedItemActions').style.display = 'block';
    render();
}

// Modals (inchangées)
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
    document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('show'));
}

function saveEvent() {
    const name = document.getElementById('eventName').value;
    const year = document.getElementById('eventYear').value;
    const preview = document.getElementById('eventPreview');
    const image = preview.src;

    if (!name || !year || !image || image === window.location.href) {
        alert('Veuillez remplir tous les champs');
        return;
    }

    if (editMode && selectedItem) {
        const event = events.find(e => e.id === selectedItem.id);
        if (event) {
            event.name = name;
            event.year = year;
            event.image = image;
        }
    } else {
        events.push({
            id: Date.now(),
            name,
            year,
            image,
            y: 100,
            width: 120,
            height: 120
        });
    }

    closeModals();
    render();
    saveToLocalStorageSilent();
}

function savePeriod() {
    const name = document.getElementById('periodName').value;
    const startYear = document.getElementById('periodStart').value;
    const endYear = document.getElementById('periodEnd').value;
    const color = document.getElementById('periodColor').value;
    const height = parseInt(document.getElementById('periodHeight').value);

    if (!name || !startYear || !endYear) {
        alert('Veuillez remplir tous les champs');
        return;
    }

    if (editMode && selectedItem) {
        const period = periods.find(p => p.id === selectedItem.id);
        if (period) {
            period.name = name;
            period.startYear = startYear;
            period.endYear = endYear;
            period.color = color;
            period.height = height;
        }
    } else {
        periods.push({
            id: Date.now(),
            name,
            startYear,
            endYear,
            color,
            y: 50,
            height: height
        });
    }

    closeModals();
    render();
    saveToLocalStorageSilent();
}

function saveArtist() {
    const name = document.getElementById('artistName').value;
    const birthYear = document.getElementById('artistBirth').value;
    const deathYear = document.getElementById('artistDeath').value;

    if (!name || !birthYear || !deathYear) {
        alert('Veuillez remplir tous les champs');
        return;
    }

    if (editMode && selectedItem) {
        const artist = artists.find(a => a.id === selectedItem.id);
        if (artist) {
            artist.name = name;
            artist.birthYear = birthYear;
            artist.deathYear = deathYear;
        }
    } else {
        artists.push({
            id: Date.now(),
            name,
            birthYear,
            deathYear,
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
        document.getElementById('eventModalTitle').textContent = 'Modifier l\'événement';
        document.getElementById('eventName').value = selectedItem.name;
        document.getElementById('eventYear').value = selectedItem.year;
        document.getElementById('eventPreview').src = selectedItem.image;
        document.getElementById('eventPreview').style.display = 'block';
        document.getElementById('eventModal').classList.add('show');
    } else if (selectedItem.type === 'period') {
        document.getElementById('periodModalTitle').textContent = 'Modifier la période';
        document.getElementById('periodName').value = selectedItem.name;
        document.getElementById('periodStart').value = selectedItem.startYear;
        document.getElementById('periodEnd').value = selectedItem.endYear;
        document.getElementById('periodColor').value = selectedItem.color;
        document.getElementById('periodHeight').value = selectedItem.height || 40;
        document.getElementById('periodHeightValue').textContent = (selectedItem.height || 40) + 'px';
        document.getElementById('periodModal').classList.add('show');
    } else if (selectedItem.type === 'artist') {
        document.getElementById('artistModalTitle').textContent = 'Modifier l\'artiste';
        document.getElementById('artistName').value = selectedItem.name;
        document.getElementById('artistBirth').value = selectedItem.birthYear;
        document.getElementById('artistDeath').value = selectedItem.deathYear;
        document.getElementById('artistModal').classList.add('show');
    }
}

function deleteSelectedItem() {
    if (!selectedItem) return;

    if (selectedItem.type === 'event') {
        events = events.filter(e => e.id !== selectedItem.id);
    } else if (selectedItem.type === 'period') {
        periods = periods.filter(p => p.id !== selectedItem.id);
    } else if (selectedItem.type === 'artist') {
        artists = artists.filter(a => a.id !== selectedItem.id);
    }

    selectedItem = null;
    document.getElementById('selectedItemActions').style.display = 'none';
    render();
    saveToLocalStorageSilent();
}

function centerOnYearZero() {
    const zeroX = yearToX(0);
    viewOffset.x = (window.innerWidth / 2) - zeroX;
    viewOffset.y = 0;
    updateViewOffset();
}

function applyBackgroundColor() {
    const newColor = document.getElementById('bgColor').value;
    settings.bgColor = newColor;
    applyBackgroundToContainer();
    render();
    saveToLocalStorageSilent();
}

// Sauvegarde / Chargement fichier
function saveToFile() {
    try {
        const data = { events, periods, artists, settings, version: '1.0' };

        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        const filename = `frise-chronologique-${new Date().getTime()}.json`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(url), 100);

        alert('Sauvegarde téléchargée ! 💾');
    } catch (error) {
        console.error('Save error:', error);
        alert('Erreur lors de la sauvegarde : ' + error.message);
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

            // fusion settings (robuste)
            if (data.settings) {
                settings = { ...settings, ...data.settings };

                document.getElementById('startYear').value = settings.startYear;
                document.getElementById('endYear').value = settings.endYear;
                document.getElementById('scale').value = settings.scale;
                document.getElementById('timelineY').value = settings.timelineY;
                document.getElementById('timelineThickness').value = settings.timelineThickness || 40;
                document.getElementById('zoomLevel').value = settings.zoom;
                document.getElementById('pagesH').value = settings.pagesH || 3;
                document.getElementById('pagesV').value = settings.pagesV || 2;
                document.getElementById('bgColor').value = settings.bgColor || '#ffffff';
                document.getElementById('showGrid').checked = settings.showGrid !== undefined ? settings.showGrid : true;
            }

            resizeCanvas();
            render();
            saveToLocalStorageSilent();
            alert('Sauvegarde chargée avec succès ! 📂');
        } catch (error) {
            alert('Erreur lors du chargement du fichier : ' + error.message);
        }
    };
    reader.readAsText(file);

    event.target.value = '';
}

// Sauvegarde / Chargement localStorage
function saveToLocalStorage() {
    const data = { events, periods, artists, settings };
    localStorage.setItem('timelineData', JSON.stringify(data));
    alert('Sauvegarde réussie dans le navigateur ! 💾');
}

function saveToLocalStorageSilent() {
    try {
        localStorage.setItem('timelineData', JSON.stringify({ events, periods, artists, settings }));
    } catch (e) {
        console.warn('localStorage save failed', e);
    }
}

function loadFromLocalStorage() {
    const data = localStorage.getItem('timelineData');
    if (data) {
        const parsed = JSON.parse(data);
        events = parsed.events || [];
        periods = parsed.periods || [];
        artists = parsed.artists || [];

        if (parsed.settings) {
            settings = { ...settings, ...parsed.settings };

            document.getElementById('startYear').value = settings.startYear;
            document.getElementById('endYear').value = settings.endYear;
            document.getElementById('scale').value = settings.scale;
            document.getElementById('timelineY').value = settings.timelineY;
            document.getElementById('timelineThickness').value = settings.timelineThickness || 40;
            document.getElementById('zoomLevel').value = settings.zoom;
            document.getElementById('pagesH').value = settings.pagesH || 3;
            document.getElementById('pagesV').value = settings.pagesV || 2;
            document.getElementById('bgColor').value = settings.bgColor || '#ffffff';
            document.getElementById('showGrid').checked = settings.showGrid !== undefined ? settings.showGrid : true;
        }

        resizeCanvas();
        render();
    }
}

// Démarrage
window.addEventListener('load', init);
window.addEventListener('resize', () => {
    resizeCanvas();
    render();
});
