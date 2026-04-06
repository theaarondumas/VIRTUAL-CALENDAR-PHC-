const STORAGE_KEY = 'pto-request-calendar-v2';
const palette = ['#f97316', '#22c55e', '#3b82f6', '#ec4899', '#eab308', '#14b8a6', '#a855f7', '#ef4444', '#06b6d4', '#84cc16'];

const defaultTechs = ['Aaron', 'Joel', 'Mike', 'Nuri', 'Rick', 'Scott']
  .map((name, index) => ({ id: crypto.randomUUID(), name, color: palette[index % palette.length] }));

const state = {
  currentDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedTechId: null,
  techs: [],
  requests: {},
  selectionStartKey: null,
  selectionEndKey: null,
  isDragging: false,
  didDrag: false
};

const techList = document.getElementById('techList');
const legendRow = document.getElementById('legendRow');
const calendarGrid = document.getElementById('calendarGrid');
const weekdayRow = document.getElementById('weekdayRow');
const monthLabel = document.getElementById('monthLabel');
const monthCount = document.getElementById('monthCount');
const totalCount = document.getElementById('totalCount');
const selectionSummary = document.getElementById('selectionSummary');
const submitRequestBtn = document.getElementById('submitRequestBtn');
const clearSelectionBtn = document.getElementById('clearSelectionBtn');
const manageTeamBtn = document.getElementById('manageTeamBtn');
const teamModal = document.getElementById('teamModal');
const teamEditor = document.getElementById('teamEditor');
const addTechBtn = document.getElementById('addTechBtn');
const saveTeamBtn = document.getElementById('saveTeamBtn');
const confirmModal = document.getElementById('confirmModal');
const confirmBody = document.getElementById('confirmBody');
const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
const confirmSubmitBtn = document.getElementById('confirmSubmitBtn');
const requestNote = document.getElementById('requestNote');
const importInput = document.getElementById('importInput');

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    state.techs = defaultTechs;
    state.selectedTechId = defaultTechs[0]?.id ?? null;
    state.requests = {};
    persist();
    return;
  }
  try {
    const parsed = JSON.parse(saved);
    state.techs = parsed.techs?.length ? parsed.techs : defaultTechs;
    state.selectedTechId = parsed.selectedTechId || state.techs[0]?.id || null;
    state.requests = parsed.requests || {};
  } catch {
    state.techs = defaultTechs;
    state.selectedTechId = defaultTechs[0]?.id ?? null;
    state.requests = {};
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    techs: state.techs,
    selectedTechId: state.selectedTechId,
    requests: state.requests
  }));
}

function getSelectedTech() {
  return state.techs.find(tech => tech.id === state.selectedTechId) || state.techs[0] || null;
}

function formatKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatPrettyDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getRequestsForDay(key) {
  return state.requests[key] || [];
}

function dateKeysInRange(startKey, endKey) {
  if (!startKey || !endKey) return [];
  let start = parseKey(startKey);
  let end = parseKey(endKey);
  if (start > end) [start, end] = [end, start];

  const keys = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    keys.push(formatKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function clearSelection() {
  state.selectionStartKey = null;
  state.selectionEndKey = null;
  state.isDragging = false;
  state.didDrag = false;
}

function updateSelectionSummary() {
  const tech = getSelectedTech();
  const keys = dateKeysInRange(state.selectionStartKey, state.selectionEndKey);

  if (!tech || keys.length === 0) {
    selectionSummary.className = 'selection-summary empty';
    selectionSummary.textContent = 'No dates selected yet.';
    submitRequestBtn.disabled = true;
    return;
  }

  const start = parseKey(keys[0]);
  const end = parseKey(keys[keys.length - 1]);
  const dayLabel = keys.length === 1 ? '1 day selected' : `${keys.length} days selected`;
  selectionSummary.className = 'selection-summary';
  selectionSummary.innerHTML = `
    <div class="selection-title">Ready to submit</div>
    <div class="selection-main">${tech.name}</div>
    <div class="selection-sub">${formatPrettyDate(start)}${keys.length > 1 ? ` → ${formatPrettyDate(end)}` : ''}</div>
    <div class="selection-sub">${dayLabel}</div>
  `;
  submitRequestBtn.disabled = false;
}

function renderWeekdays() {
  if (weekdayRow.children.length) return;
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
    const el = document.createElement('div');
    el.className = 'weekday';
    el.textContent = day;
    weekdayRow.appendChild(el);
  });
}

function renderTechs() {
  techList.innerHTML = '';
  state.techs.forEach(tech => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `tech-chip ${tech.id === state.selectedTechId ? 'active' : ''}`;
    button.innerHTML = `
      <span class="color-dot" style="background:${tech.color}"></span>
      <span class="tech-name">${tech.name}</span>
    `;
    button.addEventListener('click', () => {
      state.selectedTechId = tech.id;
      persist();
      renderTechs();
      updateSelectionSummary();
    });
    techList.appendChild(button);
  });
}

function renderLegend() {
  legendRow.innerHTML = '';
  state.techs.forEach(tech => {
    const pill = document.createElement('div');
    pill.className = 'legend-pill';
    pill.style.background = tech.color;
    pill.textContent = tech.name;
    legendRow.appendChild(pill);
  });
}

function isKeyInsideSelection(key) {
  return dateKeysInRange(state.selectionStartKey, state.selectionEndKey).includes(key);
}

function paintCellFromRequests(cell, requests) {
  if (!requests.length) return;

  if (requests.length === 1) {
    const tech = state.techs.find(item => item.id === requests[0].techId);
    if (!tech) return;
    cell.style.background = `linear-gradient(180deg, ${hexToRgba(tech.color, 0.42)}, ${hexToRgba(tech.color, 0.2)})`;
    cell.classList.add('has-request');
    return;
  }

  const colors = requests
    .map(req => state.techs.find(item => item.id === req.techId)?.color)
    .filter(Boolean);

  if (!colors.length) return;
  const segments = colors.map((color, index) => {
    const start = Math.round((index / colors.length) * 100);
    const end = Math.round(((index + 1) / colors.length) * 100);
    return `${hexToRgba(color, 0.36)} ${start}%, ${hexToRgba(color, 0.36)} ${end}%`;
  }).join(', ');
  cell.style.background = `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), linear-gradient(90deg, ${segments})`;
  cell.classList.add('has-request');
}

function renderCalendar() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);
  start.setDate(1 - firstDay.getDay());

  monthLabel.textContent = firstDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  calendarGrid.innerHTML = '';

  const todayKey = formatKey(new Date());
  const selectedKeys = dateKeysInRange(state.selectionStartKey, state.selectionEndKey);

  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = formatKey(date);
    const requests = getRequestsForDay(key);

    const cell = document.getElementById('dayCellTemplate').content.firstElementChild.cloneNode(true);
    const num = cell.querySelector('.day-number');
    const events = cell.querySelector('.day-events');
    const badge = cell.querySelector('.day-badge');

    num.textContent = date.getDate();
    cell.dataset.key = key;

    if (date.getMonth() !== month) cell.classList.add('inactive');
    if (key === todayKey) cell.classList.add('today');
    if (selectedKeys.includes(key)) cell.classList.add('in-range');
    if (key === state.selectionStartKey) cell.classList.add('range-start');
    if (key === state.selectionEndKey) cell.classList.add('range-end');

    requests.forEach(req => {
      const tech = state.techs.find(t => t.id === req.techId);
      if (!tech) return;
      const pill = document.createElement('div');
      pill.className = 'event-pill';
      pill.style.background = tech.color;
      pill.textContent = tech.name;
      events.appendChild(pill);
    });

    if (requests.length) {
      badge.textContent = requests.length === 1 ? 'Pending' : `${requests.length} pending`;
      paintCellFromRequests(cell, requests);
    }

    cell.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      state.isDragging = true;
      state.didDrag = false;
      state.selectionStartKey = key;
      state.selectionEndKey = key;
      renderCalendar();
      updateSelectionSummary();
    });

    cell.addEventListener('pointerenter', () => {
      if (!state.isDragging) return;
      state.didDrag = true;
      state.selectionEndKey = key;
      renderCalendar();
      updateSelectionSummary();
    });

    cell.addEventListener('click', () => {
      if (state.didDrag) return;
      state.selectionStartKey = key;
      state.selectionEndKey = key;
      renderCalendar();
      updateSelectionSummary();
    });

    calendarGrid.appendChild(cell);
  }
}

function updateStats() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  let monthTotal = 0;
  let overall = 0;

  Object.entries(state.requests).forEach(([key, value]) => {
    overall += value.length;
    const [y, m] = key.split('-').map(Number);
    if (y === year && m === month + 1) monthTotal += value.length;
  });

  monthCount.textContent = monthTotal;
  totalCount.textContent = overall;
}

function renderTeamEditor() {
  teamEditor.innerHTML = '';
  state.techs.forEach(tech => {
    const row = document.createElement('div');
    row.className = 'team-row';
    row.innerHTML = `
      <div class="color-dot" style="background:${tech.color}; width:18px; height:18px;"></div>
      <input type="text" value="${tech.name}" data-id="${tech.id}" maxlength="28" />
      <button type="button" class="remove-btn" data-id="${tech.id}">Remove</button>
    `;
    const removeBtn = row.querySelector('.remove-btn');
    removeBtn.disabled = state.techs.length <= 1;
    removeBtn.addEventListener('click', () => {
      state.techs = state.techs.filter(t => t.id !== tech.id);
      Object.keys(state.requests).forEach(key => {
        state.requests[key] = state.requests[key].filter(req => req.techId !== tech.id);
        if (!state.requests[key].length) delete state.requests[key];
      });
      if (!state.techs.some(t => t.id === state.selectedTechId)) {
        state.selectedTechId = state.techs[0]?.id || null;
      }
      renderTeamEditor();
    });
    teamEditor.appendChild(row);
  });
}

function openConfirmModal() {
  const tech = getSelectedTech();
  const keys = dateKeysInRange(state.selectionStartKey, state.selectionEndKey);
  if (!tech || !keys.length) return;

  const start = parseKey(keys[0]);
  const end = parseKey(keys[keys.length - 1]);
  confirmBody.innerHTML = `
    <div class="confirm-panel">
      <div class="confirm-label">Employee</div>
      <div class="confirm-value">${tech.name}</div>
    </div>
    <div class="confirm-panel">
      <div class="confirm-label">Date range</div>
      <div class="confirm-value">${formatPrettyDate(start)}${keys.length > 1 ? ` → ${formatPrettyDate(end)}` : ''}</div>
    </div>
    <div class="confirm-panel">
      <div class="confirm-label">Request size</div>
      <div class="confirm-value">${keys.length} ${keys.length === 1 ? 'day' : 'days'}</div>
    </div>
  `;
  requestNote.value = '';
  confirmModal.showModal();
}

function submitSelection() {
  const tech = getSelectedTech();
  const keys = dateKeysInRange(state.selectionStartKey, state.selectionEndKey);
  if (!tech || !keys.length) return;

  const note = requestNote.value.trim();
  keys.forEach(key => {
    const current = state.requests[key] || [];
    const alreadyExists = current.some(req => req.techId === tech.id);
    if (!alreadyExists) {
      current.push({ techId: tech.id, status: 'pending', note });
      state.requests[key] = current;
    }
  });

  persist();
  confirmModal.close();
  clearSelection();
  render();
}

function render() {
  renderWeekdays();
  renderTechs();
  renderLegend();
  renderCalendar();
  updateSelectionSummary();
  updateStats();
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

manageTeamBtn.addEventListener('click', () => {
  renderTeamEditor();
  teamModal.showModal();
});

addTechBtn.addEventListener('click', () => {
  const color = palette[state.techs.length % palette.length];
  state.techs.push({ id: crypto.randomUUID(), name: `Employee ${state.techs.length + 1}`, color });
  renderTeamEditor();
});

saveTeamBtn.addEventListener('click', () => {
  const inputs = [...teamEditor.querySelectorAll('input[data-id]')];
  state.techs = state.techs.map(tech => {
    const input = inputs.find(i => i.dataset.id === tech.id);
    return { ...tech, name: input?.value.trim() || tech.name };
  });
  if (!state.selectedTechId) state.selectedTechId = state.techs[0]?.id || null;
  persist();
  render();
  teamModal.close();
});

document.getElementById('prevBtn').addEventListener('click', () => {
  state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() - 1, 1);
  render();
});

document.getElementById('nextBtn').addEventListener('click', () => {
  state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1, 1);
  render();
});

document.getElementById('todayBtn').addEventListener('click', () => {
  const now = new Date();
  state.currentDate = new Date(now.getFullYear(), now.getMonth(), 1);
  render();
});

clearSelectionBtn.addEventListener('click', () => {
  clearSelection();
  render();
});

submitRequestBtn.addEventListener('click', () => {
  openConfirmModal();
});

cancelConfirmBtn.addEventListener('click', () => {
  confirmModal.close();
});

confirmSubmitBtn.addEventListener('click', () => {
  submitSelection();
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ techs: state.techs, requests: state.requests }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pto-request-calendar-data.json';
  a.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.techs) && parsed.requests) {
      state.techs = parsed.techs;
      state.requests = parsed.requests;
      state.selectedTechId = parsed.selectedTechId || parsed.techs[0]?.id || null;
      persist();
      clearSelection();
      render();
    } else {
      alert('Invalid PTO data file.');
    }
  } catch {
    alert('Could not import that file.');
  } finally {
    event.target.value = '';
  }
});

window.addEventListener('pointerup', () => {
  if (!state.isDragging) return;
  state.isDragging = false;
  renderCalendar();
  updateSelectionSummary();
  setTimeout(() => { state.didDrag = false; }, 0);
});

loadState();
render();
