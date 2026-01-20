// Variables globales
let events = [];
let periods = [];
let artists = [];
let selectedItem = null;
let settings = {
    startYear: -500,
    endYear: 2000,
    scale: 50,
    timelineY: 300,
    timelineThickness: 40,
    zoom: 1,
    pagesH: 3,
    pagesV: 2,
    textSize: 12,
    textBold: false
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
    });
    document.getElementById('endYear').addEventListener('change', (e) => {
        settings.endYear = parseInt(e.target.value);
        render();
    });
    document.getElementById('scale').addEventListener('change', (e) => {
        settings.scale = parseInt(e.target.value);
        render();
    });
    document.getElementById('timelineY').addEventListener('input', (e) => {
        settings.timelineY = parseInt(e.target.value);
        render();
    });
    document.getElementById('zoomLevel').addEventListener('input', (e) => {
        settings.zoom = parseFloat(e.target.value);
        render();
    });
    document.getElementById('timelineThickness').addEventListener('input', (e) => {
        settings.timelineThickness = parseInt(e.target.value);
        render();
    });
    document.getElementById('pagesH').addEventListener('change', (e) => {
        settings.pagesH = parseInt(e.target.value);
        resizeCanvas();
        render();
    });
    document.getElementById('pagesV').addEventListener('change', (e) => {
        settings.pagesV = parseInt(e.target.value);
        resizeCanvas();
        render();
    });
    document.getElementById('textSize').addEventListener('input', (e) => {
        settings.textSize = parseInt(e.target.value);
        document.getElementById('textSizeValue').textContent = e.target.value + 'px';
        render();
    });
    document.getElementById('textBold').addEventListener('change', (e) => {
        settings.textBold = e.target.checked;
        render();
    });
    document.getElementById('periodHeight')?.addEventListener('input', (e) => {
        document.getElementById('periodHeightValue').textContent = e.target.value + 'px';
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

// Conversion position X -> année
function xToYear(x) {
    const totalYears = settings.endYear - settings.startYear;
    const canvasWidth = canvas.width;
    return Math.round((x / canvasWidth) * totalYears + settings.startYear);
}

// Render la frise
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dessiner la ligne de temps principale
    drawTimeline();
    
    // Dessiner les périodes
    drawPeriods();
    
    // Dessiner les artistes
    drawArtists();
    
    // Dessiner les événements
    drawEvents();
    
    updateViewOffset();
}

function drawTimeline() {
    const y = settings.timelineY;
    const thickness = settings.timelineThickness;
    const halfThickness = thickness / 2;
    
    // Barre principale épaisse
    ctx.fillStyle = '#1a202c';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.fillRect(0, y - halfThickness, canvas.width, thickness);
    ctx.strokeRect(0, y - halfThickness, canvas.width, thickness);
    
    // Graduations
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#fff';
    const fontSize = Math.max(12, Math.min(20, thickness * 0.4));
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let year = settings.startYear; year <= settings.endYear; year += settings.scale) {
        const x = yearToX(year);
        
        // Ligne de graduation
        ctx.beginPath();
        ctx.moveTo(x, y - halfThickness);
        ctx.lineTo(x, y + halfThickness);
        ctx.stroke();
        
        // Année
        ctx.fillText(year.toString(), x, y);
    }
}

function drawPeriods() {
    // Les périodes sont maintenant des éléments DOM
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
        
        div.innerHTML = `
            <div class="period-name" style="font-size: ${settings.textSize}px; font-weight: ${settings.textBold ? 'bold' : 'normal'};">${period.name}</div>
            <div class="period-dates" style="font-size: ${Math.max(10, settings.textSize - 2)}px; font-weight: ${settings.textBold ? 'bold' : 'normal'};">${period.startYear} - ${period.endYear}</div>
        `;
        
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
        
        div.innerHTML = `
            <div class="artist-marker" style="left: 0;"></div>
            <div class="artist-marker" style="left: ${width - 10}px;"></div>
            <div class="artist-name" style="font-size: ${settings.textSize}px; font-weight: ${settings.textBold ? 'bold' : 'normal'};">${artist.name}</div>
            <div class="artist-dates" style="font-size: ${Math.max(10, settings.textSize - 2)}px; font-weight: ${settings.textBold ? 'bold' : 'normal'};">${artist.birthYear} à ${artist.deathYear}</div>
        `;
        
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
    
    events.forEach(event => {
        const x = yearToX(parseInt(event.year));
        const eventAboveTimeline = event.y < settings.timelineY;
        
        const card = document.createElement('div');
        card.className = 'event-card' + (selectedItem?.id === event.id ? ' selected' : '');
        card.style.left = (x - event.width / 2) + 'px';
        card.style.top = event.y + 'px';
        card.style.width = event.width + 'px';
        card.style.height = event.height + 'px';
        
        card.innerHTML = `
            <img src="${event.image}" alt="${event.name}">
            <div class="event-title" style="font-size: ${settings.textSize}px; font-weight: ${settings.textBold ? 'bold' : 'normal'};">${event.name}</div>
            <div class="event-year" style="font-size: ${Math.max(10, settings.textSize - 2)}px; font-weight: ${settings.textBold ? 'bold' : 'normal'};">${event.year}</div>
            <div class="resize-corner"></div>
        `;
        
        // Ligne de connexion
        const lineDiv = document.createElement('div');
        lineDiv.className = 'connection-line';
        if (eventAboveTimeline) {
            lineDiv.style.left = x + 'px';
            lineDiv.style.top = (event.y + event.height) + 'px';
            lineDiv.style.height = (settings.timelineY - event.y - event.height - settings.timelineThickness / 2) + 'px';
        } else {
            lineDiv.style.left = x + 'px';
            lineDiv.style.top = (settings.timelineY + settings.timelineThickness / 2) + 'px';
            lineDiv.style.height = (event.y - settings.timelineY - settings.timelineThickness / 2) + 'px';
        }
        eventsContainer.appendChild(lineDiv);
        
        card.addEventListener('mousedown', (e) => startDragEvent(e, event));
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            selectItem(event, 'event');
        });
        
        const resizeHandle = card.querySelector('.resize-corner');
        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startResizeEvent(e, event);
        });
        
        eventsContainer.appendChild(card);
    });
}

// Drag & Drop handlers
function startDragEvent(e, event) {
    e.stopPropagation();
    draggedItem = {
        item: event,
        type: 'event',
        startY: e.clientY - event.y
    };
}

function startDragPeriod(e, period) {
    e.stopPropagation();
    draggedItem = {
        item: period,
        type: 'period',
        startY: e.clientY - period.y
    };
}

function startDragArtist(e, artist) {
    e.stopPropagation();
    draggedItem = {
        item: artist,
        type: 'artist',
        startY: e.clientY - artist.y
    };
}

function startResizeEvent(e, event) {
    e.stopPropagation();
    resizingItem = {
        item: event,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: event.width,
        startHeight: event.height
    };
}

function handleItemDrag(e) {
    if (!draggedItem) return;
    
    const newY = e.clientY - draggedItem.startY;
    
    if (draggedItem.type === 'event') {
        const event = events.find(ev => ev.id === draggedItem.item.id);
        if (event) {
            event.y = Math.max(0, newY);
            render();
        }
    } else if (draggedItem.type === 'period') {
        const period = periods.find(p => p.id === draggedItem.item.id);
        if (period) {
            period.y = Math.max(0, newY);
            render();
        }
    } else if (draggedItem.type === 'artist') {
        const artist = artists.find(a => a.id === draggedItem.item.id);
        if (artist) {
            artist.y = Math.max(0, newY);
            render();
        }
    }
}

function handleItemResize(e) {
    if (!resizingItem) return;
    
    const deltaX = e.clientX - resizingItem.startX;
    const deltaY = e.clientY - resizingItem.startY;
    const delta = Math.max(deltaX, deltaY);
    
    const event = events.find(ev => ev.id === resizingItem.item.id);
    if (event) {
        event.width = Math.max(80, resizingItem.startWidth + delta);
        event.height = Math.max(80, resizingItem.startHeight + delta);
        render();
    }
}

// Sélection d'item
function selectItem(item, type) {
    selectedItem = { ...item, type };
    document.getElementById('selectedItemActions').style.display = 'block';
    render();
}

// Modals
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
}

function centerOnYearZero() {
    const zeroX = yearToX(0);
    viewOffset.x = (window.innerWidth / 2) - zeroX;
    viewOffset.y = 0;
    updateViewOffset();
}

// Sauvegarde / Chargement
function saveToLocalStorage() {
    const data = {
        events,
        periods,
        artists,
        settings
    };
    localStorage.setItem('timelineData', JSON.stringify(data));
    alert('Sauvegarde réussie ! 💾');
}

function loadFromLocalStorage() {
    const data = localStorage.getItem('timelineData');
    if (data) {
        const parsed = JSON.parse(data);
        events = parsed.events || [];
        periods = parsed.periods || [];
        artists = parsed.artists || [];
        if (parsed.settings) {
            settings = parsed.settings;
            document.getElementById('startYear').value = settings.startYear;
            document.getElementById('endYear').value = settings.endYear;
            document.getElementById('scale').value = settings.scale;
            document.getElementById('timelineY').value = settings.timelineY;
            document.getElementById('timelineThickness').value = settings.timelineThickness || 40;
            document.getElementById('zoomLevel').value = settings.zoom;
            document.getElementById('pagesH').value = settings.pagesH || 3;
            document.getElementById('pagesV').value = settings.pagesV || 2;
            document.getElementById('textSize').value = settings.textSize || 12;
            document.getElementById('textSizeValue').textContent = (settings.textSize || 12) + 'px';
            document.getElementById('textBold').checked = settings.textBold || false;
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
