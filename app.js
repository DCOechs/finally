const eventsTab = document.getElementById("eventsTab");
const analysisTab = document.getElementById("analysisTab");
const eventsView = document.getElementById("eventsView");
const analysisView = document.getElementById("analysisView");
const eventGrid = document.getElementById("eventGrid");
const statistics = document.getElementById("statistics");
const eventTypeDialog = document.getElementById("eventTypeDialog");
const eventTypeForm = document.getElementById("eventTypeForm");
const editEventDialog = document.getElementById("editEventDialog");
const editEventForm = document.getElementById("editEventForm");
const editEventName = document.getElementById("editEventName");
const editEventIcon = document.getElementById("editEventIcon");
const editModeButton = document.getElementById("editModeButton");
const eventsModeLabel = document.getElementById("eventsModeLabel");
const toast = document.getElementById("toast");

let eventTypes = [];
let events = [];
let isEditMode = false;
let selectedEventType = null;
let toastTimeout;


const HORIZON_MULTIPLIERS = {
    hours: 60,
    days: 1440,
    weeks: 10080
};

function readHorizon(valueId, unitId) {
    const raw = document.getElementById(valueId).value.trim();

    if (raw === "") return null;

    const value = Number(raw);
    const unit = document.getElementById(unitId).value;

    if (!Number.isFinite(value) || value < 0) {
        throw new Error("Invalid influence horizon");
    }

    return value * HORIZON_MULTIPLIERS[unit];
}

function displayHorizon(minutes) {
    if (minutes == null) {
        return { value: "", unit: "days" };
    }

    if (minutes % 10080 === 0) {
        return { value: minutes / 10080, unit: "weeks" };
    }

    if (minutes % 1440 === 0) {
        return { value: minutes / 1440, unit: "days" };
    }

    return { value: minutes / 60, unit: "hours" };
}


function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 1800);
}

function showTab(tab) {
  const showingEvents = tab === "events";
  eventsView.hidden = !showingEvents;
  analysisView.hidden = showingEvents;
  eventsTab.classList.toggle("active", showingEvents);
  analysisTab.classList.toggle("active", !showingEvents);
  if (showingEvents) {
    eventsTab.setAttribute("aria-current", "page");
    analysisTab.removeAttribute("aria-current");
  } else {
    analysisTab.setAttribute("aria-current", "page");
    eventsTab.removeAttribute("aria-current");
    renderStatistics();
  }
}

function setEditMode(enabled) {
  isEditMode = enabled;
  editModeButton.textContent = enabled ? "Done" : "Edit";
  editModeButton.classList.toggle("active", enabled);
  editModeButton.setAttribute("aria-pressed", String(enabled));
  eventsModeLabel.textContent = enabled
    ? "Tap an event to edit it"
    : "Tap an event to record it";
  renderEvents();
}

function openEditEvent(type) {
  selectedEventType = type;
  editEventName.value = type.name;
  editEventIcon.value = type.icon || "";
  document.getElementById("editEventDescription").value =
    type.description || "";

  const horizon = displayHorizon(type.influenceHorizonMinutes);

  document.getElementById("editEventHorizon").value = horizon.value;
  document.getElementById("editEventHorizonUnit").value = horizon.unit;
  editEventDialog.showModal();


}

function renderEvents() {
  eventGrid.replaceChildren();
  for (const type of eventTypes) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "event-tile";
    if (isEditMode) tile.classList.add("editing");

    const icon = document.createElement("span");
    icon.className = "tile-icon";
    icon.textContent = type.icon || "●";
    const name = document.createElement("span");
    name.className = "tile-name";
    name.textContent = type.name;
    tile.append(icon, name);
    tile.addEventListener("click", () => {
      if (isEditMode) openEditEvent(type);
      else logEvent(type);
    });
    eventGrid.appendChild(tile);
  }

  const addTile = document.createElement("button");
  addTile.type = "button";
  addTile.className = "event-tile add-tile";
  const plus = document.createElement("span");
  plus.className = "tile-icon";
  plus.textContent = "+";
  const label = document.createElement("span");
  label.className = "tile-name";
  label.textContent = "Add event";
  addTile.append(plus, label);
  addTile.addEventListener("click", () => {
    eventTypeForm.reset();
    eventTypeDialog.showModal();
  });
  eventGrid.appendChild(addTile);
}

async function logEvent(type) {
  const timestamp = new Date().toISOString();
  const event = {
    id: crypto.randomUUID(),
    typeId: type.id,
    occurredAt: timestamp,
    createdAt: timestamp,
    values: {}
  };
  try {
    await saveEvent(event);
    events.push(event);
    showToast(type.name + " recorded");
  } catch (error) {
    console.error(error);
    showToast("Could not save event");
  }
}

function renderStatistics() {
  statistics.replaceChildren();
  if (eventTypes.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No events tracked yet.";
    statistics.appendChild(empty);
    return;
  }
  const counts = new Map();
  for (const event of events) {
    counts.set(event.typeId, (counts.get(event.typeId) || 0) + 1);
  }
  for (const type of eventTypes) {
    const row = document.createElement("div");
    row.className = "stat-row";
    const label = document.createElement("span");
    label.textContent = `${type.icon || "●"} ${type.name}`;
    const count = document.createElement("span");
    count.className = "stat-count";
    count.textContent = counts.get(type.id) || 0;
    row.append(label, count);
    statistics.appendChild(row);
  }
}

eventTypeForm.addEventListener("submit", async event => {
  event.preventDefault();
  const name = document.getElementById("eventName").value.trim();
  const icon = document.getElementById("eventIcon").value.trim() || "●";
  if (!name) return;
  const eventType = {
    id: crypto.randomUUID(),
    name, icon, color: null,
    loggingMode: "instant",
    fieldDefinitions: [],
    active: true,
    createdAt: new Date().toISOString(),
    description: document.getElementById("eventDescription").value.trim(),
    influenceHorizonMinutes: readHorizon(
        "eventHorizon",
        "eventHorizonUnit"
    )
  };
  try {
    await saveEventType(eventType);
    eventTypes.push(eventType);
    eventTypeDialog.close();
    renderEvents();
    showToast("Event type created");
  } catch (error) {
    console.error(error);
    showToast("Could not create event type");
  }
});

editEventForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!selectedEventType) return;
  const name = editEventName.value.trim();
  if (!name) return;

  const updated = {
    ...selectedEventType,
    name,
    icon: editEventIcon.value.trim() || "●",
    description: document.getElementById("editEventDescription").value.trim(),
    influenceHorizonMinutes: readHorizon(
        "editEventHorizon",
        "editEventHorizonUnit"
    ),
    updatedAt: new Date().toISOString()
  };

  try {
    await saveEventType(updated);
    eventTypes = eventTypes.map(type => type.id === updated.id ? updated : type);
    editEventDialog.close();
    renderEvents();
    showToast("Event type updated");
  } catch (error) {
    console.error(error);
    showToast("Could not update event type");
  }
});

document.getElementById("deleteEventButton").addEventListener("click", async () => {
  if (!selectedEventType) return;
  const type = selectedEventType;
  const confirmed = window.confirm(
    `Delete "${type.name}"?\n\n` +
    "This permanently deletes the event type and all its recorded occurrences.\n\n" +
    "This cannot be undone."
  );
  if (!confirmed) return;
  try {
    await deleteEventType(type.id);
    eventTypes = eventTypes.filter(item => item.id !== type.id);
    events = events.filter(event => event.typeId !== type.id);
    editEventDialog.close();
    renderEvents();
    renderStatistics();
    showToast("Event type deleted");
  } catch (error) {
    console.error(error);
    showToast("Could not delete event type");
  }
});

editEventDialog.addEventListener("close", () => { selectedEventType = null; });
document.getElementById("cancelEditEvent").addEventListener("click", () => editEventDialog.close());
document.getElementById("cancelEventType").addEventListener("click", () => eventTypeDialog.close());
editModeButton.addEventListener("click", () => setEditMode(!isEditMode));
eventsTab.addEventListener("click", () => showTab("events"));
analysisTab.addEventListener("click", () => showTab("analysis"));

async function initializeApp() {
  try {
    eventTypes = await getEventTypes();
    events = await getEvents();
    renderEvents();
    showTab("events");
  } catch (error) {
    console.error("Initialization failed", error);
    showToast("Could not load saved data");
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}
initializeApp();
