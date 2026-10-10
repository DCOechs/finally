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

const logEventDialog = document.getElementById("logEventDialog");
const logEventForm = document.getElementById("logEventForm");
const logEventTitle = document.getElementById("logEventTitle");
const logEventFields = document.getElementById("logEventFields");

let selectedLoggingType = null;



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


const customFields = {
    create: [],
    edit: []
};

const FIELD_TYPES = {
    number: "Number",
    choice: "Single choice",
    boolean: "Yes / No",
    duration: "Duration",
    text: "Text"
};

function renderCustomFields(mode) {
    const dialog = mode === "create" ? eventTypeDialog : editEventDialog;
    const list = dialog.querySelector(".field-list");

    list.replaceChildren();

    for (const field of customFields[mode]) {
        const row = document.createElement("div");
        row.className = "custom-field-row";

        const info = document.createElement("div");
        info.className = "custom-field-info";

        const name = document.createElement("strong");
        name.textContent = field.label;

        const details = document.createElement("small");

        let summary = FIELD_TYPES[field.type];

        if (field.type === "number" && field.unit) {
            summary += ` · ${field.unit}`;
        }

        if (field.type === "duration") {
            summary += ` · ${field.unit}`;
        }

        if (field.type === "choice") {
            summary += ` · ${field.options?.length || 0} choices`;
        }

        summary += field.required ? " · Required" : " · Optional";

        details.textContent = summary;

        info.append(name, details);

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-field-button";
        removeButton.textContent = "×";
        removeButton.setAttribute("aria-label", `Remove ${field.label}`);

        removeButton.addEventListener("click", () => {
            customFields[mode] = customFields[mode].filter(
                item => item.id !== field.id
            );
            renderCustomFields(mode);
        });

        row.append(info, removeButton);
        list.appendChild(row);
    }
}

function openAddFieldEditor(mode) {
    const dialog = mode === "create" ? eventTypeDialog : editEventDialog;
    const section = dialog.querySelector(".custom-fields-section");

    if (section.querySelector(".field-editor")) return;

    const editor = document.createElement("div");
    editor.className = "field-editor";

    editor.innerHTML = `
        <label>
            Field name
            <input class="field-name-input"
                   type="text"
                   placeholder="e.g. Intensity">
        </label>

        <label>
            Field type
            <select class="field-type-input">
                <option value="number">Number</option>
                <option value="choice">Single choice</option>
                <option value="boolean">Yes / No</option>
                <option value="duration">Duration</option>
                <option value="text">Text</option>
            </select>
        </label>


        <div class="field-type-settings"></div>

        <label class="field-required-label">
            <input class="field-required-input" type="checkbox">
            Required
        </label>


        <div class="field-editor-actions">
            <button type="button" class="cancel-field-button">Cancel</button>
            <button type="button" class="save-field-button">Add field</button>
        </div>
    `;

    section.appendChild(editor);


    const typeSelect = editor.querySelector(".field-type-input");
    const settingsContainer = editor.querySelector(".field-type-settings");

    function renderFieldTypeSettings() {
        const type = typeSelect.value;

        settingsContainer.replaceChildren();

        if (type === "number") {
            settingsContainer.innerHTML = `
                <label>
                    Unit (optional)
                    <input class="number-unit"
                           type="text"
                           placeholder="e.g. cups, kg, mg">
                </label>

                <label>
                    Minimum (optional)
                    <input class="number-min"
                           type="number"
                           step="any">
                </label>

                <label>
                    Maximum (optional)
                    <input class="number-max"
                           type="number"
                           step="any">
                </label>
            `;
        }

        if (type === "choice") {
            settingsContainer.innerHTML = `
                <label>
                    Choices (one per line)
                    <textarea class="choice-options"
                              rows="4"
                              placeholder="Small&#10;Medium&#10;Large"></textarea>
                </label>
            `;
        }

        if (type === "duration") {
            settingsContainer.innerHTML = `
                <label>
                    Duration unit
                    <select class="duration-unit">
                        <option value="seconds">Seconds</option>
                        <option value="minutes" selected>Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                    </select>
                </label>
            `;
        }
    }

    typeSelect.addEventListener("change", renderFieldTypeSettings);
    renderFieldTypeSettings();


    editor.querySelector(".cancel-field-button").addEventListener("click", () => {
        editor.remove();
    });

    editor.querySelector(".save-field-button").addEventListener("click", () => {
        const label = editor.querySelector(".field-name-input").value.trim();
        const type = editor.querySelector(".field-type-input").value;
        const required = editor.querySelector(".field-required-input").checked;

        if (!label) {
            editor.querySelector(".field-name-input").focus();
            return;
        }


        const field = {
            id: crypto.randomUUID(),
            label,
            type,
            required
        };

        if (type === "number") {
            field.unit = editor.querySelector(".number-unit").value.trim();

            const minInput = editor.querySelector(".number-min").value;
            const maxInput = editor.querySelector(".number-max").value;

            field.min = minInput === "" ? null : Number(minInput);
            field.max = maxInput === "" ? null : Number(maxInput);

            if (
                field.min !== null &&
                field.max !== null &&
                field.min > field.max
            ) {
                showToast("Minimum cannot exceed maximum");
                return;
            }
        }

        if (type === "choice") {
            field.options = editor.querySelector(".choice-options").value
                .split("\n")
                .map(option => option.trim())
                .filter(Boolean);

            if (field.options.length === 0) {
                showToast("Add at least one choice");
                return;
            }
        }

        if (type === "duration") {
            field.unit = editor.querySelector(".duration-unit").value;
        }

        customFields[mode].push(field);


        editor.remove();
        renderCustomFields(mode);
    });

    editor.querySelector(".field-name-input").focus();
}

eventTypeDialog.querySelector(".add-field-button").addEventListener("click", () => {
    openAddFieldEditor("create");
});

editEventDialog.querySelector(".add-field-button").addEventListener("click", () => {
    openAddFieldEditor("edit");
});


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

  customFields.edit = structuredClone(type.fieldDefinitions || []);
  editEventDialog.querySelector(".field-editor")?.remove();
  renderCustomFields("edit");

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
    if (isEditMode) {
        openEditEvent(type);
    } else if ((type.fieldDefinitions || []).length > 0) {
        openLogEvent(type);
    } else {
        logEvent(type);
    }
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
    customFields.create = [];
    eventTypeDialog.querySelector(".field-editor")?.remove();
    renderCustomFields("create");
    eventTypeDialog.showModal();

  });
  eventGrid.appendChild(addTile);
}


function openLogEvent(type) {
    selectedLoggingType = type;
    logEventForm.reset();
    logEventFields.replaceChildren();

    logEventTitle.textContent = `${type.icon || "●"} ${type.name}`;

    for (const field of type.fieldDefinitions || []) {
        const wrapper = document.createElement("div");
        wrapper.className = "log-field";

        const label = document.createElement("label");
        label.textContent = field.label;

        const inputId = `log-field-${field.id}`;
        label.htmlFor = inputId;

        let input;


        if (field.type === "choice" || field.type === "boolean") {
            input = document.createElement("input");
            input.type = "hidden";
            input.id = inputId;
            input.value = "";

            const buttonGroup = document.createElement("div");
            buttonGroup.className = "choice-buttons";
            buttonGroup.setAttribute("role", "group");
            buttonGroup.setAttribute("aria-label", field.label);

            const options = field.type === "boolean"
                ? [
                    { value: "true", label: "Yes" },
                    { value: "false", label: "No" }
                ]
                : (field.options || []).map(option => ({
                    value: option,
                    label: option
                }));

            for (const option of options) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "choice-button";
                button.textContent = option.label;
                button.setAttribute("aria-pressed", "false");

                button.addEventListener("click", () => {
                    const alreadySelected = input.value === option.value;

                    // Tapping the selected option again clears it.
                    input.value = alreadySelected ? "" : option.value;

                    for (const other of buttonGroup.children) {
                        const selected = other === button && !alreadySelected;
                        other.classList.toggle("selected", selected);
                        other.setAttribute("aria-pressed", String(selected));
                    }
                });

                buttonGroup.appendChild(button);
            }

            wrapper.append(label, input, buttonGroup);

        } else {
            if (field.type === "text") {
                input = document.createElement("textarea");
                input.rows = 3;
            } else {
                input = document.createElement("input");
                input.type = "number";
                input.step = "any";

                if (field.type === "duration") {
                    input.min = "0";
                }

                if (field.type === "number") {
                    if (field.min != null) input.min = field.min;
                    if (field.max != null) input.max = field.max;
                }
            }

            input.id = inputId;
            input.required = field.required;

            wrapper.append(label, input);
        }

        input.dataset.fieldId = field.id;
        input.dataset.fieldType = field.type;

        // Hidden inputs do not participate in native required validation.
        // We'll validate button selections ourselves when saving.
        if (field.unit) {
            const unit = document.createElement("small");
            unit.textContent = field.unit;
            wrapper.appendChild(unit);
        }


        logEventFields.appendChild(wrapper);
    }

    logEventDialog.showModal();
}


logEventForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!selectedLoggingType) return;

    const values = {};

    for (const field of selectedLoggingType.fieldDefinitions || []) {
        const input = document.getElementById(`log-field-${field.id}`);
        const raw = input.value.trim();


        if (raw === "") {
            if (field.required) {
                if (field.type === "choice" || field.type === "boolean") {
                    const group = input.parentElement.querySelector(".choice-buttons");
                    group?.querySelector("button")?.focus();
                    showToast(`Please select ${field.label}`);
                } else {
                    input.focus();
                }
                return;
            }
            continue;
        }


        if (field.type === "boolean") {
            values[field.id] = raw === "true";
        } else if (field.type === "number" || field.type === "duration") {
            values[field.id] = Number(raw);
        } else {
            values[field.id] = raw;
        }
    }

    const timestamp = new Date().toISOString();

    const loggedEvent = {
        id: crypto.randomUUID(),
        typeId: selectedLoggingType.id,
        occurredAt: timestamp,
        createdAt: timestamp,
        values
    };

    try {
        await saveEvent(loggedEvent);
        events.push(loggedEvent);

        const name = selectedLoggingType.name;
        logEventDialog.close();
        showToast(`${name} recorded`);
    } catch (error) {
        console.error(error);
        showToast("Could not save event");
    }
});

document.getElementById("cancelLogEvent").addEventListener("click", () => {
    logEventDialog.close();
});

logEventDialog.addEventListener("close", () => {
    selectedLoggingType = null;
});



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
    fieldDefinitions: structuredClone(customFields.create),
    active: true,
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
    fieldDefinitions: structuredClone(customFields.edit),
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
