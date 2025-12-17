// ========================= 
// Full app.js — FULL FEATURE
// - PIN lock (top of file)
// - Check-in logic (POST /checkin/)
// - Active checkins listing + cancel (GET /checkins, POST /cancel_checkin/)
// - Check-in history (GET /checkin_history)
// - Contacts load & add (GET /contacts, POST /add_contact)
// - Get user location (reverse geocode via Nominatim)
// - CSV export (downloadHistoryBtn)
// - Auto-refresh every 30s
// Replace your existing app.js with this file.
// =========================

// ===== CONFIG =====
const API_BASE = "https://loneworking-production.up.railway.app";
const CORRECT_PIN = "1234"; // <<-- change PIN here if desired

// ===== MAP GLOBALS =====
let map = null;
let mapMarker = null;

// ===== PIN LOCK FEATURE (runs immediately) =====
(function initPinLock() {
  // Elements are present because script is included at end of body in your HTML
  const pinScreen = document.getElementById("pinLockScreen");
  const pinInput = document.getElementById("pinInput");
  const pinSubmit = document.getElementById("pinSubmit");
  const pinError = document.getElementById("pinError");
  const mainContent = document.getElementById("mainContent");

  if (!pinScreen || !pinInput || !pinSubmit || !mainContent) {
    // If any element missing, do nothing (avoid throwing).
    return;
  }

  // Ensure main is disabled initially
  mainContent.style.filter = "blur(3px)";
  mainContent.style.pointerEvents = "none";

  const unlock = () => {
    const entered = (pinInput.value || "").trim();
    if (entered === CORRECT_PIN) {
      pinScreen.style.display = "none";
      mainContent.style.filter = "none";
      mainContent.style.pointerEvents = "auto";
    } else {
      if (pinError) {
        pinError.style.display = "block";
      }
      pinInput.value = "";
      pinInput.focus();
    }
  };

  pinSubmit.addEventListener("click", unlock);
  pinInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") unlock();
  });
})();

// ===== Utility: escape HTML =====
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
  // Check if Leaflet is loaded
  if (typeof L === "undefined") {
    console.warn("Leaflet.js not loaded");
    return;
  }

  // Check if map container exists
  const mapDiv = document.getElementById("map");
  if (!mapDiv) {
    console.warn("Map container (#map) not found");
    return;
  }

  // Ensure the map div is visible
  mapDiv.style.display = "block";

  // Initialize map if it doesn't exist
  if (!map) {
    map = L.map("map").setView([lat, lon], 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap"
    }).addTo(map);
  } else {
    map.setView([lat, lon], 16);
  }

  // Add or update marker
  if (mapMarker) {
    mapMarker.setLatLng([lat, lon]);
  } else {
    mapMarker = L.marker([lat, lon]).addTo(map);
  }
}


// ===== Get and autofill user location =====
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
      initMap(latitude, longitude); // ← ADD THIS LINE
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

// ===== Fetch and display active check-ins =====
async function updateActiveCheckins() {
  const container = document.getElementById("activeCheckins");
  if (!container) return;
  container.innerHTML = "<h2>Active Check-Ins</h2><p>Loading...</p>";
  try {
    const response = await fetch(`${API_BASE}/checkins`);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = "<h2>Active Check-Ins</h2><p>No active check-ins.</p>";
      return;
    }

    let html = "<h2>Active Check-Ins</h2><ul style='padding-left:0; list-style:none;'>";
    data.forEach(c => {
      html += `
        <li style="margin-bottom:8px; display:flex; flex-wrap:wrap; align-items:center; justify-content: space-between;">
          <div style="flex:1 1 auto; min-width:150px; margin-right:10px;">
            <span style="display:block; font-weight:500;">${escapeHtml(c.user)}</span>
            <span style="display:block; color:#555;">${escapeHtml(c.site)}</span>
            <span style="display:block; color:#888; font-size:14px;">Expires: ${new Date(c.expires).toLocaleTimeString()}</span>
            <span style="display:block; color:#c0392b; font-size:14px;">Contact: ${escapeHtml(c.emergency_contact || 'N/A')}</span>
          </div>
          <button class="cancel-btn" 
              data-user="${encodeURIComponent(c.user)}" 
              data-site="${encodeURIComponent(c.site)}" 
              style="
                flex: 0 0 auto;
                padding:10px 14px;
                font-size:16px; 
                background-color:#e74c3c; 
                color:white; 
                border:none; 
                border-radius:6px;
                cursor:pointer;
                margin-top:5px;
              "
          >Cancel</button>
        </li>`;
    });
    html += "</ul>";
    container.innerHTML = html;

    // attach cancel handlers
    container.querySelectorAll(".cancel-btn").forEach(btn => {
      btn.onclick = async () => {
        const user = decodeURIComponent(btn.getAttribute("data-user"));
        const site = decodeURIComponent(btn.getAttribute("data-site"));
        if (!confirm(`Cancel check-in for ${user} at ${site}?`)) return;
        try {
          const response = await fetch(`${API_BASE}/cancel_checkin/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: user, site: site })
          });
          if (!response.ok) throw new Error(`Server returned ${response.status}`);
          const resJson = await response.json();
          const cDiv = document.getElementById("confirmation");
          if (cDiv) {
            cDiv.textContent = resJson.message || "Canceled.";
            cDiv.style.display = "block";
            cDiv.style.backgroundColor = "#cce5ff";
            cDiv.style.color = "#004085";
            setTimeout(() => { cDiv.style.display = "none"; }, 3000);
          }
          await updateActiveCheckins();
          await updateCheckinHistory();
        } catch (err) {
          console.error("Error cancelling check-in:", err);
          alert("Failed to cancel check-in.");
        }
      };
    });
  } catch (error) {
    console.error("Error fetching active check-ins:", error);
    container.innerHTML = "<h2>Active Check-Ins</h2><p>Error loading active check-ins.</p>";
  }
}

// ===== Fetch and display check-in history =====
async function updateCheckinHistory() {
  const container = document.getElementById("checkinHistoryContent");
  if (!container) return;
  container.innerHTML = "<p>Loading...</p>";
  try {
    const response = await fetch(`${API_BASE}/checkin_history`);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = "<p>No check-in history.</p>";
      return;
    }

    data.sort((a, b) => {
      const aEnd = a.canceled_at || a.expired_at || a.checked_in_at;
      const bEnd = b.canceled_at || b.expired_at || b.checked_in_at;
      return new Date(bEnd) - new Date(aEnd);
    });

    let html = `<div style="display:flex; flex-direction:column; gap:12px;">`;
    data.forEach(c => {
      const checkInTime = new Date(c.checked_in_at).toLocaleString();
      const checkOutTime = c.canceled_at ? new Date(c.canceled_at).toLocaleString() :
                           c.expired_at ? new Date(c.expired_at).toLocaleString() : null;

      html += `
        <div style="border:1px solid #ddd;border-radius:8px;padding:10px 12px;background:#fafafa;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div style="font-weight:bold;margin-bottom:4px;">${escapeHtml(c.user)} — <span style="color:#555;">${escapeHtml(c.site)}</span></div>`;

      if (checkOutTime) {
        const isCheckout = !!c.canceled_at;
        const cssColor = isCheckout ? "#e67e22" : "#e74c3c";
        const action = isCheckout ? "🚪 Check Out" : "⚠️ Expired";
        html += `<div style="color:${cssColor}; margin-bottom:3px;">${checkOutTime} — <strong>${action}</strong></div>`;
      }

      html += `<div style="color:#2ecc71;">${checkInTime} — <strong>✅ Check In</strong></div>`;
      html += `<div style="color:#c0392b; margin-top:6px;">Contact: ${escapeHtml(c.emergency_contact || 'N/A')}</div>`;
      html += `</div>`;
    });
    html += "</div>";
    container.innerHTML = html;
  } catch (error) {
    console.error("Error fetching check-in history:", error);
    container.innerHTML = "<p>Error loading history.</p>";
  }
}

// ===== Load Contacts =====
async function loadContacts(selectedName = null, selectedPhone = null) {
  const select = document.getElementById("emergencyContact");
  if (!select) return;
  select.innerHTML = "<option>Loading...</option>";
  try {
    const response = await fetch(`${API_BASE}/contacts`);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const data = await response.json();
    select.innerHTML = "";
    if (!Array.isArray(data) || data.length === 0) {
      select.innerHTML = "<option value=''>No contacts</option>";
      return;
    }
    data.forEach(c => {
      const opt = document.createElement("option");
      opt.value = `${c.name} | ${c.phone}`;
      opt.textContent = `${c.name} (${c.phone})`;
      select.appendChild(opt);
    });
    if (selectedName && selectedPhone) {
      select.value = `${selectedName} | ${selectedPhone}`;
    }
  } catch (err) {
    console.error("Error loading contacts:", err);
    select.innerHTML = "<option value=''>Failed to load contacts</option>";
  }
}

// ===== Add Contact =====
async function saveNewContact() {
  const nameEl = document.getElementById("newContactName");
  const phoneEl = document.getElementById("newContactPhone");
  if (!nameEl || !phoneEl) return;
  const name = nameEl.value.trim();
  const phone = phoneEl.value.trim();
  if (!name || !phone) {
    alert("Name and Phone are required.");
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/add_contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, notes: "" })
    });
    if (!res.ok) throw new Error("Failed to add contact");
    await loadContacts(name, phone);
    document.getElementById("newContactForm").style.display = "none";
    alert(`✅ Contact "${name}" added!`);
  } catch (err) {
    console.error("Error adding contact:", err);
    alert("Failed to add contact.");
  }
}

// ===== Check-In Handler (button) =====
async function doCheckIn() {
  const userEl = document.getElementById("user");
  const siteEl = document.getElementById("site");
  const checkinTimeEl = document.getElementById("checkinTime");
  const contactSelect = document.getElementById("emergencyContact");

  if (!userEl || !siteEl || !checkinTimeEl) return;

  const user = userEl.value.trim();
  const site = siteEl.value.trim();
  let checkoutTime = (checkinTimeEl.value || "").trim();
  checkoutTime = checkoutTime.replace(/\s|\u00A0|\u200B/g, "");

  if (!user || !site) {
    alert("Enter User ID and Site.");
    return;
  }
  if (!checkoutTime) {
    alert("Enter a valid check-out time.");
    return;
  }

  const parts = checkoutTime.split(":");
  if (parts.length !== 2) {
    alert("Use HH:MM format.");
    return;
  }
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    alert("Invalid time.");
    return;
  }

  const now = new Date();
  const expires = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  const minutesUntilCheckout = Math.ceil((expires - now) / 60000);
  if (minutesUntilCheckout <= 0) {
    alert("Check-out must be later than current time.");
    return;
  }

  const selectedContact = contactSelect ? contactSelect.value || null : null;

  try {
    const response = await fetch(`${API_BASE}/checkin/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user,
        site: site,
        minutes: minutesUntilCheckout,
        emergency_contact: selectedContact || null
      })
    });
    const confirmationDiv = document.getElementById("confirmation");
    if (!response.ok) {
      const errText = await response.text();
      if (confirmationDiv) {
        confirmationDiv.textContent = `Error: ${errText}`;
        confirmationDiv.style.display = "block";
        confirmationDiv.style.backgroundColor = "#f8d7da";
        confirmationDiv.style.color = "#721c24";
        setTimeout(() => { confirmationDiv.style.display = "none"; }, 5000);
      }
      return;
    }
    const data = await response.json();
    if (confirmationDiv) {
      confirmationDiv.textContent = data.message || "Checked in";
      confirmationDiv.style.display = "block";
      confirmationDiv.style.backgroundColor = "#d4edda";
      confirmationDiv.style.color = "#155724";
      setTimeout(() => { confirmationDiv.style.display = "none"; }, 3000);
    }
    await updateActiveCheckins();
    await updateCheckinHistory();
  } catch (err) {
    console.error("Error during check-in:", err);
    alert("Check-in failed.");
  }
}

// ===== CSV Export Helper & Handler =====
function downloadCSV(filename, rows) {
  // rows: array of arrays
  const escapeCell = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = rows.map(r => r.map(escapeCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function handleDownloadHistory() {
  try {
    const res = await fetch(`${API_BASE}/checkin_history`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      alert("No check-in history available.");
      return;
    }
    const rows = [
      ["User", "Site", "Checked In At", "Expired At", "Canceled At", "Emergency Contact", "Notes"]
    ];
    data.forEach(entry => {
      rows.push([
        entry.user || "",
        entry.site || "",
        entry.checked_in_at || "",
        entry.expired_at || "",
        entry.canceled_at || "",
        entry.emergency_contact || "",
        entry.contact_notes || ""
      ]);
    });
    const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-");
    downloadCSV(`checkin-history-${ts}.csv`, rows);
  } catch (err) {
    console.error("Error downloading history:", err);
    alert("Failed to download history.");
  }
}

// ===== DOM Ready: wire up handlers and initial loads =====
document.addEventListener("DOMContentLoaded", () => {
  // Ensure inputs style exists
  const checkinTimeEl = document.getElementById("checkinTime");
  if (checkinTimeEl) {
    checkinTimeEl.style.width = "100%";
    checkinTimeEl.style.boxSizing = "border-box";
    checkinTimeEl.style.padding = "10px";
    checkinTimeEl.style.fontSize = "16px";
    checkinTimeEl.style.border = "1px solid #ccc";
    checkinTimeEl.style.borderRadius = "6px";
    checkinTimeEl.style.marginBottom = "10px";
  }

  // Buttons / handlers
  const checkinBtn = document.getElementById("checkin");
  if (checkinBtn) checkinBtn.addEventListener("click", doCheckIn);

  const getLocationBtn = document.getElementById("getLocation");
  if (getLocationBtn) getLocationBtn.addEventListener("click", getUserLocation);

  const addContactBtn = document.getElementById("addContactBtn");
  if (addContactBtn) addContactBtn.addEventListener("click", () => {
    const form = document.getElementById("newContactForm");
    if (form) form.style.display = "block";
  });

  const cancelNewContactBtn = document.getElementById("cancelNewContact");
  if (cancelNewContactBtn) cancelNewContactBtn.addEventListener("click", () => {
    const form = document.getElementById("newContactForm");
    if (form) form.style.display = "none";
  });

  const saveNewContactBtn = document.getElementById("saveNewContact");
  if (saveNewContactBtn) saveNewContactBtn.addEventListener("click", saveNewContact);

  const toggleHeader = document.getElementById("toggleHistory");
  const historyContent = document.getElementById("checkinHistoryContent");
  if (toggleHeader && historyContent) {
    toggleHeader.addEventListener("click", () => {
      const isHidden = historyContent.style.display === "none";
      historyContent.style.display = isHidden ? "block" : "none";
      toggleHeader.textContent = isHidden ? "▼ Check-In History" : "▶ Check-In History";
    });
  }

  const downloadBtn = document.getElementById("downloadHistoryBtn");
  if (downloadBtn) downloadBtn.addEventListener("click", handleDownloadHistory);

  // Initial loads
  loadContacts();
  updateActiveCheckins();
  updateCheckinHistory();
  // Periodic refresh
  setInterval(() => {
    updateActiveCheckins();
    updateCheckinHistory();
  }, 30000);

  // try to auto-fill location once
  getUserLocation();
});
