// -------------------------
// SETTINGS
// -------------------------
const defaultSettings = {
  nsUrl: "https://your-nightscout-instance.herokuapp.com",
  low: 3.9,
  high: 10.0,
  notifLow: true,
  notifHigh: true,
  notifBattery: true
};
let settings = JSON.parse(localStorage.getItem("nsSettings")) || defaultSettings;

const settingsPanel = document.getElementById("settings-panel");
const toggleBtn = document.getElementById("settings-toggle");
const saveBtn = document.getElementById("save-settings");

document.getElementById("ns-url").value = settings.nsUrl;
document.getElementById("low-threshold").value = settings.low;
document.getElementById("high-threshold").value = settings.high;
document.getElementById("notif-low").checked = settings.notifLow;
document.getElementById("notif-high").checked = settings.notifHigh;
document.getElementById("notif-battery").checked = settings.notifBattery;

toggleBtn.addEventListener("click", () => settingsPanel.classList.toggle("hidden"));
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

// -------------------------
// IndexedDB for last 24h
// -------------------------
const dbName = 'nightscout-pwa';
const storeName = 'entries';
let db;
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = e => {
      db = e.target.result;
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = e => { db = e.target.result; resolve(db); };
    request.onerror = e => reject(e);
  });
}
function saveEntries(entries) {
  if (!db) return;
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  entries.forEach(entry => store.put(entry));
  // Keep last 288 entries
  store.openCursor(null, 'prev').onsuccess = e => { const cursor = e.target.result; if (cursor && cursor.primaryKey > 288) cursor.delete(); };
}
function getLast24h() {
  if (!db) return Promise.resolve([]);
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  return new Promise(resolve => {
    const all = [];
    store.openCursor().onsuccess = e => { const cursor = e.target.result; if (cursor) { all.push(cursor.value); cursor.continue(); } else resolve(all); };
  });
}

// -------------------------
// Helpers
// -------------------------
function mgdlToMmol(mgdl) { return (mgdl / 18.0182).toFixed(1); }
function sendNotification(title, body) {
  if (Notification.permission === "granted") {
    navigator.serviceWorker.getRegistration().then(reg => {
      reg?.showNotification(title, { body, icon: "https://raw.githubusercontent.com/nightscout/cgm-remote-monitor/master/static/images/apple-touch-icon-180x180.png" });
    });
  }
}
function checkThresholds(mmol, direction, battery) {
  if (settings.notifLow && mmol < settings.low) sendNotification("Low BG!", `BG: ${mmol} mmol/L`);
  if (settings.notifHigh && mmol > settings.high) sendNotification("High BG!", `BG: ${mmol} mmol/L`);
  if (settings.notifBattery && battery !== "--" && battery < 20) sendNotification("Pump battery low", `Battery at ${battery}%`);
}

// -------------------------
// Chart.js
// -------------------------
let glucoseChart;
function initChart() {
  const ctx = document.getElementById('glucose-chart').getContext('2d');
  glucoseChart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label:'Glucose (mmol/L)', data:[], borderColor:'#0a84ff', backgroundColor:'rgba(10,132,255,0.1)', tension:0.3, fill:true }] },
    options: { responsive:true, maintainAspectRatio:false, scales:{ x:{title:{display:true,text:'Time'} }, y:{title:{display:true,text:'mmol/L'}} }, plugins:{ legend:{display:false} } }
  });
}
async function updateChart(hours) {
  const allData = await getLast24h();
  const now = Date.now();
  const cutoff = now - hours*60*60*1000;
  const filtered = allData.filter(e=>new Date(e.date).getTime()>=cutoff).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const labels = filtered.map(e=>{const d=new Date(e.date);return `${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`});
  const data = filtered.map(e=>parseFloat(mgdlToMmol(e.sgv)));
  glucoseChart.data.labels = labels;
  glucoseChart.data.datasets[0].data = data;
  glucoseChart.update();
}
document.querySelectorAll('.chart-controls button').forEach(btn=>{
  btn.addEventListener('click',()=>{document.querySelectorAll('.chart-controls button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); updateChart(parseInt(btn.dataset.hours));});
});
function refreshChart() { const active = document.querySelector('.chart-controls button.active'); const hours = active?parseInt(active.dataset.hours):24; updateChart(hours); }

// -------------------------
// Fetch data
// -------------------------
async function fetchData() {
  try {
    const res = await fetch(`${settings.nsUrl}/api/v1/entries.json?count=288`);
    const data = await res.json();
    saveEntries(data);
    const latest = data[0];
    const mmol = mgdlToMmol(latest.sgv);
    document.getElementById("glucose-value").textContent = `${mmol} mmol/L`;
    document.getElementById("trend").textContent = latest.direction;
    const deviceRes = await fetch(`${settings.nsUrl}/api/v1/devicestatus.json?count=1`);
    const device = (await deviceRes.json())[0];
    const battery = device?.pump?.battery?.percent ?? "--";
    document.getElementById("battery").textContent = `${battery}%`;
    document.getElementById("iob").textContent = `${device?.openaps?.iob?.iob ?? "--"} U`;
    document.getElementById("cob").textContent = `${device?.openaps?.cob?.cob ?? "--"} g`;
    document.getElementById("connection-status").textContent = "Connected";
    checkThresholds(parseFloat(mmol), latest.direction, battery);
  } catch(err) {
    document.getElementById("connection-status").textContent = "Offline — showing last data";
    const cached = await getLast24h();
    if(cached.length){
      const latest=cached[0]; const mmol=mgdlToMmol(latest.sgv);
      document.getElementById("glucose-value").textContent=`${mmol} mmol/L`;
      document.getElementById("trend").textContent=latest.direction;
    }
  }
  refreshChart();
}

// -------------------------
// Start
// -------------------------
openDB().then(()=>{ fetchData(); setInterval(fetchData,60000); });
initChart();

// Register service worker
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("service-worker.js");
  Notification.requestPermission();
}
