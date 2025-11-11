const glucoseEl = document.getElementById("glucose");
const trendEl = document.getElementById("trend");
const updatedEl = document.getElementById("updated");

const urlInput = document.getElementById("url");
const lowInput = document.getElementById("low");
const highInput = document.getElementById("high");
const saveButton = document.getElementById("save");

let settings = JSON.parse(localStorage.getItem("settings")) || {
  url: "",
  low: 4.0,
  high: 10.0
};

urlInput.value = settings.url;
lowInput.value = settings.low;
highInput.value = settings.high;

saveButton.onclick = () => {
  settings = {
    url: urlInput.value.trim(),
    low: parseFloat(lowInput.value),
    high: parseFloat(highInput.value)
  };
  localStorage.setItem("settings", JSON.stringify(settings));
  alert("Settings saved!");
};

// --- Fetch and display latest glucose ---
async function fetchData() {
  if (!settings.url) return;
  try {
    const res = await fetch(`${settings.url}/api/v1/entries.json?count=2`);
    const data = await res.json();
    const latest = data[0];
    const prev = data[1];
    const glucose = latest.sgv / 18; // mg/dL → mmol/L
    const delta = latest.sgv - prev.sgv;
    const rate = delta / ((latest.date - prev.date) / 60000); // mg/dL per min

    glucoseEl.textContent = `${glucose.toFixed(1)} mmol/L`;
    trendEl.textContent = `${delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} ${delta.toFixed(1)} mg/dL`;
    updatedEl.textContent = `Last updated: ${new Date(latest.dateString).toLocaleTimeString()}`;

    // Send message to service worker for background checks
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "update",
        glucose,
        rate,
        settings
      });
    }
  } catch (e) {
    console.error("Error fetching Nightscout data:", e);
  }
}

// Refresh every 5 minutes
setInterval(fetchData, 5 * 60 * 1000);
fetchData();

// --- PWA & Notification setup ---
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(() => {
    console.log("Service Worker registered.");
  });
}

if (Notification.permission !== "granted") {
  Notification.requestPermission();
}
