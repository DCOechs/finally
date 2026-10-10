
const eventsTab = document.getElementById("eventsTab");
const analysisTab = document.getElementById("analysisTab");

const eventsView = document.getElementById("eventsView");
const analysisView = document.getElementById("analysisView");

const eventGrid = document.getElementById("eventGrid");
const statistics = document.getElementById("statistics");

const dialog = document.getElementById("eventTypeDialog");
const eventTypeForm = document.getElementById("eventTypeForm");

const toast = document.getElementById("toast");

let eventTypes = [];
let events = [];
let toastTimeout;

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("visible");
    }, 1800);
}

function showTab(tab) {
    const isEvents = tab === "events";

    eventsView.hidden = !isEvents;
    analysisView.hidden = isEvents;

    eventsTab.classList.toggle("active", isEvents);
    analysisTab.classList.toggle("active", !isEvents);

    eventsTab.setAttribute("aria-selected", isEvents);
    analysisTab.setAttribute("aria-selected", !isEvents);

    if (!isEvents) {
        renderStatistics();
    }
}

function renderEvents() {
    eventGrid.replaceChildren();

    for (const type of eventTypes) {
        const tile = document.createElement("button");
        tile.className = "event-tile";
        tile.type = "button";

        const icon = document.createElement("span");
        icon.className = "tile-icon";
        icon.textContent = type.icon || "●";

        const name = document.createElement("span");
        name.className = "tile-name";
        name.textContent = type.name;

        tile.append(icon, name);

        tile.addEventListener("click", () => {
            logEvent(type);
        });

        eventGrid.appendChild(tile);
    }

    const addTile = document.createElement("button");
    addTile.className = "event-tile add-tile";
    addTile.type = "button";

    const plus = document.createElement("span");
    plus.className = "tile-icon";
    plus.textContent = "+";

    const label = document.createElement("span");
    label.className = "tile-name";
    label.textContent = "Add event";

    addTile.append(plus, label);

    addTile.addEventListener("click", () => {
        eventTypeForm.reset();
        dialog.showModal();
    });

    eventGrid.appendChild(addTile);
}

async function logEvent(type) {
    const event = {
        id: crypto.randomUUID(),
        typeId: type.id,
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
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

    for (const type of eventTypes) {
        const count = events.filter(
            event => event.typeId === type.id
        ).length;

        const row = document.createElement("div");
        row.className = "stat-row";

        const label = document.createElement("span");
        label.textContent = (type.icon || "●") + " " + type.name;

        const number = document.createElement("span");
        number.className = "stat-count";
        number.textContent = count;

        row.append(label, number);
        statistics.appendChild(row);
    }

    if (eventTypes.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No events tracked yet.";
        statistics.appendChild(empty);
    }
}

eventTypeForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = document.getElementById("eventName")
        .value.trim();

    const icon = document.getElementById("eventIcon")
        .value.trim() || "●";

    if (!name) return;

    const eventType = {
        id: crypto.randomUUID(),
        name,
        icon,
        color: null,
        loggingMode: "instant",
        fieldDefinitions: [],
        active: true,
        createdAt: new Date().toISOString()
    };

    try {
        await saveEventType(eventType);
        eventTypes.push(eventType);

        dialog.close();
        renderEvents();

        showToast("Event type created");
    } catch (error) {
        console.error(error);
        showToast("Could not create event type");
    }
});

document.getElementById("cancelEventType")
    .addEventListener("click", () => dialog.close());

eventsTab.addEventListener("click", () => showTab("events"));
analysisTab.addEventListener("click", () => showTab("analysis"));

async function initializeApp() {
    try {
        eventTypes = await getEventTypes();
        events = await getEvents();

        renderEvents();
        showTab("events");
    } catch (error) {
        console.error("Initialization failed:", error);
        showToast("Could not load saved data");
    }
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js")
            .catch(console.error);
    });
}

initializeApp();
