// Operator app push service worker. Served at /operator/sw.js with scope /operator/ (the Operator app is
// one page of a larger site), and a notification tap only ever reuses an Operator app tab.
// Deliberately does no caching (no offline layer), only push handling, so there
// is never any risk of serving stale app content.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || "Notification";
  const options = {
    body: data.body || "New job request",
    icon: "/operator/icon-192.png",
    badge: "/operator/badge-96.png",
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || "/operator/today" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/operator/today";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const mine = self.location.origin + "/operator";
    for (const client of all) {
      // Never reuse another page of the site (the public website, the sign-up form, the Driver App).
      if (client.url !== mine && !client.url.startsWith(mine + "/") && !client.url.startsWith(mine + "?")) continue;
      if ("focus" in client) {
        try { await client.navigate(url); } catch { /* ignore */ }
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
