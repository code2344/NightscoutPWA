const NIGHTSCOUT_URL = "https://rubensnightscout.herokuapp.com"; // Change this

function mgdlToMmol(mgdl) {
  return (mgdl / 18.0182).toFixed(1);
}

async function fetchData() {
  try {
    const res = await fetch(`${NIGHTSCOUT_URL}/api/v1/entries.json?count=1`);
    const data = await res.json();
    const entry = data[0];
    const mgdl = entry.sgv;
    const mmol = mgdlToMmol(mgdl);
    const direction = entry.direction;

    document.getElementById("glucose-value").textContent = `${mmol} mmol/L`;
    document.getElementById("trend").textContent = direction;

    const deviceRes = await fetch(`${NIGHTSCOUT_URL}/api/v1/devicestatus.json?count=1`);
    const deviceData = await deviceRes.json();
    const battery = deviceData[0]?.pump?.battery?.percent ?? "--";
    document.getElementById("battery").textContent = `${battery}%`;

    const iob = deviceData[0]?.openaps?.iob?.iob ?? "--";
    const cob = deviceData[0]?.openaps?.cob?.cob ?? "--";
    document.getElementById("iob").textContent = `${iob} U`;
    document.getElementById("cob").textContent = `${cob} g`;

    document.getElementById("connection-status").textContent = "Connected";

    checkThresholds(mmol, direction, battery);
  } catch (err) {
    document.getElementById("connection-status").textContent = "Error connecting";
    console.error(err);
  }
}

function checkThresholds(mmol, direction, battery) {
  const mmolNum = parseFloat(mmol);
  if (mmolNum < 3.9) sendNotification("Low blood sugar!", `Your BG is ${mmol} mmol/L`);
  if (mmolNum > 10.0) sendNotification("High blood sugar!", `Your BG is ${mmol} mmol/L`);
  if (battery !== "--" && battery < 20)
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

// Periodic updates
fetchData();
setInterval(fetchData, 60000);

// Service Worker registration
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
  Notification.requestPermission();
}
