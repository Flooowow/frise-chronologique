// ==================== DONNÉES ====================
let cards = [];
let currentCardId = null;
let currentEditId = null;
let currentQuizIndex = 0;
let quizCards = [];
let quizStats = { correct: 0, wrong: 0 };
let quizHistory = []; // Historique des sessions
let quizMode = 'all'; // 'all' ou 'towork'

// ==================== INITIALISATION ====================
document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  loadHistoryFromLocalStorage();
  setupEventListeners();
  renderCardsList();
});

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  // Basculer entre modes
  document.getElementById('editModeBtn').addEventListener('click', () => switchMode('edit'));
  document.getElementById('quizModeBtn').addEventListener('click', () => switchMode('quiz'));

  // Mode édition
  document.getElementById('addCardBtn').addEventListener('click', createNewCard);
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    sortCards(e.target.value);
    renderCardsList();
  });
  document.getElementById('cardImage').addEventListener('change', handleImageUpload);
  document.getElementById('saveCardBtn').addEventListener('click', saveCard);
  document.getElementById('cancelEditBtn').addEventListener('click', cancelEdit);
  document.getElementById('deleteCardBtn').addEventListener('click', deleteCard);
  document.getElementById('toggleToWorkBtn').addEventListener('click', toggleToWork);
  document.getElementById('resetStatsBtn').addEventListener('click', resetCardStats);

  // Export / Import
  document.getElementById('exportBtn').addEventListener('click', exportCards);
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', importCards);

  // Mode quiz
  document.getElementById('verifyBtn').addEventListener('click', verifyAnswer);
  
  const quizInput = document.getElementById('quizInput');
  
  // Gestion globale de ENTER dans le quiz
  let quizAnswered = false;
  
  quizInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (!quizAnswered) {
        // Première pression : vérifier
        verifyAnswer();
        quizAnswered = true;
      } else {
        // Deuxième pression : carte suivante
        nextQuizCard();
        quizAnswered = false;
      }
    }
  });
  
  // Reset du flag quand on charge une nouvelle carte
  window.resetQuizAnswered = () => { quizAnswered = false; };
  
  document.getElementById('nextCardBtn').addEventListener('click', () => {
    nextQuizCard();
    quizAnswered = false;
  });
  document.getElementById('prevCardBtn').addEventListener('click', prevQuizCard);
  document.getElementById('restartQuizBtn').addEventListener('click', startQuiz);
  document.getElementById('viewHistoryBtn').addEventListener('click', showHistoryModal);
  document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);

  // Sélecteurs de mode quiz
  document.querySelectorAll('.quiz-mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.quiz-mode-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      quizMode = e.target.dataset.mode;
      startQuiz();
    });
  });
}

// ==================== MODE SWITCHING ====================
function switchMode(mode) {
  const editMode = document.getElementById('editMode');
  const quizMode = document.getElementById('quizMode');
  const editBtn = document.getElementById('editModeBtn');
  const quizBtn = document.getElementById('quizModeBtn');

  if (mode === 'edit') {
    editMode.classList.add('active');
    quizMode.classList.remove('active');
    editBtn.classList.add('active');
    quizBtn.classList.remove('active');
  } else {
    editMode.classList.remove('active');
    quizMode.classList.add('active');
    editBtn.classList.remove('active');
    quizBtn.classList.add('active');
    startQuiz();
  }
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==================== CONFIRMATION MODAL ====================
function showConfirm(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    
    modal.style.display = 'flex';
    
    const handleYes = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(true);
    };
    
    const handleNo = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(false);
    };
    
    const yesBtn = document.getElementById('confirmYes');
    const noBtn = document.getElementById('confirmNo');
    
    yesBtn.addEventListener('click', handleYes);
    noBtn.addEventListener('click', handleNo);
    
    // ESC pour annuler
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleNo();
      }
    };
    document.addEventListener('keydown', handleEscape);
    
    function cleanup() {
      yesBtn.removeEventListener('click', handleYes);
      noBtn.removeEventListener('click', handleNo);
      document.removeEventListener('keydown', handleEscape);
    }
  });
}

// ==================== CARDS MANAGEMENT ====================
function createNewCard() {
  const newCard = {
    id: Date.now(),
    artist: '',
    title: '',
    date: '',
    image: null,
    order: cards.length,
    // Nouvelles propriétés
    toWork: false,
    stats: {
      played: 0,
      correct: 0,
      wrong: 0,
      successRate: 0
    }
  };
  cards.push(newCard);
  renderCardsList();
  selectCard(newCard.id);
  showToast('Nouvelle carte créée', 'success');
  saveToLocalStorage();
}

function selectCard(cardId) {
  currentEditId = cardId;
  const card = cards.find(c => c.id === cardId);
  if (!card) return;

  // S'assurer que card a les nouvelles propriétés
  if (!card.stats) {
    card.stats = { played: 0, correct: 0, wrong: 0, successRate: 0 };
  }
  if (card.toWork === undefined) {
    card.toWork = false;
  }

  // Mise à jour UI
  document.querySelectorAll('.card-item').forEach(item => {
    item.classList.toggle('active', parseInt(item.dataset.cardId) === cardId);
  });

  // Afficher l'éditeur
  document.querySelector('.editor-content .empty-state')?.remove();
  const editor = document.getElementById('cardEditor');
  editor.style.display = 'block';

  // Remplir le formulaire
  document.getElementById('cardArtist').value = card.artist || '';
  document.getElementById('cardTitle').value = card.title || '';
  document.getElementById('cardDate').value = card.date || '';

  // Afficher l'image si elle existe
  const preview = document.getElementById('imagePreview');
  if (card.image) {
    preview.innerHTML = `<img src="${card.image}" alt="Aperçu">`;
  } else {
    preview.innerHTML = '';
  }

  // Mettre à jour le bouton "À travailler"
  const toWorkBtn = document.getElementById('toggleToWorkBtn');
  if (card.toWork) {
    toWorkBtn.textContent = '✅ À travailler';
    toWorkBtn.classList.add('active');
  } else {
    toWorkBtn.textContent = '⭐ À travailler';
    toWorkBtn.classList.remove('active');
  }

  // Afficher les statistiques
  document.getElementById('statPlayed').textContent = card.stats.played;
  document.getElementById('statCorrect').textContent = card.stats.correct;
  document.getElementById('statWrong').textContent = card.stats.wrong;
  document.getElementById('statRate').textContent = card.stats.successRate + '%';
}

function saveCard() {
  const card = cards.find(c => c.id === currentEditId);
  if (!card) return;

  const artist = document.getElementById('cardArtist').value.trim();
  const title = document.getElementById('cardTitle').value.trim();
  const date = document.getElementById('cardDate').value.trim();

  if (!artist || !title || !date) {
    showToast('Veuillez remplir tous les champs obligatoires', 'error');
    return;
  }

  if (!card.image) {
    showToast('Veuillez ajouter une image', 'error');
    return;
  }

  card.artist = artist;
  card.title = title;
  card.date = date;

  renderCardsList();
  saveToLocalStorage();
  showToast('Carte enregistrée !', 'success');
}

async function deleteCard() {
  if (!currentEditId) return;
  
  const confirmed = await showConfirm(
    'Supprimer la carte ?',
    'Voulez-vous vraiment supprimer cette carte ? Cette action est irréversible.'
  );
  
  if (!confirmed) return;

  cards = cards.filter(c => c.id !== currentEditId);
  currentEditId = null;
  
  // Réinitialiser l'éditeur
  document.getElementById('cardEditor').style.display = 'none';
  const editorContent = document.querySelector('.editor-content');
  if (!document.querySelector('.empty-state')) {
    editorContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎨</div>
        <h3>Aucune carte sélectionnée</h3>
        <p>Sélectionnez une carte ou créez-en une nouvelle</p>
      </div>
    `;
  }

  renderCardsList();
  saveToLocalStorage();
  showToast('Carte supprimée', 'info');
}

function toggleToWork() {
  if (!currentEditId) return;
  const card = cards.find(c => c.id === currentEditId);
  if (!card) return;

  card.toWork = !card.toWork;
  
  const btn = document.getElementById('toggleToWorkBtn');
  if (card.toWork) {
    btn.textContent = '✅ À travailler';
    btn.classList.add('active');
    showToast('Carte ajoutée à "À travailler"', 'success');
  } else {
    btn.textContent = '⭐ À travailler';
    btn.classList.remove('active');
    showToast('Carte retirée de "À travailler"', 'info');
  }

  saveToLocalStorage();
  renderCardsList();
}

async function resetCardStats() {
  if (!currentEditId) return;
  
  const confirmed = await showConfirm(
    'Réinitialiser les statistiques ?',
    'Voulez-vous remettre à zéro toutes les statistiques de cette carte ?'
  );
  
  if (!confirmed) return;

  const card = cards.find(c => c.id === currentEditId);
  if (!card) return;

  card.stats = { played: 0, correct: 0, wrong: 0, successRate: 0 };
  
  document.getElementById('statPlayed').textContent = '0';
  document.getElementById('statCorrect').textContent = '0';
  document.getElementById('statWrong').textContent = '0';
  document.getElementById('statRate').textContent = '0%';

  saveToLocalStorage();
  showToast('Statistiques réinitialisées', 'success');
}

function cancelEdit() {
  if (currentEditId) {
    const card = cards.find(c => c.id === currentEditId);
    if (card && !card.artist && !card.title && !card.date) {
      // Si la carte est vide, la supprimer
      cards = cards.filter(c => c.id !== currentEditId);
      renderCardsList();
      saveToLocalStorage();
    }
  }
  
  currentEditId = null;
  document.getElementById('cardEditor').style.display = 'none';
  const editorContent = document.querySelector('.editor-content');
  if (!document.querySelector('.empty-state')) {
    editorContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎨</div>
        <h3>Aucune carte sélectionnée</h3>
        <p>Sélectionnez une carte ou créez-en une nouvelle</p>
      </div>
    `;
  }
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const card = cards.find(c => c.id === currentEditId);
    if (card) {
      card.image = event.target.result;
      document.getElementById('imagePreview').innerHTML = 
        `<img src="${event.target.result}" alt="Aperçu">`;
      saveToLocalStorage();
    }
  };
  reader.readAsDataURL(file);
}

function sortCards(sortType) {
  switch(sortType) {
    case 'date-asc':
      cards.sort((a, b) => {
        const dateA = parseInt(a.date) || 0;
        const dateB = parseInt(b.date) || 0;
        return dateA - dateB;
      });
      break;
    case 'date-desc':
      cards.sort((a, b) => {
        const dateA = parseInt(a.date) || 0;
        const dateB = parseInt(b.date) || 0;
        return dateB - dateA;
      });
      break;
    case 'artist':
      cards.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
      break;
    case 'order':
    default:
      cards.sort((a, b) => a.order - b.order);
      break;
  }
}

function renderCardsList() {
  const container = document.getElementById('cardsList');
  
  if (cards.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <p style="text-align: center; color: #6b7280;">Aucune carte pour le moment</p>
      </div>
    `;
    return;
  }

  container.innerHTML = cards.map(card => {
    const displayTitle = card.title || 'Sans titre';
    const displayArtist = card.artist || 'Artiste inconnu';
    const displayDate = card.date || '?';
    const thumbnail = card.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60"%3E%3Crect fill="%23e5e7eb" width="60" height="60"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="24"%3E🎨%3C/text%3E%3C/svg%3E';
    const toWorkBadge = card.toWork ? '<span class="towork-badge">⭐</span>' : '';

    return `
      <div class="card-item ${currentEditId === card.id ? 'active' : ''}" 
           data-card-id="${card.id}"
           onclick="selectCard(${card.id})">
        <img src="${thumbnail}" alt="${displayTitle}" class="card-item-thumb">
        <div class="card-item-info">
          <div class="card-item-title">${escapeHtml(displayTitle)} ${toWorkBadge}</div>
          <div class="card-item-meta">${escapeHtml(displayArtist)} - ${escapeHtml(displayDate)}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== QUIZ MODE ====================
function startQuiz() {
  // Filtrer les cartes selon le mode
  let availableCards = cards.filter(c => c.artist && c.title && c.date && c.image);
  
  if (quizMode === 'towork') {
    availableCards = availableCards.filter(c => c.toWork);
    if (availableCards.length === 0) {
      showToast('Aucune carte marquée "À travailler"', 'error');
      document.getElementById('quizEmpty').style.display = 'block';
      document.getElementById('quizCard').style.display = 'none';
      document.getElementById('quizResult').style.display = 'none';
      return;
    }
  }
  
  if (availableCards.length === 0) {
    document.getElementById('quizEmpty').style.display = 'block';
    document.getElementById('quizCard').style.display = 'none';
    document.getElementById('quizResult').style.display = 'none';
    return;
  }

  // Mélanger les cartes
  quizCards = shuffleArray([...availableCards]);
  
  // Réinitialiser
  currentQuizIndex = 0;
  quizStats = { correct: 0, wrong: 0 };
  
  document.getElementById('quizEmpty').style.display = 'none';
  document.getElementById('quizCard').style.display = 'block';
  document.getElementById('quizResult').style.display = 'none';
  
  showQuizCard();
}

function showQuizCard() {
  if (currentQuizIndex >= quizCards.length) {
    showQuizResults();
    return;
  }

  const card = quizCards[currentQuizIndex];
  
  // Mise à jour de l'image
  document.getElementById('quizCardImage').src = card.image;
  
  // Réinitialiser l'input et le feedback
  const input = document.getElementById('quizInput');
  input.value = '';
  input.disabled = false;
  input.focus(); // Focus pour pouvoir taper directement
  
  document.getElementById('verifyBtn').disabled = false;
  document.getElementById('quizFeedback').style.display = 'none';
  
  // Reset du flag ENTER
  if (window.resetQuizAnswered) window.resetQuizAnswered();
  
  // Mise à jour de la progression
  updateQuizProgress();
  
  // Mise à jour des boutons de navigation
  document.getElementById('prevCardBtn').disabled = currentQuizIndex === 0;
  document.getElementById('nextCardBtn').disabled = false;
}

function verifyAnswer() {
  const input = document.getElementById('quizInput');
  const userAnswer = input.value.trim().toLowerCase();
  
  if (!userAnswer) {
    showToast('Veuillez entrer une réponse', 'error');
    return;
  }

  const card = quizCards[currentQuizIndex];
  const correctAnswer = `${card.artist} - ${card.title} - ${card.date}`;
  
  // Vérification flexible
  const artistMatch = userAnswer.includes(card.artist.toLowerCase());
  const titleMatch = userAnswer.includes(card.title.toLowerCase());
  
  const isCorrect = artistMatch && titleMatch;
  
  // Mise à jour des stats du quiz
  if (isCorrect) {
    quizStats.correct++;
  } else {
    quizStats.wrong++;
  }

  // 📊 Mise à jour des stats de la carte
  if (!card.stats) {
    card.stats = { played: 0, correct: 0, wrong: 0, successRate: 0 };
  }
  card.stats.played++;
  if (isCorrect) {
    card.stats.correct++;
  } else {
    card.stats.wrong++;
  }
  // Calculer le taux de réussite
  card.stats.successRate = Math.round((card.stats.correct / card.stats.played) * 100);
  
  saveToLocalStorage();
  
  // Afficher le feedback
  const feedback = document.getElementById('quizFeedback');
  feedback.style.display = 'block';
  feedback.className = `quiz-feedback ${isCorrect ? 'correct' : 'wrong'}`;
  
  document.querySelector('.feedback-icon').textContent = isCorrect ? '✅' : '❌';
  document.querySelector('.feedback-text').textContent = isCorrect ? 
    'Bravo ! Bonne réponse' : 'Pas tout à fait...';
  
  // Afficher la réponse correcte avec l'erreur en gras
  const correctAnswerEl = document.getElementById('correctAnswer');
  if (isCorrect) {
    correctAnswerEl.textContent = correctAnswer;
  } else {
    // Mettre en gras ce qui manque/est faux
    let displayAnswer = '';
    
    if (!artistMatch) {
      displayAnswer += `<strong>${card.artist}</strong> - `;
    } else {
      displayAnswer += `${card.artist} - `;
    }
    
    if (!titleMatch) {
      displayAnswer += `<strong>${card.title}</strong> - `;
    } else {
      displayAnswer += `${card.title} - `;
    }
    
    displayAnswer += card.date;
    
    // Afficher aussi ce que l'utilisateur a écrit
    correctAnswerEl.innerHTML = `
      <div style="margin-bottom: 10px;">
        <strong>Votre réponse :</strong> <span style="color: var(--danger);">${escapeHtml(input.value)}</span>
      </div>
      <div>
        <strong>Réponse correcte :</strong> ${displayAnswer}
      </div>
    `;
  }
  
  // Désactiver l'input
  input.disabled = true;
  document.getElementById('verifyBtn').disabled = true;
  
  // Remettre le focus sur l'input pour que ENTER fonctionne
  setTimeout(() => input.focus(), 100);
  
  updateQuizProgress();
}

function nextQuizCard() {
  if (currentQuizIndex < quizCards.length - 1) {
    currentQuizIndex++;
    showQuizCard();
  } else {
    showQuizResults();
  }
}

function prevQuizCard() {
  if (currentQuizIndex > 0) {
    currentQuizIndex--;
    showQuizCard();
  }
}

function updateQuizProgress() {
  const progressText = document.getElementById('progressText');
  const progressFill = document.getElementById('progressFill');
  
  progressText.textContent = `${currentQuizIndex + 1} / ${quizCards.length}`;
  
  const percentage = ((currentQuizIndex + 1) / quizCards.length) * 100;
  progressFill.style.width = percentage + '%';
}

function showQuizResults() {
  document.getElementById('quizCard').style.display = 'none';
  document.getElementById('quizResult').style.display = 'block';
  
  const total = quizStats.correct + quizStats.wrong;
  const percentage = total > 0 ? Math.round((quizStats.correct / total) * 100) : 0;
  
  document.getElementById('correctCount').textContent = quizStats.correct;
  document.getElementById('wrongCount').textContent = quizStats.wrong;
  document.getElementById('scorePercent').textContent = percentage + '%';
  
  // 📈 Sauvegarder dans l'historique
  const historyEntry = {
    date: new Date().toISOString(),
    mode: quizMode,
    total: total,
    correct: quizStats.correct,
    wrong: quizStats.wrong,
    percentage: percentage
  };
  quizHistory.push(historyEntry);
  saveHistoryToLocalStorage();
  
  // Désactiver le bouton suivant
  document.getElementById('nextCardBtn').disabled = true;
}

// ==================== UTILS ====================
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== EXPORT / IMPORT ====================
function exportCards() {
  if (cards.length === 0) {
    showToast('Aucune carte à exporter', 'error');
    return;
  }

  const data = {
    version: '1.0',
    exported: new Date().toISOString(),
    totalCards: cards.length,
    cards: cards
  };

  const dataStr = JSON.stringify(data, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  
  // Nom du fichier avec date
  const date = new Date().toISOString().split('T')[0];
  link.download = `quizart-backup-${date}.json`;
  
  link.click();
  URL.revokeObjectURL(url);
  
  showToast(`✅ ${cards.length} carte(s) sauvegardée(s) !`, 'success');
}

function importCards(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      
      // Validation
      if (!imported.cards || !Array.isArray(imported.cards)) {
        showToast('❌ Fichier invalide', 'error');
        return;
      }

      // Confirmation si des cartes existent déjà
      if (cards.length > 0) {
        const replace = await showConfirm(
          'Remplacer ou ajouter ?',
          `Vous avez déjà ${cards.length} carte(s).\n\nCliquez "Oui" pour REMPLACER toutes vos cartes par les ${imported.cards.length} carte(s) du fichier.\n\nCliquez "Non" pour AJOUTER les cartes aux existantes.`
        );

        if (replace) {
          cards = imported.cards;
          showToast(`✅ ${imported.cards.length} carte(s) restaurée(s) !`, 'success');
        } else {
          // Ajouter avec nouveaux IDs pour éviter les conflits
          const newCards = imported.cards.map(card => ({
            ...card,
            id: Date.now() + Math.random(),
            order: cards.length + card.order
          }));
          cards = [...cards, ...newCards];
          showToast(`✅ ${newCards.length} carte(s) ajoutée(s) !`, 'success');
        }
      } else {
        cards = imported.cards;
        showToast(`✅ ${imported.cards.length} carte(s) restaurée(s) !`, 'success');
      }

      // Réinitialiser l'éditeur
      currentEditId = null;
      document.getElementById('cardEditor').style.display = 'none';
      
      renderCardsList();
      saveToLocalStorage();
      
    } catch (err) {
      console.error(err);
      showToast('❌ Erreur : fichier corrompu', 'error');
    }
  };
  
  reader.readAsText(file);
  event.target.value = ''; // Reset input
}

// ==================== HISTORY ====================
function showHistoryModal() {
  const modal = document.getElementById('historyModal');
  modal.style.display = 'flex';
  renderHistory();
}

function closeHistoryModal() {
  document.getElementById('historyModal').style.display = 'none';
}

function renderHistory() {
  const historyList = document.getElementById('historyList');
  const historyChart = document.getElementById('historyChart');
  const historyEmpty = document.querySelector('.history-empty');

  if (quizHistory.length === 0) {
    historyEmpty.style.display = 'block';
    historyChart.style.display = 'none';
    historyList.innerHTML = '';
    return;
  }

  historyEmpty.style.display = 'none';
  historyChart.style.display = 'block';

  // Dessiner le graphique
  drawProgressChart();

  // Afficher la liste (inversée pour avoir les plus récents en premier)
  historyList.innerHTML = [...quizHistory].reverse().map((entry, index) => {
    const date = new Date(entry.date);
    const dateStr = date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const modeLabel = entry.mode === 'all' ? '📚 Toutes les cartes' : '⭐ À travailler';

    return `
      <div class="history-item">
        <div class="history-header">
          <span class="history-date">${dateStr}</span>
          <span class="history-mode">${modeLabel}</span>
        </div>
        <div class="history-stats">
          <div class="history-stat">
            <span class="history-stat-value">${entry.total}</span>
            <span class="history-stat-label">Questions</span>
          </div>
          <div class="history-stat">
            <span class="history-stat-value" style="color: var(--success)">${entry.correct}</span>
            <span class="history-stat-label">Réussies</span>
          </div>
          <div class="history-stat">
            <span class="history-stat-value" style="color: var(--gold)">${entry.percentage}%</span>
            <span class="history-stat-label">Score</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function drawProgressChart() {
  const canvas = document.getElementById('progressChart');
  const ctx = canvas.getContext('2d');
  
  // Configuration
  const width = canvas.width = canvas.offsetWidth;
  const height = canvas.height = 300;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Effacer
  ctx.clearRect(0, 0, width, height);

  if (quizHistory.length === 0) return;

  // Prendre les 10 dernières sessions
  const data = quizHistory.slice(-10);
  const maxPoints = Math.max(...data.map(d => d.percentage), 100);
  const step = chartWidth / (data.length - 1 || 1);

  // Fond
  ctx.fillStyle = '#FAF7F2';
  ctx.fillRect(padding, padding, chartWidth, chartHeight);

  // Grille
  ctx.strokeStyle = '#E8DCC8';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(padding + chartWidth, y);
    ctx.stroke();

    // Labels Y
    ctx.fillStyle = '#5A5A5A';
    ctx.font = '12px Georgia';
    ctx.textAlign = 'right';
    ctx.fillText((100 - i * 25) + '%', padding - 10, y + 4);
  }

  // Ligne de progression
  ctx.strokeStyle = '#7C1D1D';
  ctx.lineWidth = 3;
  ctx.beginPath();

  data.forEach((entry, index) => {
    const x = padding + step * index;
    const y = padding + chartHeight - (entry.percentage / 100) * chartHeight;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  // Points
  data.forEach((entry, index) => {
    const x = padding + step * index;
    const y = padding + chartHeight - (entry.percentage / 100) * chartHeight;
    
    // Point
    ctx.fillStyle = '#D4AF37';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#7C1D1D';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label X (index)
    ctx.fillStyle = '#5A5A5A';
    ctx.font = '11px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('#' + (quizHistory.length - data.length + index + 1), x, height - 15);
  });

  // Titre
  ctx.fillStyle = '#7C1D1D';
  ctx.font = 'bold 16px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText('📈 Évolution de vos performances', width / 2, 25);
}

async function clearHistory() {
  const confirmed = await showConfirm(
    'Effacer l\'historique ?',
    'Voulez-vous vraiment supprimer tout l\'historique de vos quiz ? Cette action est irréversible.'
  );
  
  if (!confirmed) return;
  
  quizHistory = [];
  saveHistoryToLocalStorage();
  renderHistory();
  showToast('Historique effacé', 'info');
}

// ==================== STORAGE ====================
function saveToLocalStorage() {
  try {
    localStorage.setItem('flashcards', JSON.stringify(cards));
  } catch (e) {
    console.error('Erreur de sauvegarde:', e);
  }
}

function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem('flashcards');
    if (saved) {
      cards = JSON.parse(saved);
      // S'assurer que toutes les cartes ont les nouvelles propriétés
      cards.forEach(card => {
        if (!card.stats) {
          card.stats = { played: 0, correct: 0, wrong: 0, successRate: 0 };
        }
        if (card.toWork === undefined) {
          card.toWork = false;
        }
      });
    }
  } catch (e) {
    console.error('Erreur de chargement:', e);
    cards = [];
  }
}

function saveHistoryToLocalStorage() {
  try {
    localStorage.setItem('quizHistory', JSON.stringify(quizHistory));
  } catch (e) {
    console.error('Erreur sauvegarde historique:', e);
  }
}

function loadHistoryFromLocalStorage() {
  try {
    const saved = localStorage.getItem('quizHistory');
    if (saved) {
      quizHistory = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Erreur chargement historique:', e);
    quizHistory = [];
  }
}

// ==================== EXPORT / IMPORT ====================
function exportData() {
  const dataStr = JSON.stringify(cards, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `flashcards-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('Export réussi !', 'success');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (Array.isArray(imported)) {
        cards = imported;
        renderCardsList();
        saveToLocalStorage();
        showToast('Import réussi !', 'success');
      }
    } catch (err) {
      showToast('Erreur d\'import', 'error');
    }
  };
  reader.readAsText(file);
}

// Rendre les fonctions globales pour onclick
window.selectCard = selectCard;
window.closeHistoryModal = closeHistoryModal;
