/* eslint-disable no-undef */
importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js");

if (self.workbox) {
  self.workbox.precaching.precacheAndRoute(self.__WB_MANIFEST);
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// --------------------
// IndexedDB helper (tiny)
// --------------------
const DB_NAME = "leanplanner_push";
const STORE = "counts";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCount(key) {
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const st = tx.objectStore(STORE);
    const req = st.get(key);
    req.onsuccess = () => resolve(req.result ?? 0);
    req.onerror = () => resolve(0);
  });
}

async function setCount(key, value) {
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

async function resetCount(key) {
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

// --------------------
// PUSH
// --------------------
self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let data = {};
    try {
      data = event.data ? event.data.json() : {};
    } catch {
      data = { title: "New message", body: event.data ? event.data.text() : "" };
    }

    const projectId = data?.data?.projectId || "unknown";
    const projectName = data?.data?.projectName || "Project";
    const url = data?.data?.url || "/";

    // Count key per project
    const key = `project:${projectId}`;
    const prev = await getCount(key);
    const next = prev + 1;
    await setCount(key, next);

    // Group notifications by project
    const tag = `project-chat-${projectId}`;

    // Title + body with count
    const title = next > 1
      ? `${next} new messages · ${projectName}`
      : (data.title || `New message · ${projectName}`);

    const body = next > 1
      ? "Tap to open the project chat."
      : (data.body || "");

    await self.registration.showNotification(title, {
      body,
      tag,
      renotify: true,              // notify again when replacing
      requireInteraction: false,    // true is intrusive; keep false for prod
      data: { url, projectId },
    });
  })());
});

// Reset count when user clicks the notification (they are going to read it)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  const projectId = event.notification.data?.projectId;

  event.waitUntil((async () => {
    if (projectId) {
      await resetCount(`project:${projectId}`);
    }

    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });

    for (const client of allClients) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(url);
        return;
      }
    }

    await clients.openWindow(url);
  })());
});
