const DB_NAME = "finallyDB";
const DB_VERSION = 1;
let databasePromise = null;

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("eventTypes")) {
        db.createObjectStore("eventTypes", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("events")) {
        const store = db.createObjectStore("events", { keyPath: "id" });
        store.createIndex("typeId", "typeId", { unique: false });
        store.createIndex("occurredAt", "occurredAt", { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); databasePromise = null; };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Database upgrade blocked"));
  }).catch(error => { databasePromise = null; throw error; });
  return databasePromise;
}

async function dbOperation(storeName, mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;
    let request;
    try { request = action(store); }
    catch (error) { transaction.abort(); reject(error); return; }
    request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Transaction aborted"));
  });
}

function saveEventType(eventType) {
  return dbOperation("eventTypes", "readwrite", store => store.put(eventType));
}
function getEventTypes() {
  return dbOperation("eventTypes", "readonly", store => store.getAll());
}
function saveEvent(event) {
  return dbOperation("events", "readwrite", store => store.put(event));
}
function getEvents() {
  return dbOperation("events", "readonly", store => store.getAll());
}
function deleteEvent(id) {
  return dbOperation("events", "readwrite", store => store.delete(id));
}

function deleteEventType(typeId) {
  return openDatabase().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(["eventTypes", "events"], "readwrite");
    const typeStore = transaction.objectStore("eventTypes");
    const eventStore = transaction.objectStore("events");
    const index = eventStore.index("typeId");
    typeStore.delete(typeId);
    const request = index.openKeyCursor(IDBKeyRange.only(typeId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        eventStore.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Deletion aborted"));
  }));
}
