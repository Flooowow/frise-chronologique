const { useState, useRef, useEffect } = React;
const { Plus, Settings, Trash2, Edit2 } = lucide;

function TimelineApp() {
  const [menuOpen, setMenuOpen] = useState(true);
  const [settings, setSettings] = useState({
    startYear: -500,
    endYear: 2000,
    scale: 100,
    pagesH: 3,
    pagesV: 2
  });
  const [events, setEvents] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [artistPeriods, setArtistPeriods] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [timelineOffset, setTimelineOffset] = useState(300);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [draggedItem, setDraggedItem] = useState(null);
  const [resizingItem, setResizingItem] = useState(null);
  const canvasRef = useRef(null);

  const [showEventModal, setShowEventModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showArtistModal, setShowArtistModal] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [eventForm, setEventForm] = useState({ name: '', year: '', image: null, y: 100, width: 120, height: 120 });
  const [periodForm, setPeriodForm] = useState({ name: '', startYear: '', endYear: '', color: '#4299e1', y: 50, height: 40 });
  const [artistForm, setArtistForm] = useState({ name: '', birthYear: '', deathYear: '', y: 200 });

  const pageWidth = 1400;
  const pageHeight = 800;
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setEventForm({ ...eventForm, image: event.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const addEvent = () => {
    if (eventForm.name && eventForm.year && eventForm.image) {
      if (editMode && selectedItem) {
        setEvents(events.map(e => e.id === selectedItem.id ? { ...eventForm, id: selectedItem.id } : e));
      } else {
        setEvents([...events, { ...eventForm, id: Date.now() }]);
      }
      setEventForm({ name: '', year: '', image: null, y: 100, width: 120, height: 120 });
      setShowEventModal(false);
      setEditMode(false);
      setSelectedItem(null);
    }
  };

  const addPeriod = () => {
    if (periodForm.name && periodForm.startYear && periodForm.endYear) {
      if (editMode && selectedItem) {
        setPeriods(periods.map(p => p.id === selectedItem.id ? { ...periodForm, id: selectedItem.id } : p));
      } else {
        setPeriods([...periods, { ...periodForm, id: Date.now() }]);
      }
      setPeriodForm({ name: '', startYear: '', endYear: '', color: '#4299e1', y: 50, height: 40 });
      setShowPeriodModal(false);
      setEditMode(false);
      setSelectedItem(null);
    }
  };
       
  const addArtist = () => {
    if (artistForm.name && artistForm.birthYear && artistForm.deathYear) {
      if (editMode && selectedItem) {
        setArtistPeriods(artistPeriods.map(a => a.id === selectedItem.id ? { ...artistForm, id: selectedItem.id } : a));
      } else {
        setArtistPeriods([...artistPeriods, { ...artistForm, id: Date.now() }]);
      }
      setArtistForm({ name: '', birthYear: '', deathYear: '', y: 200 });
      setShowArtistModal(false);
      setEditMode(false);
      setSelectedItem(null);
    }
  };

  const deleteItem = (item, type) => {
    if (type === 'event') {
      setEvents(events.filter(e => e.id !== item.id));
    } else if (type === 'period') {
      setPeriods(periods.filter(p => p.id !== item.id));
    } else if (type === 'artist') {
      setArtistPeriods(artistPeriods.filter(a => a.id !== item.id));
    }
    setSelectedItem(null);
  };

  const editItem = (item, type) => {
    setSelectedItem({ ...item, type });
    setEditMode(true);
    if (type === 'event') {
      setEventForm(item);
      setShowEventModal(true);
    } else if (type === 'period') {
      setPeriodForm(item);
      setShowPeriodModal(true);
    } else if (type === 'artist') {
      setArtistForm(item);
      setShowArtistModal(true);
    }
  };

  const yearToX = (year) => {
    const totalYears = settings.endYear - settings.startYear;
    const totalWidth = pageWidth * settings.pagesH;
    return ((year - settings.startYear) / totalYears) * totalWidth;
  };

  const handleCanvasMouseDown = (e) => {
    if (e.target === canvasRef.current || e.target.tagName === 'svg') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - viewOffset.x, y: e.clientY - viewOffset.y });
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (isDragging) {
      setViewOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  // Handle dragging events
  const handleEventMouseDown = (e, event) => {
    e.stopPropagation();
    if (!e.target.classList.contains('resize-handle') && !e.target.classList.contains('resize-corner')) {
      setDraggedItem({ item: event, type: 'event', startY: e.clientY - event.y, startX: e.clientX });
    }
  };

  const handleEventMouseMove = (e) => {
    if (draggedItem && draggedItem.type === 'event') {
      const newY = e.clientY - draggedItem.startY;
      setEvents(events.map(ev => 
        ev.id === draggedItem.item.id ? { ...ev, y: Math.max(0, newY) } : ev
      ));
    }
  };

  const handleEventMouseUp = () => {
    setDraggedItem(null);
  };

  // Handle resizing events (corner resize - proportional)
  const handleCornerResizeStart = (e, event) => {
    e.stopPropagation();
    setResizingItem({ 
      item: event, 
      type: 'corner',
      startX: e.clientX, 
      startY: e.clientY, 
      startWidth: event.width,
      startHeight: event.height 
    });
  };

  const handleCornerResizeMove = (e) => {
    if (resizingItem && resizingItem.type === 'corner') {
      const deltaX = e.clientX - resizingItem.startX;
      const deltaY = e.clientY - resizingItem.startY;
      const delta = Math.max(deltaX, deltaY);
      const newWidth = Math.max(80, resizingItem.startWidth + delta);
      const newHeight = Math.max(80, resizingItem.startHeight + delta);
      setEvents(events.map(ev => 
        ev.id === resizingItem.item.id ? { ...ev, width: newWidth, height: newHeight } : ev
      ));
    }
  };

  // Handle resizing events (vertical only)
  const handleResizeStart = (e, event) => {
    e.stopPropagation();
    setResizingItem({ item: event, type: 'vertical', startY: e.clientY, startHeight: event.height });
  };

  const handleResizeMove = (e) => {
    if (resizingItem && resizingItem.type === 'vertical') {
      const deltaY = e.clientY - resizingItem.startY;
      const newHeight = Math.max(80, resizingItem.startHeight + deltaY);
      setEvents(events.map(ev => 
        ev.id === resizingItem.item.id ? { ...ev, height: newHeight } : ev
      ));
    }
  };

  const handleResizeEnd = () => {
    setResizingItem(null);
  };

  // Handle dragging periods
  const handlePeriodMouseDown = (e, period) => {
    e.stopPropagation();
    if (!e.target.classList.contains('resize-handle-period')) {
      setDraggedItem({ 
        item: period, 
        type: 'period', 
        startY: e.clientY - period.y,
        startX: e.clientX - yearToX(parseInt(period.startYear))
      });
    }
  };

  const handlePeriodMouseMove = (e) => {
    if (draggedItem && draggedItem.type === 'period') {
      const newY = e.clientY - draggedItem.startY;
      const newX = e.clientX - draggedItem.startX;
      const newStartYear = Math.round(((newX) / (pageWidth * settings.pagesH)) * (settings.endYear - settings.startYear) + settings.startYear);
      const duration = parseInt(draggedItem.item.endYear) - parseInt(draggedItem.item.startYear);
      const newEndYear = newStartYear + duration;
      
      setPeriods(periods.map(p => 
        p.id === draggedItem.item.id ? { 
          ...p, 
          y: Math.max(0, newY),
          startYear: String(newStartYear),
          endYear: String(newEndYear)
        } : p
      ));
    }
  };

  // Handle dragging artists
  const handleArtistMouseDown = (e, artist) => {
    e.stopPropagation();
    setDraggedItem({ 
      item: artist, 
      type: 'artist', 
      startY: e.clientY - artist.y,
      startX: e.clientX - yearToX(parseInt(artist.birthYear))
    });
  };

  const handleArtistMouseMove = (e) => {
    if (draggedItem && draggedItem.type === 'artist') {
      const newY = e.clientY - draggedItem.startY;
      const newX = e.clientX - draggedItem.startX;
      const newBirthYear = Math.round(((newX) / (pageWidth * settings.pagesH)) * (settings.endYear - settings.startYear) + settings.startYear);
      const duration = parseInt(draggedItem.item.deathYear) - parseInt(draggedItem.item.birthYear);
      const newDeathYear = newBirthYear + duration;
      
      setArtistPeriods(artistPeriods.map(a => 
        a.id === draggedItem.item.id ? { 
          ...a, 
          y: Math.max(0, newY),
          birthYear: String(newBirthYear),
          deathYear: String(newDeathYear)
        } : a
      ));
    }
  };
  // Render l'application
  const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<TimelineApp />);
            
  // Handle resizing periods
  const handlePeriodResizeStart = (e, period) => {
    e.stopPropagation();
    setResizingItem({ item: period, type: 'period', startY: e.clientY, startHeight: period.height });
  };

  const handlePeriodResizeMove = (e) => {
    if (resizingItem && resizingItem.type === 'period') {
      const deltaY = e.clientY - resizingItem.startY;
      const newHeight = Math.max(30, resizingItem.startHeight + deltaY);
      setPeriods(periods.map(p => 
        p.id === resizingItem.item.id ? { ...p, height: newHeight } : p
      ));
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleCanvasMouseMove);
      window.addEventListener('mouseup', handleCanvasMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleCanvasMouseMove);
        window.removeEventListener('mouseup', handleCanvasMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  useEffect(() => {
    if (draggedItem) {
      if (draggedItem.type === 'event') {
        window.addEventListener('mousemove', handleEventMouseMove);
        window.addEventListener('mouseup', handleEventMouseUp);
        return () => {
          window.removeEventListener('mousemove', handleEventMouseMove);
          window.removeEventListener('mouseup', handleEventMouseUp);
        };
      } else if (draggedItem.type === 'period') {
        window.addEventListener('mousemove', handlePeriodMouseMove);
        window.addEventListener('mouseup', handleEventMouseUp);
        return () => {
          window.removeEventListener('mousemove', handlePeriodMouseMove);
          window.removeEventListener('mouseup', handleEventMouseUp);
        };
      } else if (draggedItem.type === 'artist') {
        window.addEventListener('mousemove', handleArtistMouseMove);
        window.addEventListener('mouseup', handleEventMouseUp);
        return () => {
          window.removeEventListener('mousemove', handleArtistMouseMove);
          window.removeEventListener('mouseup', handleEventMouseUp);
        };
      }
    }
  }, [draggedItem, events, periods, artistPeriods]);

  useEffect(() => {
    if (resizingItem) {
      if (resizingItem.type === 'period') {
        window.addEventListener('mousemove', handlePeriodResizeMove);
        window.addEventListener('mouseup', handleResizeEnd);
        return () => {
          window.removeEventListener('mousemove', handlePeriodResizeMove);
          window.removeEventListener('mouseup', handleResizeEnd);
        };
      } else if (resizingItem.type === 'corner') {
        window.addEventListener('mousemove', handleCornerResizeMove);
        window.addEventListener('mouseup', handleResizeEnd);
        return () => {
          window.removeEventListener('mousemove', handleCornerResizeMove);
          window.removeEventListener('mouseup', handleResizeEnd);
        };
      } else {
        window.addEventListener('mousemove', handleResizeMove);
        window.addEventListener('mouseup', handleResizeEnd);
        return () => {
          window.removeEventListener('mousemove', handleResizeMove);
          window.removeEventListener('mouseup', handleResizeEnd);
        };
      }
    }
  }, [resizingItem, events, periods]);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className={`bg-white shadow-lg transition-all duration-300 ${menuOpen ? 'w-80' : 'w-0'} overflow-hidden`}>
        <div className="p-6 h-full overflow-y-auto">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Paramètres</h2>
          
          <div className="space-y-4 mb-6">
            <h3 className="font-semibold text-lg text-gray-700">Frise</h3>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Année début</label>
              <input
                type="number"
                value={settings.startYear}
                onChange={(e) => setSettings({ ...settings, startYear: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Année fin</label>
              <input
                type="number"
                value={settings.endYear}
                onChange={(e) => setSettings({ ...settings, endYear: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Échelle (graduation)</label>
              <input
                type="number"
                value={settings.scale}
                onChange={(e) => setSettings({ ...settings, scale: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Pages horizontales</label>
              <input
                type="number"
                min="1"
                value={settings.pagesH}
                onChange={(e) => setSettings({ ...settings, pagesH: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Pages verticales</label>
              <input
                type="number"
                min="1"
                value={settings.pagesV}
                onChange={(e) => setSettings({ ...settings, pagesV: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Position frise (Y)</label>
              <input
                type="range"
                min="50"
                max="600"
                value={timelineOffset}
                onChange={(e) => setTimelineOffset(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => { setShowEventModal(true); setEditMode(false); }}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded flex items-center justify-center gap-2 hover:bg-blue-700"
            >
              <Plus size={18} /> Ajouter événement
            </button>
            <button
              onClick={() => { setShowPeriodModal(true); setEditMode(false); }}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded flex items-center justify-center gap-2 hover:bg-purple-700"
            >
              <Plus size={18} /> Ajouter période
            </button>
            <button
              onClick={() => { setShowArtistModal(true); setEditMode(false); }}
              className="w-full bg-green-600 text-white py-2 px-4 rounded flex items-center justify-center gap-2 hover:bg-green-700"
            >
              <Plus size={18} /> Ajouter artiste
            </button>
          </div>

          {/* Selected Item Actions */}
          {selectedItem && (
            <div className="mt-6 p-4 bg-gray-50 rounded">
              <h4 className="font-semibold mb-3">Élément sélectionné</h4>
              <div className="space-y-2">
                <button
                  onClick={() => editItem(selectedItem, selectedItem.type)}
                  className="w-full bg-yellow-500 text-white py-2 px-4 rounded flex items-center justify-center gap-2 hover:bg-yellow-600"
                >
                  <Edit2 size={16} /> Modifier
                </button>
                <button
                  onClick={() => deleteItem(selectedItem, selectedItem.type)}
                  className="w-full bg-red-500 text-white py-2 px-4 rounded flex items-center justify-center gap-2 hover:bg-red-600"
                >
                  <Trash2 size={16} /> Supprimer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="fixed left-0 top-1/2 bg-blue-600 text-white p-2 rounded-r z-50 hover:bg-blue-700"
      >
        {menuOpen ? '◀' : '▶'}
      </button>

      {/* Canvas Area */}
      <div 
        ref={canvasRef}
        className="flex-1 overflow-auto relative bg-gray-50"
        onMouseDown={handleCanvasMouseDown}
        style={{ 
          cursor: isDragging ? 'grabbing' : 'grab',
          width: '100%',
          height: '100%'
        }}
      >
        <div 
          className="relative"
          style={{
            width: pageWidth * settings.pagesH,
            height: pageHeight * settings.pagesV,
            transform: `translate(${viewOffset.x}px, ${viewOffset.y}px)`,
            minWidth: pageWidth * settings.pagesH,
            minHeight: pageHeight * settings.pagesV
          }}
        >
          {/* Timeline */}
          <svg width={pageWidth * settings.pagesH} height={pageHeight * settings.pagesV}>
            {/* Timeline base - thick bar */}
            <rect
              x={0}
              y={timelineOffset - 20}
              width={pageWidth * settings.pagesH}
              height={40}
              fill="#1a202c"
              stroke="#000"
              strokeWidth="2"
            />
            
            {/* Graduations with lines */}
            {(() => {
              const graduations = [];
              for (let year = settings.startYear; year <= settings.endYear; year += settings.scale) {
                const x = yearToX(year);
                graduations.push(
                  <g key={year}>
                    {/* Vertical graduation line */}
                    <line 
                      x1={x} 
                      y1={timelineOffset - 20} 
                      x2={x} 
                      y2={timelineOffset + 20} 
                      stroke="#fff" 
                      strokeWidth="3" 
                    />
                    {/* Year text inside */}
                    <text 
                      x={x} 
                      y={timelineOffset} 
                      fill="white" 
                      fontSize="16" 
                      fontWeight="bold"
                      textAnchor="middle" 
                      dominantBaseline="middle"
                    >
                      {year}
                    </text>
                  </g>
                );
              }
              return graduations;
            })()}

            {/* Periods */}
            {periods.map(period => {
              const startX = yearToX(parseInt(period.startYear));
              const endX = yearToX(parseInt(period.endYear));
              return (
                <g 
                  key={period.id}
                  onMouseDown={(e) => handlePeriodMouseDown(e.nativeEvent, period)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedItem({ ...period, type: 'period' });
                  }}
                  style={{ cursor: draggedItem?.item.id === period.id ? 'grabbing' : 'grab' }}
                >
                  <rect
                    x={startX}
                    y={period.y}
                    width={endX - startX}
                    height={period.height}
                    fill={period.color}
                    opacity="0.8"
                    stroke={selectedItem?.id === period.id ? '#000' : 'none'}
                    strokeWidth="3"
                  />
                  <text
                    x={startX + (endX - startX) / 2}
                    y={period.y + period.height / 2 - 8}
                    fill="white"
                    fontSize="13"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    pointerEvents="none"
                  >
                    {period.name}
                  </text>
                  <text
                    x={startX + (endX - startX) / 2}
                    y={period.y + period.height / 2 + 8}
                    fill="white"
                    fontSize="11"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    pointerEvents="none"
                  >
                    {period.startYear} - {period.endYear}
                  </text>
                  {/* Resize handle for period */}
                  <rect
                    className="resize-handle-period"
                    x={startX}
                    y={period.y + period.height - 8}
                    width={endX - startX}
                    height={8}
                    fill="rgba(255,255,255,0.3)"
                    style={{ cursor: 'ns-resize' }}
                    onMouseDown={(e) => handlePeriodResizeStart(e.nativeEvent, period)}
                  />
                </g>
              );
            })}

            {/* Artist Periods */}
            {artistPeriods.map(artist => {
              const birthX = yearToX(parseInt(artist.birthYear));
              const deathX = yearToX(parseInt(artist.deathYear));
              return (
                <g 
                  key={artist.id}
                  onMouseDown={(e) => handleArtistMouseDown(e.nativeEvent, artist)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedItem({ ...artist, type: 'artist' });
                  }}
                  style={{ cursor: draggedItem?.item.id === artist.id ? 'grabbing' : 'grab' }}
                >
                  {/* Artist line */}
                  <line
                    x1={birthX}
                    y1={artist.y}
                    x2={deathX}
                    y2={artist.y}
                    stroke={selectedItem?.id === artist.id ? '#000' : '#666'}
                    strokeWidth={selectedItem?.id === artist.id ? '4' : '2'}
                    strokeDasharray="5,5"
                  />
                  {/* Birth marker */}
                  <circle cx={birthX} cy={artist.y} r="5" fill="#333" />
                  {/* Death marker */}
                  <circle cx={deathX} cy={artist.y} r="5" fill="#333" />
                  {/* Artist name */}
                  <text
                    x={birthX + (deathX - birthX) / 2}
                    y={artist.y - 10}
                    fill="#333"
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {artist.name}
                  </text>
                  <text
                    x={birthX + (deathX - birthX) / 2}
                    y={artist.y + 18}
                    fill="#666"
                    fontSize="10"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {artist.birthYear} à {artist.deathYear}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Events */}
          {events.map(event => {
            const x = yearToX(parseInt(event.year));
            return (
              <div
                key={event.id}
                onMouseDown={(e) => handleEventMouseDown(e, event)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItem({ ...event, type: 'event' });
                }}
                style={{
                  position: 'absolute',
                  left: x - event.width / 2,
                  top: event.y,
                  width: event.width,
                  height: event.height,
                  cursor: draggedItem?.item.id === event.id ? 'grabbing' : 'grab',
                  border: selectedItem?.id === event.id ? '3px solid #000' : '2px solid #ccc',
                  userSelect: 'none'
                }}
                className="bg-white rounded shadow-lg p-2 flex flex-col items-center"
              >
                <img 
                  src={event.image} 
                  alt={event.name} 
                  style={{ 
                    width: '100%', 
                    height: event.height - 40, 
                    objectFit: 'cover',
                    pointerEvents: 'none'
                  }} 
                  className="rounded" 
                />
                <div className="text-center text-xs mt-1 font-semibold" style={{ pointerEvents: 'none' }}>{event.name}</div>
                <div className="text-center text-xs text-gray-600" style={{ pointerEvents: 'none' }}>{event.year}</div>
                
                {/* Corner resize handle (proportional) */}
                <div
                  className="resize-corner"
                  onMouseDown={(e) => handleCornerResizeStart(e, event)}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 16,
                    height: 16,
                    cursor: 'nwse-resize',
                    background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.3) 50%)',
                    borderBottomRightRadius: 4
                  }}
                />
                
                {/* Connection line */}
                <svg style={{ position: 'absolute', top: event.height, left: event.width / 2, width: 2, height: Math.abs(timelineOffset - event.y - event.height), pointerEvents: 'none' }}>
                  <line x1="1" y1="0" x2="1" y2={Math.abs(timelineOffset - event.y - event.height)} stroke="#666" strokeWidth="2" strokeDasharray="4" />
                </svg>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-xl font-bold mb-4">{editMode ? 'Modifier' : 'Ajouter'} un événement</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nom de l'œuvre"
                value={eventForm.name}
                onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
              <input
                type="number"
                placeholder="Année"
                value={eventForm.year}
                onChange={(e) => setEventForm({ ...eventForm, year: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full px-3 py-2 border rounded"
              />
              {eventForm.image && <img src={eventForm.image} alt="Preview" className="w-full h-32 object-cover rounded" />}
              <div className="flex gap-2">
                <button onClick={addEvent} className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                  {editMode ? 'Modifier' : 'Ajouter'}
                </button>
                <button onClick={() => { setShowEventModal(false); setEditMode(false); }} className="flex-1 bg-gray-400 text-white py-2 rounded hover:bg-gray-500">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Period Modal */}
      {showPeriodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-xl font-bold mb-4">{editMode ? 'Modifier' : 'Ajouter'} une période</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nom de la période"
                value={periodForm.name}
                onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
              <input
                type="number"
                placeholder="Année début"
                value={periodForm.startYear}
                onChange={(e) => setPeriodForm({ ...periodForm, startYear: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
              <input
                type="number"
                placeholder="Année fin"
                value={periodForm.endYear}
                onChange={(e) => setPeriodForm({ ...periodForm, endYear: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
              <input
                type="color"
                value={periodForm.color}
                onChange={(e) => setPeriodForm({ ...periodForm, color: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
              <div className="flex gap-2">
                <button onClick={addPeriod} className="flex-1 bg-purple-600 text-white py-2 rounded hover:bg-purple-700">
                  {editMode ? 'Modifier' : 'Ajouter'}
                </button>
                <button onClick={() => { setShowPeriodModal(false); setEditMode(false); }} className="flex-1 bg-gray-400 text-white py-2 rounded hover:bg-gray-500">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Artist Modal */}
      {showArtistModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-xl font-bold mb-4">{editMode ? 'Modifier' : 'Ajouter'} un artiste</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nom de l'artiste"
                value={artistForm.name}
                onChange={(e) => setArtistForm({ ...artistForm, name: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
              <input
                type="number"
                placeholder="Année de naissance"
                value={artistForm.birthYear}
                onChange={(e) => setArtistForm({ ...artistForm, birthYear: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
              <input
                type="number"
                placeholder="Année de décès"
                value={artistForm.deathYear}
                onChange={(e) => setArtistForm({ ...artistForm, deathYear: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
              <div className="flex gap-2">
                <button onClick={addArtist} className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700">
                  {editMode ? 'Modifier' : 'Ajouter'}
                </button>
                <button onClick={() => { setShowArtistModal(false); setEditMode(false); }} className="flex-1 bg-gray-400 text-white py-2 rounded hover:bg-gray-500">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
