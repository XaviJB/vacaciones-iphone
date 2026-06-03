const STORAGE_KEY = "vacation-calendar-v2";
const DAY_START = 7;
const DAY_END = 24;
const HOUR_HEIGHT = 66;

const palette = [
  "#ffd8c8",
  "#ccebdc",
  "#ddd1ff",
  "#ffe7a8",
  "#cbe7ff",
  "#ffc7d7",
  "#d7f0b8",
  "#f8c8ff"
];

const legacyColors = {
  coral: "#ffd8c8",
  mint: "#ccebdc",
  lilac: "#ddd1ff",
  butter: "#ffe7a8",
  sky: "#cbe7ff"
};

const state = loadState();
let editingId = null;
let dragState = null;

const tripRange = document.querySelector("#tripRange");
const totalDays = document.querySelector("#totalDays");
const totalHours = document.querySelector("#totalHours");
const totalCards = document.querySelector("#totalCards");
const taskForm = document.querySelector("#taskForm");
const taskDialog = document.querySelector("#taskDialog");
const taskTitle = document.querySelector("#taskTitle");
const taskDate = document.querySelector("#taskDate");
const taskStart = document.querySelector("#taskStart");
const taskColor = document.querySelector("#taskColor");
const calendarScroll = document.querySelector("#calendarScroll");
const calendarGrid = document.querySelector("#calendarGrid");
const dateDialog = document.querySelector("#dateDialog");
const dateForm = document.querySelector("#dateForm");
const startDate = document.querySelector("#startDate");
const endDate = document.querySelector("#endDate");
const editDialog = document.querySelector("#editDialog");
const editForm = document.querySelector("#editForm");
const editTitle = document.querySelector("#editTitle");
const editDate = document.querySelector("#editDate");
const editStart = document.querySelector("#editStart");
const editColor = document.querySelector("#editColor");
const tripFile = document.querySelector("#tripFile");

fillHourSelect(taskStart);
fillHourSelect(editStart);
render();
prepareNewTask();

if (!state.range.start || !state.range.end) {
  startDate.value = "2026-08-02";
  endDate.value = "2026-08-10";
  dateDialog.showModal();
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = taskTitle.value.trim();
  if (!title) return;
  const start = Number(taskStart.value);
  const duration = Number(new FormData(taskForm).get("duration"));
  if (!fitsInDay(start, duration)) return;

  state.tasks.push({
    id: makeId(),
    title,
    date: taskDate.value,
    start,
    duration,
    color: taskColor.value
  });

  taskTitle.value = "";
  taskDialog.close();
  prepareNewTask();
  saveAndRender();
});

document.querySelector("#openTaskForm").addEventListener("click", () => {
  openTaskDialog();
});

document.querySelector("#closeTaskForm").addEventListener("click", () => {
  taskDialog.close();
});

document.querySelector("#exportTrip").addEventListener("click", () => {
  exportTrip();
});

document.querySelector("#importTrip").addEventListener("click", () => {
  tripFile.click();
});

tripFile.addEventListener("change", () => {
  importTripFile(tripFile.files?.[0]);
});

window.addEventListener("resize", () => {
  setCalendarSizing();
});

dateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!startDate.value || !endDate.value) return;

  const start = startDate.value <= endDate.value ? startDate.value : endDate.value;
  const end = startDate.value <= endDate.value ? endDate.value : startDate.value;
  state.range = { start, end };
  state.tasks = state.tasks.filter((task) => task.date >= start && task.date <= end);
  dateDialog.close();
  saveAndRender();
});

document.querySelector("#editDates").addEventListener("click", () => {
  startDate.value = state.range.start || "2026-08-02";
  endDate.value = state.range.end || "2026-08-10";
  dateDialog.showModal();
});

document.querySelector("#resetBoard").addEventListener("click", () => {
  if (!confirm("¿Quieres borrar las notas y volver a un calendario limpio?")) return;
  state.tasks = [];
  saveAndRender();
});

document.querySelector("#closeEdit").addEventListener("click", () => {
  editDialog.close();
});

document.querySelector("#deleteEdit").addEventListener("click", () => {
  state.tasks = state.tasks.filter((task) => task.id !== editingId);
  editDialog.close();
  editingId = null;
  saveAndRender();
});

editForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const task = state.tasks.find((item) => item.id === editingId);
  if (!task) return;
  const start = Number(editStart.value);
  const duration = Number(new FormData(editForm).get("editDuration"));
  if (!fitsInDay(start, duration)) return;

  task.title = editTitle.value.trim();
  task.date = editDate.value;
  task.start = start;
  task.duration = duration;
  task.color = editColor.value;
  editDialog.close();
  editingId = null;
  saveAndRender();
});

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.range && Array.isArray(saved.tasks)) {
      saved.tasks = saved.tasks.map(normalizeTask);
      return saved;
    }
  } catch {
    return createEmptyState();
  }

  return createEmptyState();
}

function normalizeTask(task) {
  return {
    ...task,
    id: task.id || makeId(),
    date: String(task.date || ""),
    start: Number(task.start) || DAY_START,
    duration: Number(task.duration) || 1,
    color: task.color || legacyColors[task.mood] || randomColor()
  };
}

function createEmptyState() {
  return {
    range: { start: "", end: "" },
    tasks: []
  };
}

function exportTrip() {
  const payload = {
    app: "vacaciones-iphone",
    version: 2,
    exportedAt: new Date().toISOString(),
    range: state.range,
    tasks: state.tasks
  };
  const content = JSON.stringify(payload, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vacaciones-${state.range.start || "sin-fecha"}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importTripFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(String(reader.result));
      const nextState = normalizeImportedState(imported);

      state.range = nextState.range;
      state.tasks = nextState.tasks;
      saveAndRender();
      alert("Viaje cargado correctamente.");
    } catch {
      alert("No he podido cargar ese archivo. Revisa que sea un JSON exportado desde esta app.");
    } finally {
      tripFile.value = "";
    }
  });
  reader.readAsText(file);
}

function normalizeImportedState(imported) {
  const range = imported?.range;
  const tasks = imported?.tasks;

  if (!range?.start || !range?.end || !Array.isArray(tasks)) {
    throw new Error("Invalid vacation file");
  }

  const start = String(range.start);
  const end = String(range.end);
  const nextRange = start <= end ? { start, end } : { start: end, end: start };

  return {
    range: nextRange,
    tasks: tasks.map(normalizeTask).filter((task) => task.date >= nextRange.start && task.date <= nextRange.end)
  };
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function render() {
  const days = getTripDays();
  fillDateSelect(taskDate, days);
  fillDateSelect(editDate, days);
  renderSummary(days);
  renderCalendar(days);
}

function renderSummary(days) {
  const hours = state.tasks.reduce((sum, task) => sum + task.duration, 0);

  totalDays.textContent = String(days.length);
  totalHours.textContent = `${hours}h`;
  totalCards.textContent = String(state.tasks.length);
  tripRange.textContent = days.length
    ? `${formatLongDate(state.range.start)} - ${formatLongDate(state.range.end)}`
    : "Elige tus fechas";
}

function renderCalendar(days) {
  setCalendarSizing();
  calendarGrid.innerHTML = "";
  calendarGrid.style.gridTemplateColumns = `var(--time-width) repeat(${Math.max(days.length, 1)}, var(--day-width))`;
  calendarGrid.appendChild(createTimeAxis());

  for (const day of days) {
    calendarGrid.appendChild(createDayColumn(day));
  }
}

function setCalendarSizing() {
  const visibleDays = getVisibleDayCount();
  const width = calendarScroll.clientWidth || window.innerWidth;
  const availableWidth = Math.max(120, width - 48);
  const dayWidth = Math.floor(availableWidth / visibleDays);

  document.documentElement.style.setProperty("--day-width", `${dayWidth}px`);
  document.querySelector("#visibleHint").textContent = visibleDays === 1 ? "1 día" : `${visibleDays} días`;
}

function getVisibleDayCount() {
  const width = calendarScroll.clientWidth || window.innerWidth;
  if (width >= 760) return 3;
  if (width - 48 < 250) return 1;
  return 2;
}

function prepareNewTask() {
  taskColor.value = randomColor();
  taskForm.querySelector('[name="duration"][value="1"]').checked = true;
}

function createTimeAxis() {
  const axis = document.createElement("div");
  axis.className = "time-axis";
  axis.appendChild(document.createElement("div")).className = "time-spacer";

  for (let hour = DAY_START; hour <= DAY_END; hour += 1) {
    const label = document.createElement("span");
    label.className = "time-label";
    label.style.top = `${50 + (hour - DAY_START) * HOUR_HEIGHT}px`;
    label.textContent = `${String(hour).padStart(2, "0")}:00`;
    axis.appendChild(label);
  }

  return axis;
}

function createDayColumn(day) {
  const column = document.createElement("article");
  column.className = "day-column";
  column.dataset.date = day.value;

  const header = document.createElement("header");
  header.className = "day-header";
  header.innerHTML = `<span class="day-name">${day.weekday}</span><strong class="day-number">${day.dayNumber}</strong>`;

  const lane = document.createElement("div");
  lane.className = "day-lane";

  for (let hour = DAY_START; hour < DAY_END; hour += 1) {
    const hit = document.createElement("button");
    hit.className = "hour-hit";
    hit.type = "button";
    hit.style.top = `${(hour - DAY_START) * HOUR_HEIGHT}px`;
    hit.ariaLabel = `Añadir nota el ${day.label} a las ${hour}:00`;
    hit.addEventListener("click", () => prefillTask(day.value, hour, true));
    lane.appendChild(hit);
  }

  for (const task of state.tasks.filter((item) => item.date === day.value)) {
    lane.appendChild(createEventCard(task));
  }

  column.append(header, lane);
  return column;
}

function createEventCard(task) {
  const card = document.createElement("button");
  card.className = "event-card";
  card.type = "button";
  card.dataset.id = task.id;
  card.style.background = task.color;
  card.style.color = readableTextColor(task.color);
  card.style.top = `${(task.start - DAY_START) * HOUR_HEIGHT + 5}px`;
  card.style.height = `${task.duration * HOUR_HEIGHT - 10}px`;
  card.innerHTML = `
    <span class="event-time">${formatHour(task.start)}</span>
    <strong class="event-title">${escapeHtml(task.title)}</strong>
    <span class="event-duration">${task.duration}h</span>
  `;
  card.addEventListener("pointerdown", (event) => startDrag(event, task.id));
  return card;
}

function startDrag(event, id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task || event.button > 0) return;

  const card = event.currentTarget;
  const rect = card.getBoundingClientRect();
  dragState = {
    id,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    moved: false
  };

  card.setPointerCapture(event.pointerId);
  card.classList.add("is-dragging");
  card.style.width = `${rect.width}px`;
  card.style.left = `${rect.left}px`;
  card.style.right = "auto";
  card.style.top = `${rect.top}px`;
  card.style.position = "fixed";

  card.addEventListener("pointermove", dragCard);
  card.addEventListener("pointerup", finishDrag);
  card.addEventListener("pointercancel", cancelDrag);
}

function dragCard(event) {
  if (!dragState) return;

  const card = event.currentTarget;
  const dx = event.clientX - dragState.startX;
  const dy = event.clientY - dragState.startY;

  if (Math.abs(dx) > 7 || Math.abs(dy) > 7) {
    dragState.moved = true;
  }

  if (!dragState.moved) return;
  event.preventDefault();
  card.style.left = `${event.clientX - dragState.offsetX}px`;
  card.style.top = `${event.clientY - dragState.offsetY}px`;
}

function finishDrag(event) {
  const card = event.currentTarget;
  const task = state.tasks.find((item) => item.id === dragState?.id);
  const wasMoved = dragState?.moved;
  const drop = wasMoved ? getDropTarget(event.clientX, event.clientY, task?.duration || 1) : null;

  cleanupDragCard(card, event.pointerId);

  if (!task) return;

  if (drop) {
    task.date = drop.date;
    task.start = drop.start;
    saveAndRender();
    return;
  }

  if (!wasMoved) {
    openEditor(task.id);
    return;
  }

  render();
}

function cancelDrag(event) {
  cleanupDragCard(event.currentTarget, event.pointerId);
  render();
}

function cleanupDragCard(card, pointerId) {
  card.releasePointerCapture?.(pointerId);
  card.removeEventListener("pointermove", dragCard);
  card.removeEventListener("pointerup", finishDrag);
  card.removeEventListener("pointercancel", cancelDrag);
  card.classList.remove("is-dragging");
  card.style.width = "";
  card.style.left = "";
  card.style.right = "";
  card.style.top = "";
  card.style.position = "";
  dragState = null;
}

function getDropTarget(x, y, duration) {
  const hiddenCard = document.querySelector(".event-card.is-dragging");
  if (hiddenCard) hiddenCard.style.pointerEvents = "none";
  const element = document.elementFromPoint(x, y);
  if (hiddenCard) hiddenCard.style.pointerEvents = "";

  const column = element?.closest?.(".day-column");
  const lane = column?.querySelector(".day-lane");
  if (!column || !lane) return null;

  const laneRect = lane.getBoundingClientRect();
  const rawHour = Math.round((y - laneRect.top) / HOUR_HEIGHT) + DAY_START;
  const maxStart = DAY_END - duration;
  const start = Math.min(maxStart, Math.max(DAY_START, rawHour));

  return {
    date: column.dataset.date,
    start
  };
}

function prefillTask(date, hour, shouldOpen = false) {
  taskDate.value = date;
  taskStart.value = String(hour);
  if (shouldOpen) openTaskDialog();
}

function openTaskDialog() {
  if (!state.range.start || !state.range.end) {
    dateDialog.showModal();
    return;
  }

  if (!taskTitle.value.trim()) {
    taskColor.value = randomColor();
  }

  if (!taskDate.value && state.range.start) taskDate.value = state.range.start;
  if (!taskStart.value) taskStart.value = String(DAY_START);
  taskDialog.showModal();
  taskTitle.focus();
}

function openEditor(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  editingId = id;
  editTitle.value = task.title;
  editDate.value = task.date;
  editStart.value = String(task.start);
  editColor.value = task.color;
  editForm.querySelector(`[name="editDuration"][value="${task.duration}"]`).checked = true;
  editDialog.showModal();
}

function getTripDays() {
  if (!state.range.start || !state.range.end) return [];

  const days = [];
  const current = parseDate(state.range.start);
  const end = parseDate(state.range.end);

  while (current <= end) {
    const value = toInputDate(current);
    days.push({
      value,
      label: formatLongDate(value),
      weekday: new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(current),
      dayNumber: new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(current)
    });
    current.setDate(current.getDate() + 1);
  }

  return days;
}

function fillDateSelect(select, days) {
  const previous = select.value;
  select.innerHTML = "";

  for (const day of days) {
    const option = document.createElement("option");
    option.value = day.value;
    option.textContent = day.label;
    select.appendChild(option);
  }

  if (days.some((day) => day.value === previous)) {
    select.value = previous;
  }
}

function fillHourSelect(select) {
  for (let hour = DAY_START; hour < DAY_END; hour += 1) {
    const option = document.createElement("option");
    option.value = String(hour);
    option.textContent = formatHour(hour);
    select.appendChild(option);
  }
}

function randomColor() {
  return palette[Math.floor(Math.random() * palette.length)];
}

function readableTextColor(color) {
  const value = color.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 150 ? "#49313b" : "#fffaf8";
}

function fitsInDay(start, duration) {
  if (start + duration <= DAY_END) return true;
  alert("Esa nota se sale del día. Prueba con una hora un poco antes.");
  return false;
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLongDate(value) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(parseDate(value));
}

function formatHour(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
