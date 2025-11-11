self.addEventListener("install", e => {
  console.log("Service Worker installed.");
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  console.log("Service Worker activated.");
  e.waitUntil(clients.claim());
});

let lastGlucose = null;
let settings = null;

self.addEventListener("message", event => {
  if (event.data.type === "update") {
    lastGlucose = event.data.glucose;
    settings = event.data.settings;
    checkAlerts(event.data);
  }
});

function checkAlerts(data) {
  const { glucose, rate, settings } = data;
  if (!glucose || !settings) return;

  if (glucose < settings.low) {
    showNotification("Low glucose alert", `Your glucose is ${glucose.toFixed(1)} mmol/L`);
  } else if (glucose > settings.high) {
    showNotification("High glucose alert", `Your glucose is ${glucose.toFixed(1)} mmol/L`);
  } else if (rate < -2) {
    showNotification("Rapid drop", "Your glucose is falling quickly!");
  } else if (rate > 2) {
    showNotification("Rapid rise", "Your glucose is rising quickly!");
  }
}

function showNotification(title, body) {
  self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [200, 100, 200],
    tag: "glucose-alert"
  });
}
