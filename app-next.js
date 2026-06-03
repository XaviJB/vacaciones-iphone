const STORAGE_KEY = "vacation-calendar-v3";
const OLD_STORAGE_KEY = "vacation-calendar-v2";
const DAY_START = 7;
const DAY_END = 24;
const HOUR_HEIGHT = 66;
const palette = ["#ffd8c8", "#ccebdc", "#ddd1ff", "#ffe7a8", "#cbe7ff", "#ffc7d7", "#d7f0b8", "#f8c8ff"];
const legacyColors = { coral: "#ffd8c8", mint: "#ccebdc", lilac: "#ddd1ff", butter: "#ffe7a8", sky: "#cbe7ff" };

const state = loadState();
let editingId = null;
let dragState = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const tripRange = $("#tripRange");
const totalDays = $("#totalDays");
const totalHours = $("#totalHours");
const totalCards = $("#totalCards");
const taskForm = $("#taskForm");
const taskDialog = $("#taskDialog");
const taskTitle = $("#taskTitle");
const taskDate = $("#taskDate");
const taskStart = $("#taskStart");
const taskColor = $("#taskColor");
const calendarScroll = $("#calendarScroll");
const calendarGrid = $("#calendarGrid");
const dateDialog = $("#dateDialog");
const dateForm = $("#dateForm");
const startDate = $("#startDate");
const endDate = $("#endDate");
const editDialog = $("#editDialog");
const editForm = $("#editForm");
const editTitle = $("#editTitle");
const editDate = $("#editDate");
const editStart = $("#editStart");
const editColor = $("#editColor");
const tripFile = $("#tripFile");
const bookingForm = $("#bookingForm");
const bookingTitle = $("#bookingTitle");
const bookingDate = $("#bookingDate");
const bookingTime = $("#bookingTime");
const bookingCode = $("#bookingCode");
const bookingList = $("#bookingList");
const bookingCount = $("#bookingCount");
const packingForm = $("#packingForm");
const packingTitle = $("#packingTitle");
const packingCategory = $("#packingCategory");
const packingList = $("#packingList");
const packingProgress = $("#packingProgress");

fillHourSelect(taskStart);
fillHourSelect(editStart);
render();
prepareNewTask();
registerOfflineSupport();

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
  state.tasks.push({ id: makeId(), title, date: taskDate.value, start, duration, color: taskColor.value });
  taskTitle.value = "";
  taskDialog.close();
  prepareNewTask();
  saveAndRender();
});

$("#openTaskForm").addEventListener("click", openTaskDialog);
$("#closeTaskForm").addEventListener("click", () => taskDialog.close());
$("#exportTrip").addEventListener("click", exportTrip);
$("#importTrip").addEventListener("click", () => tripFile.click());
tripFile.addEventListener("change", () => importTripFile(tripFile.files?.[0]));
window.addEventListener("resize", setCalendarSizing);

$$('.tab-button').forEach((button) => {
  button.addEventListener("click", () => setActiveView(button.dataset.view));
});

dateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!startDate.value || !endDate.value) return;
  const start = startDate.value <= endDate.value ? startDate.value : endDate.value;
  const end = startDate.value <= endDate.value ? endDate.value : startDate.value;
  state.range = { start, end };
  state.tasks = state.tasks.filter((task) => task.date >= start && task.date <= end);
  state.bookings = state.bookings.filter((booking) => !booking.date || (booking.date >= start && booking.date <= end));
  dateDialog.close();
  saveAndRender();
});

$("#editDates").addEventListener("click", () => {
  startDate.value = state.range.start || "2026-08-02";
  endDate.value = state.range.end || "2026-08-10";
  dateDialog.showModal();
});

$("#resetBoard").addEventListener("click", () => {
  if (!confirm("¿Quieres borrar las notas, reservas y maleta?")) return;
  state.tasks = [];
  state.bookings = [];
  state.packing = [];
  saveAndRender();
});

$("#closeEdit").addEventListener("click", () => editDialog.close());
$("#deleteEdit").addEventListener("click", () => {
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

bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = bookingTitle.value.trim();
  if (!title) return;
  state.bookings.push({ id: makeId(), title, date: bookingDate.value, time: bookingTime.value, code: bookingCode.value.trim() });
  bookingForm.reset();
  saveAndRender();
});

packingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = packingTitle.value.trim();
  if (!title) return;
  state.packing.push({ id: makeId(), title, category: packingCategory.value, packed: false });
  packingTitle.value = "";
  saveAndRender();
});

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
  if (!raw) return createEmptyState();
  try {
    const saved = JSON.parse(raw);
    return normalizeState(saved);
  } catch {
    return createEmptyState();
  }
}

function normalizeState(saved) {
  return {
    range: saved?.range || { start: "", end: "" },
    tasks: Array.isArray(saved?.tasks) ? saved.tasks.map(normalizeTask) : [],
    bookings: Array.isArray(saved?.bookings) ? saved.bookings.map(normalizeBooking) : [],
    packing: Array.isArray(saved?.packing) ? saved.packing.map(normalizePackingItem) : []
  };
}

function normalizeTask(task) {
  return {
    ...task,
    id: task.id || makeId(),
    title: String(task.title || ""),
    date: String(task.date || ""),
    start: Number(task.start) || DAY_START,
    duration: Number(task.duration) || 1,
    color: task.color || legacyColors[task.mood] || randomColor()
  };
}

function normalizeBooking(booking) {
  return { id: booking.id || makeId(), title: String(booking.title || ""), date: String(booking.date || ""), time: String(booking.time || ""), code: String(booking.code || "") };
}

function normalizePackingItem(item) {
  return { id: item.id || makeId(), title: String(item.title || ""), category: String(item.category || "Otros"), packed: Boolean(item.packed) };
}

function createEmptyState() {
  return { range: { start: "", end: "" }, tasks: [], bookings: [], packing: [] };
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function render() {
  const days = getTripDays();
  fillDateSelect(taskDate, days);
  fillDateSelect(editDate, days);
  fillDateSelect(bookingDate, days);
  renderSummary(days);
  renderCalendar(days);
  renderBookings();
  renderPacking();
}

function renderSummary(days) {
  const hours = state.tasks.reduce((sum, task) => sum + task.duration, 0);
  totalDays.textContent = String(days.length);
  totalHours.textContent = `${hours}h`;
  totalCards.textContent = String(state.tasks.length);
  tripRange.textContent = days.length ? `${formatLongDate(state.range.start)} - ${formatLongDate(state.range.end)}` : "Elige tus fechas";
}

function renderCalendar(days) {
  setCalendarSizing();
  calendarGrid.innerHTML = "";
  calendarGrid.style.gridTemplateColumns = `var(--time-width) repeat(${Math.max(days.length, 1)}, var(--day-width))`;
  calendarGrid.appendChild(createTimeAxis());
  days.forEach((day) => calendarGrid.appendChild(createDayColumn(day)));
}

function setCalendarSizing() {
  const visibleDays = getVisibleDayCount();
  const width = calendarScroll.clientWidth || window.innerWidth;
  const availableWidth = Math.max(120, width - 48);
  const dayWidth = Math.floor(availableWidth / visibleDays);
  document.documentElement.style.setProperty("--day-width", `${dayWidth}px`);
  $("#visibleHint").textContent = visibleDays === 1 ? "1 día" : `${visibleDays} días`;
}

function getVisibleDayCount() {
  const width = calendarScroll.clientWidth || window.innerWidth;
  if (width >= 760) return 3;
  if (width - 48 < 250) return 1;
  return 2;
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
  state.tasks.filter((item) => item.date === day.value).forEach((task) => lane.appendChild(createEventCard(task)));
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
  card.innerHTML = `<span class="event-time">${formatHour(task.start)}</span><strong class="event-title">${escapeHtml(task.title)}</strong><span class="event-duration">${task.duration}h</span>`;
  card.addEventListener("pointerdown", (event) => startDrag(event, task.id));
  return card;
}

function startDrag(event, id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task || event.button > 0) return;
  const card = event.currentTarget;
  const rect = card.getBoundingClientRect();
  dragState = { id, startX: event.clientX, startY: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, moved: false };
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
  if (Math.abs(dx) > 7 || Math.abs(dy) > 7) dragState.moved = true;
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
  if (!wasMoved) openEditor(task.id);
  else render();
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
  const hiddenCard = $(".event-card.is-dragging");
  if (hiddenCard) hiddenCard.style.pointerEvents = "none";
  const element = document.elementFromPoint(x, y);
  if (hiddenCard) hiddenCard.style.pointerEvents = "";
  const column = element?.closest?.(".day-column");
  const lane = column?.querySelector(".day-lane");
  if (!column || !lane) return null;
  const laneRect = lane.getBoundingClientRect();
  const rawHour = Math.round((y - laneRect.top) / HOUR_HEIGHT) + DAY_START;
  const maxStart = DAY_END - duration;
  return { date: column.dataset.date, start: Math.min(maxStart, Math.max(DAY_START, rawHour)) };
}

function renderBookings() {
  bookingCount.textContent = String(state.bookings.length);
  bookingList.innerHTML = "";
  [...state.bookings].sort(compareDatedItems).forEach((booking) => {
    const item = document.createElement("article");
    item.className = "list-item";
    item.innerHTML = `<header><div><strong>${escapeHtml(booking.title)}</strong><p class="list-meta">${formatBookingMeta(booking)}</p></div><div class="list-actions"><button class="small-button" type="button" data-delete-booking="${booking.id}">Borrar</button></div></header>${booking.code ? `<p class="list-meta">${escapeHtml(booking.code)}</p>` : ""}`;
    bookingList.appendChild(item);
  });
  $$('[data-delete-booking]').forEach((button) => button.addEventListener("click", () => {
    state.bookings = state.bookings.filter((booking) => booking.id !== button.dataset.deleteBooking);
    saveAndRender();
  }));
}

function renderPacking() {
  const packed = state.packing.filter((item) => item.packed).length;
  packingProgress.textContent = `${packed}/${state.packing.length}`;
  packingList.innerHTML = "";
  state.packing.forEach((packedItem) => {
    const item = document.createElement("article");
    item.className = "list-item";
    item.innerHTML = `<header><label class="packing-check ${packedItem.packed ? "is-packed" : ""}"><input type="checkbox" ${packedItem.packed ? "checked" : ""} data-pack="${packedItem.id}"><span><strong>${escapeHtml(packedItem.title)}</strong><p class="list-meta">${escapeHtml(packedItem.category)}</p></span></label><button class="small-button" type="button" data-delete-pack="${packedItem.id}">Borrar</button></header>`;
    packingList.appendChild(item);
  });
  $$('[data-pack]').forEach((checkbox) => checkbox.addEventListener("change", () => {
    const item = state.packing.find((entry) => entry.id === checkbox.dataset.pack);
    if (!item) return;
    item.packed = checkbox.checked;
    saveAndRender();
  }));
  $$('[data-delete-pack]').forEach((button) => button.addEventListener("click", () => {
    state.packing = state.packing.filter((item) => item.id !== button.dataset.deletePack);
    saveAndRender();
  }));
}

function setActiveView(view) {
  $$('.tab-button').forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  $$('.view-panel').forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === view));
  if (view === "agenda") setCalendarSizing();
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
  if (!taskTitle.value.trim()) taskColor.value = randomColor();
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

function exportTrip() {
  const payload = { app: "vacaciones-iphone", version: 3, exportedAt: new Date().toISOString(), range: state.range, tasks: state.tasks, bookings: state.bookings, packing: state.packing };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
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
      const nextState = normalizeImportedState(JSON.parse(String(reader.result)));
      state.range = nextState.range;
      state.tasks = nextState.tasks;
      state.bookings = nextState.bookings;
      state.packing = nextState.packing;
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
  const next = normalizeState(imported);
  if (!next.range.start || !next.range.end || !Array.isArray(imported?.tasks)) throw new Error("Invalid vacation file");
  if (next.range.start > next.range.end) next.range = { start: next.range.end, end: next.range.start };
  next.tasks = next.tasks.filter((task) => task.date >= next.range.start && task.date <= next.range.end);
  next.bookings = next.bookings.filter((booking) => !booking.date || (booking.date >= next.range.start && booking.date <= next.range.end));
  return next;
}

function getTripDays() {
  if (!state.range.start || !state.range.end) return [];
  const days = [];
  const current = parseDate(state.range.start);
  const end = parseDate(state.range.end);
  while (current <= end) {
    const value = toInputDate(current);
    days.push({ value, label: formatLongDate(value), weekday: new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(current), dayNumber: new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(current) });
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function fillDateSelect(select, days) {
  const previous = select.value;
  select.innerHTML = "";
  days.forEach((day) => {
    const option = document.createElement("option");
    option.value = day.value;
    option.textContent = day.label;
    select.appendChild(option);
  });
  if (days.some((day) => day.value === previous)) select.value = previous;
}

function fillHourSelect(select) {
  for (let hour = DAY_START; hour < DAY_END; hour += 1) {
    const option = document.createElement("option");
    option.value = String(hour);
    option.textContent = formatHour(hour);
    select.appendChild(option);
  }
}

function prepareNewTask() {
  taskColor.value = randomColor();
  taskForm.querySelector('[name="duration"][value="1"]').checked = true;
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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatLongDate(value) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(parseDate(value));
}

function formatHour(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatBookingMeta(booking) {
  const day = booking.date ? formatLongDate(booking.date) : "Sin fecha";
  return booking.time ? `${day} · ${booking.time}` : day;
}

function compareDatedItems(a, b) {
  return `${a.date || "9999"} ${a.time || "99:99"}`.localeCompare(`${b.date || "9999"} ${b.time || "99:99"}`);
}

function randomColor() {
  return palette[Math.floor(Math.random() * palette.length)];
}

function readableTextColor(color) {
  const value = color.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? "#49313b" : "#fffaf8";
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function registerOfflineSupport() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
