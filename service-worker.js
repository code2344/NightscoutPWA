self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => clients.claim());

self.addEventListener("push", event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Nightscout Alert", {
      body: data.body || "",
      icon: "https://raw.githubusercontent.com/nightscout/cgm-remote-monitor/master/static/images/apple-touch-icon-180x180.png"
    })
  );
});
