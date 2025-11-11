// Default settings
const defaultSettings = {
  nsUrl: "https://your-nightscout-instance.herokuapp.com",
  low: 3.9,
  high: 10.0,
  notifLow: true,
  notifHigh: true,
  notifBattery: true
};

// Load or create settings in localStorage
let settings = JSON.parse(localStorage.getItem("nsSettings")) || defaultSettings;

// Elements
const settingsPanel = document.getElementById("settings-panel");
const toggleBtn = document.getElementById("settings-toggle");
const saveBtn = document.getElementById("save-settings");

// Populate settings inputs
document.getElementById("ns-url").value = settings.nsUrl;
document.getElementById("low-threshold").value = settings.low;
document.getElementById("high-threshold").value = settings.high;
document.getElementById("notif-low").checked = settings.notifLow;
document.getElementById("notif-high").checked = settings.notifHigh;
document.getElementById("notif-battery").checked = settings.notifBattery;

// Toggle panel
toggleBtn.addEventListener("click", () => settingsPanel.classList.toggle("hidden"));

// Save settings
saveBtn.addEventListener("click", () => {
  settings.nsUrl = document.getElementById("ns-url").value;
  settings.low = parseFloat(document.getElementById("low-threshold").value);
  settings.high = parseFloat(document.getElementById("high-threshold").value);
  settings.notifLow = document.getElementById("notif-low").checked;
  settings.notifHigh = document.getElementById("notif-high").checked;
  settings.notifBattery = document.getElementById("notif-battery").checked;

  localStorage.setItem("nsSettings", JSON.stringify(settings));
  alert("Settings saved!");
});

// BG conversion
function mgdlToMmol(mgdl) { return (mgdl / 18.0182).toFixed(1); }

// Fetch data
async function fetchData() {
  try {
    const res = await fetch(`${settings.nsUrl}/api/v1/entries.json?count=1`);
    const data = await res.json();
    const entry = data[0];
    const mmol = mgdlToMmol(entry.sgv);

    document.getElementById("glucose-value").textContent = `${mmol} mmol/L`;
    document.getElementById("trend").textContent = entry.direction;

    const deviceRes = await fetch(`${settings.nsUrl}/api/v1/devicestatus.json?count=1`);
    const device = (await deviceRes.json())[0];
    const battery = device?.pump?.battery?.percent ?? "--";
    document.getElementById("battery").textContent = `${battery}%`;
    document.getElementById("iob").textContent = `${device?.openaps?.iob?.iob ?? "--"} U`;
    document.getElementById("cob").textContent = `${device?.openaps?.cob?.cob ?? "--"} g`;

    document.getElementById("connection-status").textContent = "Connected";

    checkThresholds(parseFloat(mmol), entry.direction, battery);
  } catch (err) {
    document.getElementById("connection-status").textContent = "Error connecting";
    console.error(err);
  }
}

// Notifications
function checkThresholds(mmol, direction, battery) {
  if (settings.notifLow && mmol < settings.low) sendNotification("Low BG!", `BG: ${mmol} mmol/L`);
  if (settings.notifHigh && mmol > settings.high) sendNotification("High BG!", `BG: ${mmol} mmol/L`);
  if (settings.notifBattery && battery !== "--" && battery < 20)
    sendNotification("Pump battery low", `Battery at ${battery}%`);
}

function sendNotification(title, body) {
  if (Notification.permission === "granted") {
    navigator.serviceWorker.getRegistration().then(reg => {
      reg?.showNotification(title, {
        body,
        icon: "https://raw.githubusercontent.com/nightscout/cgm-remote-monitor/master/static/images/apple-touch-icon-180x180.png"
      });
    });
  }
}

// Start polling
fetchData();
setInterval(fetchData, 60000);

// Service Worker registration
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
  Notification.requestPermission();
}
