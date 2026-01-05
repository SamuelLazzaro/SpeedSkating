// ========== STATE MANAGEMENT ==========
const state = {
    // Configuration
    config: {
        totalLaps: 0,
        pointsFrequency: 'every_lap' // 'every_lap' or 'every_2_laps'
    },
    
    // Race state
    raceStarted: false,
    raceEnded: false,
    lapsRemaining: 0,
    
    // Athletes: Map<athleteNumber, athleteData>
    athletes: new Map(),
    
    // Current checkpoint tracking
    currentCheckpoint: {
        number: 0,
        assignedAthletes: [], // [{number, points}, ...]
        availablePoints: [] // [3, 2, 1] or [2, 1]
    },
    
    // Checkpoint history for undo
    checkpointHistory: [],
    
    // Action log
    actionLog: []
};

// Athlete data structure
class Athlete {
    constructor(number) {
        this.number = number;
        this.points = 0;
        this.status = 'normal'; // 'normal', 'lapped', 'disqualified'
        this.savedPoints = 0; // For lapped/disqualified recovery
    }
}

// ========== UTILITY FUNCTIONS ==========
function timestamp() {
    const now = new Date();
    return now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function logAction(message) {
    state.actionLog.push({
        timestamp: timestamp(),
        message: message
    });
    console.log(`[${timestamp()}] ${message}`);
    saveToLocalStorage();
}

function saveToLocalStorage() {
    try {
        const serializedState = {
            config: state.config,
            raceStarted: state.raceStarted,
            raceEnded: state.raceEnded,
            lapsRemaining: state.lapsRemaining,
            athletes: Array.from(state.athletes.entries()),
            currentCheckpoint: state.currentCheckpoint,
            checkpointHistory: state.checkpointHistory,
            actionLog: state.actionLog
        };
        localStorage.setItem('raceState', JSON.stringify(serializedState));
    } catch (error) {
        console.error('Errore nel salvataggio su localStorage:', error);
    }
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('raceState');
        if (saved) {
            const parsed = JSON.parse(saved);
            state.config = parsed.config;
            state.raceStarted = parsed.raceStarted;
            state.raceEnded = parsed.raceEnded;
            state.lapsRemaining = parsed.lapsRemaining;
            state.athletes = new Map(parsed.athletes);
            state.currentCheckpoint = parsed.currentCheckpoint;
            state.checkpointHistory = parsed.checkpointHistory;
            state.actionLog = parsed.actionLog;
            return true;
        }
    } catch (error) {
        console.error('Errore nel caricamento da localStorage:', error);
    }
    return false;
}

function clearLocalStorage() {
    localStorage.removeItem('raceState');
}

// ========== CONFIGURATION SCREEN ==========
const configScreen = document.getElementById('configScreen');
const raceScreen = document.getElementById('raceScreen');
const totalLapsInput = document.getElementById('totalLaps');
const toggleButtons = document.querySelectorAll('.toggle-btn');
const btnStartConfig = document.getElementById('btnStartConfig');

// Toggle button handling
toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        toggleButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Start configuration
btnStartConfig.addEventListener('click', () => {
    const laps = parseInt(totalLapsInput.value);
    if (!laps || laps < 1) {
        alert('❌ Inserisci un numero di giri valido (minimo 1)');
        return;
    }

    const activeToggle = document.querySelector('.toggle-btn.active');
    const frequency = activeToggle.dataset.frequency;

    state.config.totalLaps = laps;
    state.config.pointsFrequency = frequency;
    state.lapsRemaining = laps;

    logAction(`Configurazione: ${laps} giri, Traguardo ${frequency === 'every_lap' ? 'ogni giro' : 'ogni 2 giri'}`);

    // Show race screen
    configScreen.classList.add('hidden');
    raceScreen.classList.remove('hidden');

    updateRaceHeader();
    renderLeaderboard();
});

// ========== RACE SCREEN ==========
const btnStartRace = document.getElementById('btnStartRace');
const btnEndRace = document.getElementById('btnEndRace');
const btnOpenKeyboard = document.getElementById('btnOpenKeyboard');
const btnUndo = document.getElementById('btnUndo');
const badgeConfig = document.getElementById('badgeConfig');
const badgeLaps = document.getElementById('badgeLaps');
const leaderboardContent = document.getElementById('leaderboardContent');

function updateRaceHeader() {
    const freqText = state.config.pointsFrequency === 'every_lap' ? 'Ogni giro' : 'Ogni 2 giri';
    badgeConfig.textContent = `${state.config.totalLaps} giri • ${freqText}`;
    badgeLaps.textContent = `Giri rimanenti: ${state.lapsRemaining}`;
}

function startRace() {
    state.raceStarted = true;
    btnStartRace.classList.add('hidden');
    btnOpenKeyboard.classList.remove('hidden');
    
    logAction('Gara iniziata');
    saveToLocalStorage();
    
    initializeCheckpoint();
    renderLeaderboard();
}

function endRace() {
    showDialog(
        '🏁',
        'Terminare la Gara?',
        'La classifica verrà congelata e non potrai più modificarla. Vuoi continuare?',
        () => {
            state.raceEnded = true;
            btnEndRace.classList.add('hidden');
            btnOpenKeyboard.classList.add('hidden');
            btnUndo.classList.add('hidden');
            
            logAction('Gara terminata - Classifica congelata');
            saveToLocalStorage();
            renderLeaderboard();
            
            // TODO: Trigger PDF export
            alert('🏁 Gara terminata! (Export PDF in sviluppo)');
        }
    );
}

btnStartRace.addEventListener('click', startRace);
btnEndRace.addEventListener('click', endRace);

// ========== CHECKPOINT MANAGEMENT ==========
function initializeCheckpoint() {
    state.currentCheckpoint.number++;
    state.currentCheckpoint.assignedAthletes = [];
    
    // Determine if it's the final checkpoint
    const isFinal = isNextCheckpointFinal();
    state.currentCheckpoint.availablePoints = isFinal ? [3, 2, 1] : [2, 1];
    
    console.log(`Checkpoint ${state.currentCheckpoint.number} inizializzato, Finale: ${isFinal}, Punti: ${state.currentCheckpoint.availablePoints}`);
}

function isNextCheckpointFinal() {
    if (state.config.pointsFrequency === 'every_lap') {
        return state.lapsRemaining === 1;
    } else {
        return state.lapsRemaining === 2;
    }
}

function canAssignPoints(points) {
    return state.currentCheckpoint.availablePoints.includes(points);
}

function isAthleteAlreadyAssignedInCheckpoint(athleteNumber) {
    return state.currentCheckpoint.assignedAthletes.some(a => a.number === athleteNumber);
}

function assignPointsToAthlete(athleteNumber, points) {
    // Validation
    if (state.raceEnded) {
        alert('❌ La gara è terminata, non puoi più modificare la classifica');
        return false;
    }

    if (!canAssignPoints(points)) {
        alert(`❌ Non puoi assegnare ${points} punti in questo checkpoint`);
        return false;
    }

    if (isAthleteAlreadyAssignedInCheckpoint(athleteNumber)) {
        alert(`❌ L'atleta #${athleteNumber} ha già ricevuto punti in questo traguardo`);
        return false;
    }

    // Get or create athlete
    let athlete = state.athletes.get(athleteNumber);
    if (!athlete) {
        athlete = new Athlete(athleteNumber);
        state.athletes.set(athleteNumber, athlete);
        logAction(`Atleta #${athleteNumber} aggiunto alla classifica`);
    }

    // Check if disqualified
    if (athlete.status === 'disqualified') {
        alert(`❌ L'atleta #${athleteNumber} è squalificato. Riabilitalo prima di assegnare punti.`);
        return false;
    }

    // Assign points
    athlete.points += points;
    
    // Track assignment
    state.currentCheckpoint.assignedAthletes.push({ number: athleteNumber, points });
    
    // Remove from available points
    const index = state.currentCheckpoint.availablePoints.indexOf(points);
    state.currentCheckpoint.availablePoints.splice(index, 1);
    
    logAction(`Assegnati ${points} punti a #${athleteNumber} (Checkpoint ${state.currentCheckpoint.number})`);
    
    // Check if checkpoint is complete
    checkCheckpointCompletion();
    
    renderLeaderboard();
    updateKeyboardPoints();
    
    return true;
}

function checkCheckpointCompletion() {
    const isFinal = state.currentCheckpoint.availablePoints.length === 0 && 
                   (state.currentCheckpoint.assignedAthletes.length === 3 || 
                    state.currentCheckpoint.assignedAthletes.length === 2);
    
    if (state.currentCheckpoint.availablePoints.length === 0) {
        completeCheckpoint();
    }
}

function completeCheckpoint() {
    // Save checkpoint to history
    state.checkpointHistory.push({
        number: state.currentCheckpoint.number,
        athletes: [...state.currentCheckpoint.assignedAthletes],
        lapsBeforeDecrement: state.lapsRemaining
    });
    
    // Decrement laps
    const decrement = state.config.pointsFrequency === 'every_lap' ? 1 : 2;
    state.lapsRemaining -= decrement;
    
    logAction(`Checkpoint ${state.currentCheckpoint.number} completato - Giri: ${state.lapsRemaining}`);
    
    // Check if race should end
    if (state.lapsRemaining === 0) {
        btnEndRace.classList.remove('hidden');
    }
    
    // Autosave
    saveToLocalStorage();
    
    // Close keyboard and menu
    closeKeyboard();
    closeAthleteMenu();
    
    // Initialize next checkpoint
    if (state.lapsRemaining > 0) {
        initializeCheckpoint();
    }
    
    // Update UI
    updateRaceHeader();
    updateUndoButton();
    renderLeaderboard();
}

// ========== UNDO FUNCTIONALITY ==========
function canUndo() {
    return state.checkpointHistory.length > 0 && !state.raceEnded;
}

function undoLastCheckpoint() {
    if (!canUndo()) return;
    
    const lastCheckpoint = state.checkpointHistory[state.checkpointHistory.length - 1];
    
    showDialog(
        '↩️',
        'Annullare Ultimo Traguardo?',
        `Checkpoint ${lastCheckpoint.number}: ${lastCheckpoint.athletes.map(a => `#${a.number} (${a.points}pt)`).join(', ')}`,
        () => {
            // Remove points from athletes
            lastCheckpoint.athletes.forEach(assignment => {
                const athlete = state.athletes.get(assignment.number);
                if (athlete) {
                    athlete.points -= assignment.points;
                    logAction(`Rimossi ${assignment.points} punti da #${assignment.number} (Undo Checkpoint ${lastCheckpoint.number})`);
                }
            });
            
            // Restore laps
            state.lapsRemaining = lastCheckpoint.lapsBeforeDecrement;
            
            // Remove from history
            state.checkpointHistory.pop();
            
            // Reset current checkpoint to the undone one
            state.currentCheckpoint.number = lastCheckpoint.number;
            state.currentCheckpoint.assignedAthletes = [];
            const isFinal = isNextCheckpointFinal();
            state.currentCheckpoint.availablePoints = isFinal ? [3, 2, 1] : [2, 1];
            
            // Hide end button if it was showing
            if (state.lapsRemaining > 0) {
                btnEndRace.classList.add('hidden');
            }
            
            logAction(`Undo Checkpoint ${lastCheckpoint.number} completato`);
            saveToLocalStorage();
            
            updateRaceHeader();
            updateUndoButton();
            renderLeaderboard();
        }
    );
}

function updateUndoButton() {
    if (canUndo()) {
        btnUndo.classList.remove('hidden');
    } else {
        btnUndo.classList.add('hidden');
    }
}

btnUndo.addEventListener('click', undoLastCheckpoint);

// ========== LEADERBOARD RENDERING ==========
function renderLeaderboard() {
    if (state.athletes.size === 0) {
        leaderboardContent.innerHTML = `
            <div class="empty-leaderboard">
                <div class="empty-leaderboard-icon">🏆</div>
                <p>Nessun atleta in classifica</p>
                <p style="font-size: 14px; margin-top: 8px;">${state.raceStarted ? 'Assegna i primi punti per iniziare' : 'Premi "Start Gara" per iniziare'}</p>
            </div>
        `;
        return;
    }
    
    // Sort athletes by points (descending)
    const sortedAthletes = Array.from(state.athletes.values())
        .sort((a, b) => b.points - a.points);
    
    let html = `
        <table class="leaderboard-table">
            <thead>
                <tr>
                    <th style="width: 60px;">Pos.</th>
                    <th>Atleta</th>
                    <th style="width: 80px;">Punti</th>
                    <th style="width: 60px;">Stato</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sortedAthletes.forEach((athlete, index) => {
        const position = index + 1;
        const positionClass = position === 1 ? 'position-1' : 
                             position === 2 ? 'position-2' : 
                             position === 3 ? 'position-3' : 'position-other';
        
        const statusIcon = athlete.status === 'lapped' ? '🔄' : 
                          athlete.status === 'disqualified' ? '❌' : '';
        
        const rowClass = state.raceEnded ? '' : '';
        const clickable = !state.raceEnded;
        
        html += `
            <tr class="${rowClass}" data-athlete="${athlete.number}" ${clickable ? 'style="cursor: pointer;"' : ''}>
                <td>
                    <span class="position-badge ${positionClass}">${position}</span>
                </td>
                <td>
                    <span class="athlete-number">#${athlete.number}</span>
                </td>
                <td>
                    <span class="athlete-points">${athlete.points}</span>
                </td>
                <td>
                    <span class="athlete-status">${statusIcon}</span>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    leaderboardContent.innerHTML = html;
    
    // Add click handlers for athlete rows
    if (!state.raceEnded) {
        document.querySelectorAll('.leaderboard-table tbody tr').forEach(row => {
            row.addEventListener('click', (e) => {
                const athleteNumber = parseInt(row.dataset.athlete);
                showAthleteMenu(athleteNumber, e);
            });
        });
    }
}

// ========== ATHLETE MENU (Context Menu) ==========
const athleteMenu = document.getElementById('athleteMenu');
let currentMenuAthlete = null;

function showAthleteMenu(athleteNumber, event) {
    if (state.raceEnded) return;
    
    currentMenuAthlete = athleteNumber;
    const athlete = state.athletes.get(athleteNumber);
    
    let menuHTML = '';
    
    // Determine available options based on athlete status
    if (athlete.status === 'normal') {
        // Normal athlete - all options available
        menuHTML = `
            <button type="button" class="menu-item" data-action="assign-points">
                <span class="menu-item-icon">🎯</span>
                <span>Assegna punti traguardo</span>
            </button>
            <div class="menu-divider"></div>
            <button type="button" class="menu-item" data-action="modify-points">
                <span class="menu-item-icon">✏️</span>
                <span>Modifica punti liberi</span>
            </button>
            <div class="menu-divider"></div>
            <button type="button" class="menu-item" data-action="lap">
                <span class="menu-item-icon">🔄</span>
                <span>Doppia</span>
            </button>
            <button type="button" class="menu-item" data-action="disqualify">
                <span class="menu-item-icon">❌</span>
                <span>Squalifica</span>
            </button>
        `;
    } else if (athlete.status === 'lapped') {
        // Lapped athlete - only unlap and disqualify
        menuHTML = `
            <button type="button" class="menu-item" data-action="unlap">
                <span class="menu-item-icon">♻️</span>
                <span>Sdoppia</span>
            </button>
            <button type="button" class="menu-item" data-action="disqualify">
                <span class="menu-item-icon">❌</span>
                <span>Squalifica</span>
            </button>
        `;
    } else if (athlete.status === 'disqualified') {
        // Disqualified athlete - only reinstate
        menuHTML = `
            <button type="button" class="menu-item" data-action="reinstate">
                <span class="menu-item-icon">♻️</span>
                <span>Riabilita</span>
            </button>
        `;
    }
    
    athleteMenu.innerHTML = menuHTML;
    athleteMenu.classList.remove('hidden');
    
    // Position menu near click
    positionMenu(event);
    
    // Add event listeners
    athleteMenu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            handleMenuAction(item.dataset.action);
        });
    });
}

function positionMenu(event) {
    const menuWidth = 250;
    const menuHeight = 300;
    
    let left = event.clientX;
    let top = event.clientY;
    
    // Adjust if menu would go off-screen
    if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 10;
    }
    if (top + menuHeight > window.innerHeight) {
        top = window.innerHeight - menuHeight - 10;
    }
    
    athleteMenu.style.left = `${left}px`;
    athleteMenu.style.top = `${top}px`;
}

function closeAthleteMenu() {
    athleteMenu.classList.add('hidden');
    currentMenuAthlete = null;
}

function handleMenuAction(action) {
    const athleteNumber = currentMenuAthlete;
    const athlete = state.athletes.get(athleteNumber);
    
    switch (action) {
        case 'assign-points':
            showAssignPointsSubmenu(athleteNumber);
            break;
        case 'modify-points':
            showModifyPointsSubmenu(athleteNumber);
            break;
        case 'lap':
            lapAthlete(athleteNumber);
            closeAthleteMenu();
            break;
        case 'disqualify':
            disqualifyAthlete(athleteNumber);
            closeAthleteMenu();
            break;
        case 'unlap':
            unlapAthlete(athleteNumber);
            closeAthleteMenu();
            break;
        case 'reinstate':
            reinstateAthlete(athleteNumber);
            closeAthleteMenu();
            break;
    }
}

function showAssignPointsSubmenu(athleteNumber) {
    const points = state.currentCheckpoint.availablePoints;
    
    let submenuHTML = `
        <div class="submenu">
            <div class="submenu-title">Assegna Punti Traguardo</div>
            <div class="submenu-buttons">
    `;
    
    [3, 2, 1].forEach(p => {
        const disabled = !points.includes(p);
        submenuHTML += `
            <button type="button" class="submenu-btn" data-points="${p}" ${disabled ? 'disabled' : ''}>
                +${p}
            </button>
        `;
    });
    
    submenuHTML += `
            </div>
        </div>
    `;
    
    athleteMenu.innerHTML += submenuHTML;
    
    // Add event listeners
    athleteMenu.querySelectorAll('.submenu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const points = parseInt(btn.dataset.points);
            assignPointsToAthlete(athleteNumber, points);
            closeAthleteMenu();
        });
    });
}

function showModifyPointsSubmenu(athleteNumber) {
    let submenuHTML = `
        <div class="submenu">
            <div class="submenu-title">Modifica Punti (indipendente dai giri)</div>
            <div class="submenu-buttons">
                <button type="button" class="submenu-btn" data-modify="+1">+1</button>
                <button type="button" class="submenu-btn" data-modify="+2">+2</button>
                <button type="button" class="submenu-btn" data-modify="+3">+3</button>
                <button type="button" class="submenu-btn" data-modify="-1">-1</button>
                <button type="button" class="submenu-btn" data-modify="-2">-2</button>
                <button type="button" class="submenu-btn" data-modify="-3">-3</button>
            </div>
        </div>
    `;
    
    athleteMenu.innerHTML += submenuHTML;
    
    // Add event listeners
    athleteMenu.querySelectorAll('.submenu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const modify = parseInt(btn.dataset.modify);
            modifyAthletePointsFree(athleteNumber, modify);
            closeAthleteMenu();
        });
    });
}

function modifyAthletePointsFree(athleteNumber, pointsChange) {
    const athlete = state.athletes.get(athleteNumber);
    if (!athlete) return;
    
    const newPoints = Math.max(0, athlete.points + pointsChange);
    athlete.points = newPoints;
    
    logAction(`Modifica libera: ${pointsChange > 0 ? '+' : ''}${pointsChange} punti a #${athleteNumber} (totale: ${newPoints})`);
    saveToLocalStorage();
    renderLeaderboard();
}

function lapAthlete(athleteNumber) {
    const athlete = state.athletes.get(athleteNumber);
    if (!athlete) return;
    
    athlete.savedPoints = athlete.points;
    athlete.points = 0;
    athlete.status = 'lapped';
    
    logAction(`Atleta #${athleteNumber} doppiato (${athlete.savedPoints} punti conservati)`);
    saveToLocalStorage();
    renderLeaderboard();
}

function unlapAthlete(athleteNumber) {
    const athlete = state.athletes.get(athleteNumber);
    if (!athlete || athlete.status !== 'lapped') return;
    
    athlete.points = athlete.savedPoints;
    athlete.savedPoints = 0;
    athlete.status = 'normal';
    
    logAction(`Atleta #${athleteNumber} sdoppiato (${athlete.points} punti ripristinati)`);
    saveToLocalStorage();
    renderLeaderboard();
}

function disqualifyAthlete(athleteNumber) {
    const athlete = state.athletes.get(athleteNumber);
    if (!athlete) return;
    
    // If lapped, save those points instead
    if (athlete.status === 'lapped') {
        athlete.savedPoints = athlete.savedPoints; // Keep saved points from lapping
    } else {
        athlete.savedPoints = athlete.points;
    }
    
    athlete.points = 0;
    athlete.status = 'disqualified';
    
    logAction(`Atleta #${athleteNumber} squalificato (${athlete.savedPoints} punti conservati)`);
    saveToLocalStorage();
    renderLeaderboard();
}

function reinstateAthlete(athleteNumber) {
    const athlete = state.athletes.get(athleteNumber);
    if (!athlete || athlete.status !== 'disqualified') return;
    
    athlete.points = athlete.savedPoints;
    athlete.savedPoints = 0;
    athlete.status = 'normal';
    
    logAction(`Atleta #${athleteNumber} riabilitato (${athlete.points} punti ripristinati)`);
    saveToLocalStorage();
    renderLeaderboard();
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    if (!athleteMenu.contains(e.target) && !e.target.closest('.leaderboard-table tbody tr')) {
        closeAthleteMenu();
    }
});

// ========== KEYBOARD OVERLAY ==========
const keyboardOverlay = document.getElementById('keyboardOverlay');
const keyboardDisplay = document.getElementById('keyboardDisplay');
const keyboardPointsGrid = document.getElementById('keyboardPointsGrid');
const btnCloseKeyboard = document.getElementById('btnCloseKeyboard');
let currentKeyboardNumber = '';

function openKeyboard() {
    keyboardOverlay.classList.remove('hidden');
    currentKeyboardNumber = '';
    updateKeyboardDisplay();
    updateKeyboardPoints();
}

function closeKeyboard() {
    keyboardOverlay.classList.add('hidden');
    currentKeyboardNumber = '';
}

function updateKeyboardDisplay() {
    if (currentKeyboardNumber === '') {
        keyboardDisplay.innerHTML = '<span class="keyboard-display-placeholder">Digita il numero...</span>';
    } else {
        keyboardDisplay.innerHTML = `<span class="keyboard-display-number">#${currentKeyboardNumber}</span>`;
    }
}

function updateKeyboardPoints() {
    const points = state.currentCheckpoint.availablePoints;
    
    let html = '';
    [3, 2, 1].forEach(p => {
        const disabled = !points.includes(p);
        html += `
            <button type="button" class="keyboard-points-btn" data-points="${p}" ${disabled ? 'disabled' : ''}>
                +${p}
            </button>
        `;
    });
    
    keyboardPointsGrid.innerHTML = html;
    
    // Add event listeners
    keyboardPointsGrid.querySelectorAll('.keyboard-points-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentKeyboardNumber === '') {
                alert('❌ Digita prima il numero dell\'atleta');
                return;
            }
            
            const athleteNumber = parseInt(currentKeyboardNumber);
            const points = parseInt(btn.dataset.points);
            
            if (assignPointsToAthlete(athleteNumber, points)) {
                currentKeyboardNumber = '';
                updateKeyboardDisplay();
            }
        });
    });
}

btnOpenKeyboard.addEventListener('click', openKeyboard);
btnCloseKeyboard.addEventListener('click', closeKeyboard);

// Keyboard key handling
document.querySelectorAll('.keyboard-key').forEach(key => {
    key.addEventListener('click', () => {
        const value = key.dataset.key;
        
        if (value === 'C') {
            currentKeyboardNumber = '';
        } else if (value === 'backspace') {
            currentKeyboardNumber = currentKeyboardNumber.slice(0, -1);
        } else {
            currentKeyboardNumber += value;
        }
        
        updateKeyboardDisplay();
    });
});

// ========== DIALOG SYSTEM ==========
const dialogOverlay = document.getElementById('dialogOverlay');
const dialogIcon = document.getElementById('dialogIcon');
const dialogTitle = document.getElementById('dialogTitle');
const dialogMessage = document.getElementById('dialogMessage');
const dialogCancel = document.getElementById('dialogCancel');
const dialogConfirm = document.getElementById('dialogConfirm');
let dialogCallback = null;

function showDialog(icon, title, message, onConfirm) {
    dialogIcon.textContent = icon;
    dialogTitle.textContent = title;
    dialogMessage.textContent = message;
    dialogCallback = onConfirm;
    dialogOverlay.classList.remove('hidden');
}

function closeDialog() {
    dialogOverlay.classList.add('hidden');
    dialogCallback = null;
}

dialogCancel.addEventListener('click', closeDialog);
dialogConfirm.addEventListener('click', () => {
    if (dialogCallback) {
        dialogCallback();
    }
    closeDialog();
});

// ========== INITIALIZATION ==========
// Try to load from localStorage
if (loadFromLocalStorage()) {
    // Resume from saved state
    configScreen.classList.add('hidden');
    raceScreen.classList.remove('hidden');
    updateRaceHeader();
    renderLeaderboard();
    
    if (state.raceStarted) {
        btnStartRace.classList.add('hidden');
        btnOpenKeyboard.classList.remove('hidden');
    }
    
    if (state.lapsRemaining === 0 && !state.raceEnded) {
        btnEndRace.classList.remove('hidden');
    }
    
    updateUndoButton();
}
