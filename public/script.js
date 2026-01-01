const state = {
    habits: [],
    notes: '',
    completedToday: {},
    todayDate: new Date().toISOString().split('T')[0],
    lastLoadedDate: null,
};

const API_ENDPOINT = '/api/load';
const SYNC_ENDPOINT = '/api/sync';

// Initialize app
async function init() {
    updateDateDisplay();
    await loadHabitsFromNotion();
    attachEventListeners();
}

function updateDateDisplay() {
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('dateDisplay').textContent = today.toLocaleDateString('en-US', options);
}

/**
 * Load habits from Notion database
 * Fetches the latest entry for today and displays it
 */
async function loadHabitsFromNotion() {
    try {
        showStatus('Loading your habits...', 'loading');
        
        const response = await fetch(API_ENDPOINT, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error('Failed to load habits from Notion');
        }

        const data = await response.json();

        if (data.found) {
            // Habits found for today
            state.habits = data.habits || [];
            state.completedToday = data.completedToday || {};
            state.notes = data.notes || '';
            state.lastLoadedDate = data.date;

            document.getElementById('notesInput').value = state.notes;
            renderHabits();
            showStatus('Habits loaded from Notion', 'success');
        } else {
            // No habits for today yet - start fresh
            state.habits = [];
            state.completedToday = {};
            state.notes = '';
            renderHabits();
            showStatus('No habits yet for today', 'success');
        }
    } catch (error) {
        console.error('Load error:', error);
        showStatus(`Error loading habits: ${error.message}`, 'error');
        renderHabits(); // Show empty state
    }
}

function renderHabits() {
    const habitList = document.getElementById('habitList');
    habitList.innerHTML = '';

    if (state.habits.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'text-align: center; color: var(--color-text-secondary); padding: 20px;';
        emptyMsg.textContent = 'No habits added yet. Add one to get started!';
        habitList.appendChild(emptyMsg);
    } else {
        state.habits.forEach((habit, index) => {
            const isChecked = state.completedToday[index] || false;
            const item = document.createElement('div');
            item.className = 'habit-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'habit-checkbox';
            checkbox.checked = isChecked;
            checkbox.addEventListener('change', () => toggleHabit(index));

            const label = document.createElement('label');
            label.className = 'habit-text';
            label.textContent = habit;
            label.style.cursor = 'pointer';
            label.addEventListener('click', (e) => {
                if (e.target === label) {
                    checkbox.click();
                }
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'habit-delete';
            deleteBtn.innerHTML = '✕';
            deleteBtn.addEventListener('click', () => deleteHabit(index));

            item.appendChild(checkbox);
            item.appendChild(label);
            item.appendChild(deleteBtn);
            habitList.appendChild(item);
        });
    }

    updateHabitCount();
    updateProgress();
}

function updateHabitCount() {
    const count = state.habits.length;
    document.getElementById('habitCount').textContent = `${count} habit${count !== 1 ? 's' : ''}`;
}

function toggleHabit(index) {
    state.completedToday[index] = !state.completedToday[index];
    updateProgress();
}

function deleteHabit(index) {
    state.habits.splice(index, 1);
    delete state.completedToday[index];
    state.completedToday = Object.keys(state.completedToday)
        .filter(k => parseInt(k) < index || parseInt(k) > index)
        .reduce((obj, k) => {
            const oldIndex = parseInt(k);
            const newIndex = oldIndex > index ? oldIndex - 1 : oldIndex;
            obj[newIndex] = state.completedToday[k];
            return obj;
        }, {});
    renderHabits();
}

function updateProgress() {
    if (state.habits.length === 0) {
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressPercent').textContent = '0%';
        return;
    }

    const completed = Object.values(state.completedToday).filter(Boolean).length;
    const percentage = Math.round((completed / state.habits.length) * 100);
    document.getElementById('progressFill').style.width = percentage + '%';
    document.getElementById('progressPercent').textContent = percentage + '%';
}

function attachEventListeners() {
    document.getElementById('addHabitBtn').addEventListener('click', addHabit);
    document.getElementById('newHabitInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addHabit();
    });

    document.getElementById('resetDayBtn').addEventListener('click', resetDay);
    document.getElementById('syncBtn').addEventListener('click', syncToNotion);

    document.getElementById('notesInput').addEventListener('input', (e) => {
        state.notes = e.target.value;
        document.getElementById('charCount').textContent = e.target.value.length;
    });
}

function addHabit() {
    const input = document.getElementById('newHabitInput');
    const habitText = input.value.trim();

    if (!habitText) {
        showStatus('Please enter a habit name', 'error');
        return;
    }

    if (state.habits.length >= 15) {
        showStatus('Maximum 15 habits reached', 'error');
        return;
    }

    state.habits.push(habitText);
    input.value = '';
    renderHabits();
    showStatus('Habit added successfully', 'success');
}

function resetDay() {
    if (Object.values(state.completedToday).some(Boolean)) {
        state.completedToday = {};
        renderHabits();
        showStatus('Day reset - all habits unchecked', 'success');
    } else {
        showStatus('No habits to reset', 'error');
    }
}

async function syncToNotion() {
    if (state.habits.length === 0) {
        showStatus('Add habits before syncing', 'error');
        return;
    }

    const syncBtn = document.getElementById('syncBtn');
    syncBtn.disabled = true;

    try {
        const completed = Object.values(state.completedToday).filter(Boolean).length;
        const percentage = state.habits.length > 0 ? Math.round((completed / state.habits.length) * 100) : 0;

        const payload = {
            date: state.todayDate,
            habits: state.habits,
            completed: Object.entries(state.completedToday)
                .filter(([_, v]) => v)
                .map(([k, _]) => state.habits[parseInt(k)])
                .filter(Boolean),
            completionPercentage: percentage,
            notes: state.notes,
        };

        showStatus('Syncing to Notion...', 'loading');

        const response = await fetch(SYNC_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Sync failed');
        }

        const result = await response.json();
        showStatus('✓ Synced to Notion successfully', 'success');
    } catch (error) {
        console.error('Sync error:', error);
        showStatus(`Sync failed: ${error.message}`, 'error');
    } finally {
        syncBtn.disabled = false;
    }
}

function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message show ${type}`;

    if (type !== 'loading') {
        setTimeout(() => {
            statusEl.classList.remove('show');
        }, 3000);
    }
}

// Initialize on load
init();
