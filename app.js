// =========================
// Full app.js — FULL FEATURE + MAP
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
    if (pinInput.value === CORRECT_PIN) {
      pinScreen.style.display = "none";
      mainContent.style.filter = "none";
      mainContent.style.pointerEvents = "auto";
    } else {
      pinError.style.display = "block";
      pinInput.value = "";
    }
  };

  pinSubmit.addEventListener("click", unlock);
  pinInput.addEventListener("keypress", e => e.key === "Enter" && unlock());
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

// ===== LOCATION + MAP =====
async function getUserLocation() {
  const siteInput = document.getElementById("site");
  const mapDiv = document.getElementById("map");
  if (!navigator.geolocation) {
    siteInput.placeholder = "Geolocation not supported";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async pos => {
      const { latitude, longitude } = pos.coords;

      // Show map
      mapDiv.style.display = "block";

      // Init map once
      if (!map) {
        map = L.map("map").setView([latitude, longitude], 16);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap"
        }).addTo(map);
        mapMarker = L.marker([latitude, longitude]).addTo(map);
      } else {
        map.setView([latitude, longitude], 16);
        mapMarker.setLatLng([latitude, longitude]);
      }

      // Reverse geocode
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
        );
        const data = await res.json();
        siteInput.value = data.display_name || `Lat ${latitude}, Lon ${longitude}`;
      } catch {
        siteInput.value = `Lat ${latitude}, Lon ${longitude}`;
      }
    },
    () => {
      siteInput.placeholder = "Location permission denied";
    }
  );
}

// ===== ACTIVE CHECKINS =====
async function updateActiveCheckins() {
  const container = document.getElementById("activeCheckins");
  container.innerHTML = "<h2>Active Check-Ins</h2><p>Loading...</p>";

  try {
    const res = await fetch(`${API_BASE}/checkins`);
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = "<h2>Active Check-Ins</h2><p>No active check-ins.</p>";
      return;
    }

    container.innerHTML =
      "<h2>Active Check-Ins</h2>" +
      data.map(c => `
        <div style="margin-bottom:10px;">
          <strong>${escapeHtml(c.user)}</strong><br>
          ${escapeHtml(c.site)}<br>
          Expires: ${new Date(c.expires).toLocaleTimeString()}<br>
          <button data-user="${c.user}" data-site="${c.site}" class="cancel-btn">Cancel</button>
        </div>`).join("");

    document.querySelectorAll(".cancel-btn").forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("Cancel check-in?")) return;
        await fetch(`${API_BASE}/cancel_checkin/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: btn.dataset.user,
            site: btn.dataset.site
          })
        });
        updateActiveCheckins();
        updateCheckinHistory();
      };
    });
  } catch {
    container.innerHTML = "<p>Error loading check-ins.</p>";
  }
}

// ===== HISTORY =====
async function updateCheckinHistory() {
  const container = document.getElementById("checkinHistoryContent");
  container.innerHTML = "<p>Loading...</p>";

  try {
    const res = await fetch(`${API_BASE}/checkin_history`);
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = "<p>No history.</p>";
      return;
    }

    container.innerHTML = data.map(c => `
      <div style="margin-bottom:8px;">
        <strong>${escapeHtml(c.user)}</strong> — ${escapeHtml(c.site)}<br>
        In: ${new Date(c.checked_in_at).toLocaleString()}<br>
        Out: ${c.canceled_at || c.expired_at || "Active"}
      </div>`).join("");
  } catch {
    container.innerHTML = "<p>Error loading history.</p>";
  }
}

// ===== CONTACTS =====
async function loadContacts() {
  const select = document.getElementById("emergencyContact");
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
  if (!name || !phone) return alert("Required");

  await fetch(`${API_BASE}/add_contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, phone })
  });

  newContactForm.style.display = "none";
  loadContacts();
}

// ===== CHECK-IN =====
async function doCheckIn() {
  const user = user.value.trim();
  const site = site.value.trim();
  const time = checkinTime.value;
  if (!user || !site || !time) return alert("Missing fields");

  const [h, m] = time.split(":").map(Number);
  const now = new Date();
  const expiry = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  const minutes = Math.ceil((expiry - now) / 60000);
  if (minutes <= 0) return alert("Time must be future");

  await fetch(`${API_BASE}/checkin/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: user,
      site,
      minutes,
      emergency_contact: emergencyContact.value
    })
  });

  updateActiveCheckins();
  updateCheckinHistory();
}

// ===== CSV =====
function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
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
  setInterval(updateActiveCheckins, 30000);
});
