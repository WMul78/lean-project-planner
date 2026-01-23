/* eslint-disable no-undef */

// Dit bestand wordt door next-pwa/workbox gebruikt als "source" SW (injectManifest)

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let data = {};
    try {
      data = event.data ? event.data.json() : {};
    } catch {
      data = {
        title: "Test",
        body: event.data ? event.data.text() : "Push received",
      };
    }

    // DEBUG: bewijs dat push event aankomt
    const allClients = await clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    for (const client of allClients) {
      client.postMessage({ type: "PUSH_RECEIVED", data });
    }

    await self.registration.showNotification(data.title || "New message", {
      body: data.body || "",
      data: data.data || {},
      requireInteraction: true,
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil((async () => {
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
