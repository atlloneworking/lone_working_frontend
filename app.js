// =========================  
// Full app.js — FULL FEATURE (MERGED + MAP SUPPORT)
// =========================

// ===== CONFIG =====
const API_BASE = "https://loneworking-production.up.railway.app";
const CORRECT_PIN = "1234";

// ===== MAP GLOBALS =====
let map = null;
let mapMarker = null;

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
    const entered = (pinInput.value || "").trim();
    if (entered === CORRECT_PIN) {
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
  pinInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") unlock();
  });
})();

// ===== Utility =====
function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}

// ===== MAP INITIALIZATION =====
function initMap(lat, lon) {
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;

  mapDiv.style.display = "block";

  if (!map) {
    map = L.map("map").setView([lat, lon], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap"
    }).addTo(map);
  } else {
    map.setView([lat, lon], 16);
  }

  if (mapMarker) {
    mapMarker.setLatLng([lat, lon]);
  } else {
    mapMarker = L.marker([lat, lon]).addTo(map);
  }
}

// ===== Get and autofill user location + MAP =====
async function getUserLocation() {
  const siteInput = document.getElementById("site");
  if (!siteInput) return;

  if (!navigator.geolocation) {
    siteInput.placeholder = "Geolocation not supported";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;

      initMap(latitude, longitude);

      siteInput.value = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`
        );
        const data = await res.json();
        if (data && data.display_name) {
          siteInput.value = data.display_name;
        }
      } catch (err) {
        console.warn("Reverse geocoding failed:", err);
      }
    },
    (error) => {
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

    let html = "<h2>Active Check-Ins</h2><ul style='list-style:none;padding-left:0'>";
    data.forEach(c => {
      html += `
        <li style="display:flex;justify-content:space-between;flex-wrap:wrap;margin-bottom:8px;">
          <div>
            <strong>${escapeHtml(c.user)}</strong><br>
            ${escapeHtml(c.site)}<br>
            Expires: ${new Date(c.expires).toLocaleTimeString()}<br>
            <span style="color:#c0392b;">Contact: ${escapeHtml(c.emergency_contact || "N/A")}</span>
          </div>
          <button class="cancel-btn"
            data-user="${encodeURIComponent(c.user)}"
            data-site="${encodeURIComponent(c.site)}"
            style="background:#e74c3c;color:#fff;border:none;border-radius:6px;padding:10px;">
            Cancel
          </button>
        </li>`;
    });
    html += "</ul>";
    container.innerHTML = html;

    container.querySelectorAll(".cancel-btn").forEach(btn => {
      btn.onclick = async () => {
        const user = decodeURIComponent(btn.dataset.user);
        const site = decodeURIComponent(btn.dataset.site);
        if (!confirm(`Cancel check-in for ${user} at ${site}?`)) return;

        await fetch(`${API_BASE}/cancel_checkin/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user, site })
        });

        updateActiveCheckins();
        updateCheckinHistory();
      };
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Error loading active check-ins.</p>";
  }
}

// ===== Check-in History (FULL) =====
async function updateCheckinHistory() {
  const container = document.getElementById("checkinHistoryContent");
  if (!container) return;

  container.innerHTML = "<p>Loading...</p>";

  try {
    const res = await fetch(`${API_BASE}/checkin_history`);
    const data = await res.json();

    if (!Array.isArray(data) || !data.length) {
      container.innerHTML = "<p>No check-in history.</p>";
      return;
    }

    data.sort((a, b) => {
      const aEnd = a.canceled_at || a.expired_at || a.checked_in_at;
      const bEnd = b.canceled_at || b.expired_at || b.checked_in_at;
      return new Date(bEnd) - new Date(aEnd);
    });

    container.innerHTML = data.map(c => {
      const inTime = new Date(c.checked_in_at).toLocaleString();
      const outTime = c.canceled_at
        ? `${new Date(c.canceled_at).toLocaleString()} — 🚪 Check Out`
        : c.expired_at
        ? `${new Date(c.expired_at).toLocaleString()} — ⚠️ Expired`
        : "";

      return `
        <div style="border:1px solid #ddd;border-radius:8px;padding:10px;margin-bottom:10px;">
          <strong>${escapeHtml(c.user)}</strong> — ${escapeHtml(c.site)}<br>
          <div style="color:#2ecc71;">${inTime} — ✅ Check In</div>
          ${outTime ? `<div style="color:#e74c3c;">${outTime}</div>` : ""}
          <div style="color:#c0392b;margin-top:6px;">Contact: ${escapeHtml(c.emergency_contact || "N/A")}</div>
        </div>`;
    }).join("");

  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Error loading history.</p>";
  }
}

// ===== Contacts =====
async function loadContacts(selectedName = null, selectedPhone = null) {
  const select = document.getElementById("emergencyContact");
  if (!select) return;

  const res = await fetch(`${API_BASE}/contacts`);
  const data = await res.json();
  select.innerHTML = "";

  data.forEach(c => {
    const opt = document.createElement("option");
    opt.value = `${c.name} | ${c.phone}`;
    opt.textContent = `${c.name} (${c.phone})`;
    select.appendChild(opt);
  });

  if (selectedName && selectedPhone) {
    select.value = `${selectedName} | ${selectedPhone}`;
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

  loadContacts(name, phone);
  newContactForm.style.display = "none";
}

// ===== Check-in =====
async function doCheckIn() {
  const user = userEl.value.trim();
  const site = siteEl.value.trim();
  const time = checkinTime.value;

  if (!user || !site || !time) return alert("Fill all fields");

  const [h, m] = time.split(":").map(Number);
  const now = new Date();
  const expires = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  const mins = Math.ceil((expires - now) / 60000);
  if (mins <= 0) return alert("Time must be future");

  await fetch(`${API_BASE}/checkin/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: user,
      site,
      minutes: mins,
      emergency_contact: emergencyContact.value
    })
  });

  updateActiveCheckins();
  updateCheckinHistory();
}

// ===== DOM READY =====
document.addEventListener("DOMContentLoaded", () => {
  getLocation.addEventListener("click", getUserLocation);
  checkin.addEventListener("click", doCheckIn);
  addContactBtn.addEventListener("click", () => newContactForm.style.display = "block");
  cancelNewContact.addEventListener("click", () => newContactForm.style.display = "none");
  saveNewContact.addEventListener("click", saveNewContact);

  loadContacts();
  updateActiveCheckins();
  updateCheckinHistory();

  setInterval(() => {
    updateActiveCheckins();
    updateCheckinHistory();
  }, 30000);

  getUserLocation();
});
