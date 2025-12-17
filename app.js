// =========================
// Full app.js — FULL FEATURE
// =========================

// ===== CONFIG =====
const API_BASE = "https://loneworking-production.up.railway.app";
const CORRECT_PIN = "1234";

// ===== MAP GLOBALS (ADDED) =====
let leafletMap = null;
let leafletMarker = null;

// ===== PIN LOCK FEATURE =====
(function initPinLock() {
  const pinScreen = document.getElementById("pinLockScreen");
  const pinInput = document.getElementById("pinInput");
  const pinSubmit = document.getElementById("pinSubmit");
  const pinError = document.getElementById("pinError");
  const mainContent = document.getElementById("mainContent");

  if (!pinScreen || !pinInput || !pinSubmit || !mainContent) return;

  mainContent.style.filter = "blur(3px)";
  mainContent.style.pointerEvents = "none";

  const unlock = () => {
    if ((pinInput.value || "").trim() === CORRECT_PIN) {
      pinScreen.style.display = "none";
      mainContent.style.filter = "none";
      mainContent.style.pointerEvents = "auto";
    } else {
      if (pinError) pinError.style.display = "block";
      pinInput.value = "";
      pinInput.focus();
    }
  };

  pinSubmit.addEventListener("click", unlock);
  pinInput.addEventListener("keypress", e => {
    if (e.key === "Enter") unlock();
  });
})();

// ===== Utility =====
function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ===== Get and autofill user location (MAP ADDED) =====
async function getUserLocation() {
  const siteInput = document.getElementById("site");
  const mapDiv = document.getElementById("map");
  if (!siteInput) return;

  if (!navigator.geolocation) {
    siteInput.placeholder = "Geolocation not supported";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async position => {
      const { latitude, longitude } = position.coords;

      siteInput.value = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`
        );
        const data = await res.json();
        if (data?.display_name) siteInput.value = data.display_name;
      } catch (err) {
        console.warn("Reverse geocoding failed:", err);
      }

      // ===== MAP DISPLAY =====
      if (mapDiv) {
        mapDiv.style.display = "block";

        if (!leafletMap) {
          leafletMap = L.map("map").setView([latitude, longitude], 16);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap"
          }).addTo(leafletMap);

          leafletMarker = L.marker([latitude, longitude]).addTo(leafletMap);
        } else {
          leafletMap.setView([latitude, longitude], 16);
          leafletMarker.setLatLng([latitude, longitude]);
        }
      }
    },
    error => {
      console.error("Location error:", error);
      siteInput.placeholder = "Location permission denied";
    }
  );
}

// ===== Active Check-ins =====
async function updateActiveCheckins() {
  const container = document.getElementById("activeCheckins");
  if (!container) return;

  container.innerHTML = "<h2>Active Check-Ins</h2><p>Loading...</p>";

  try {
    const response = await fetch(`${API_BASE}/checkins`);
    if (!response.ok) throw new Error(response.status);
    const data = await response.json();

    if (!Array.isArray(data) || !data.length) {
      container.innerHTML = "<h2>Active Check-Ins</h2><p>No active check-ins.</p>";
      return;
    }

    let html = "<h2>Active Check-Ins</h2><ul style='list-style:none;padding:0'>";
    data.forEach(c => {
      html += `
        <li style="margin-bottom:10px">
          <strong>${escapeHtml(c.user)}</strong><br>
          ${escapeHtml(c.site)}<br>
          Expires: ${new Date(c.expires).toLocaleTimeString()}<br>
          Contact: ${escapeHtml(c.emergency_contact || "N/A")}<br>
          <button class="cancel-btn" data-user="${encodeURIComponent(c.user)}" data-site="${encodeURIComponent(c.site)}">Cancel</button>
        </li>`;
    });
    html += "</ul>";
    container.innerHTML = html;

    container.querySelectorAll(".cancel-btn").forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("Cancel check-in?")) return;
        await fetch(`${API_BASE}/cancel_checkin/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: decodeURIComponent(btn.dataset.user),
            site: decodeURIComponent(btn.dataset.site)
          })
        });
        updateActiveCheckins();
        updateCheckinHistory();
      };
    });
  } catch {
    container.innerHTML = "<p>Error loading active check-ins.</p>";
  }
}

// ===== History =====
async function updateCheckinHistory() {
  const container = document.getElementById("checkinHistoryContent");
  if (!container) return;

  container.innerHTML = "<p>Loading...</p>";

  try {
    const response = await fetch(`${API_BASE}/checkin_history`);
    const data = await response.json();

    if (!Array.isArray(data) || !data.length) {
      container.innerHTML = "<p>No history.</p>";
      return;
    }

    container.innerHTML = data.map(c => `
      <div style="margin-bottom:8px">
        <strong>${escapeHtml(c.user)}</strong> — ${escapeHtml(c.site)}<br>
        In: ${new Date(c.checked_in_at).toLocaleString()}<br>
        Out: ${c.canceled_at || c.expired_at || "Active"}
      </div>`).join("");
  } catch {
    container.innerHTML = "<p>Error loading history.</p>";
  }
}

// ===== Contacts =====
async function loadContacts() {
  const select = document.getElementById("emergencyContact");
  if (!select) return;

  select.innerHTML = "<option>Loading...</option>";

  try {
    const res = await fetch(`${API_BASE}/contacts`);
    const data = await res.json();
    select.innerHTML = data.map(c =>
      `<option value="${c.name} | ${c.phone}">${c.name} (${c.phone})</option>`
    ).join("");
  } catch {
    select.innerHTML = "<option>Error loading contacts</option>";
  }
}

async function saveNewContact() {
  const name = newContactName.value.trim();
  const phone = newContactPhone.value.trim();
  if (!name || !phone) return alert("Name and phone required");

  await fetch(`${API_BASE}/add_contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, phone })
  });

  newContactForm.style.display = "none";
  loadContacts();
}

// ===== Check-In =====
async function doCheckIn() {
  const userVal = user.value.trim();
  const siteVal = site.value.trim();
  const time = checkinTime.value;

  if (!userVal || !siteVal || !time) return alert("Missing fields");

  const [h, m] = time.split(":").map(Number);
  const now = new Date();
  const expires = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  const minutes = Math.ceil((expires - now) / 60000);
  if (minutes <= 0) return alert("Time must be in future");

  await fetch(`${API_BASE}/checkin/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userVal,
      site: siteVal,
      minutes,
      emergency_contact: emergencyContact.value
    })
  });

  updateActiveCheckins();
  updateCheckinHistory();
}

// ===== CSV =====
async function handleDownloadHistory() {
  const res = await fetch(`${API_BASE}/checkin_history`);
  const data = await res.json();
  if (!data.length) return alert("No history");

  const rows = [["User", "Site", "In", "Out"]];
  data.forEach(e => {
    rows.push([e.user, e.site, e.checked_in_at, e.canceled_at || e.expired_at]);
  });

  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "checkin-history.csv";
  a.click();
}

// ===== DOM READY =====
document.addEventListener("DOMContentLoaded", () => {
  checkin.onclick = doCheckIn;
  getLocation.onclick = getUserLocation;
  addContactBtn.onclick = () => newContactForm.style.display = "block";
  cancelNewContact.onclick = () => newContactForm.style.display = "none";
  saveNewContact.onclick = saveNewContact;
  downloadHistoryBtn.onclick = handleDownloadHistory;

  loadContacts();
  updateActiveCheckins();
  updateCheckinHistory();

  setInterval(() => {
    updateActiveCheckins();
    updateCheckinHistory();
  }, 30000);
});
