// ===== Get and autofill user location =====
async function getUserLocation() {
  const siteInput = document.getElementById("site");

  if (!navigator.geolocation) {
    siteInput.placeholder = "Geolocation not supported";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      console.log("📍 User location:", latitude, longitude);

      siteInput.value = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
        );
        const data = await res.json();
        if (data && data.display_name) {
          siteInput.value = data.display_name;
        }
      } catch (err) {
        console.warn("⚠️ Reverse geocoding failed:", err);
      }
    },
    (error) => {
      console.error("❌ Location error:", error);
      siteInput.placeholder = "Location permission denied";
    }
  );
}

// ===== Fetch and display active check-ins =====
async function updateActiveCheckins() {
  try {
    const response = await fetch("https://loneworking-production.up.railway.app/checkins");
    const data = await response.json();

    const container = document.getElementById("activeCheckins");
    if (data.length === 0) {
      container.innerHTML = "<h2>Active Check-Ins</h2><p>No active check-ins.</p>";
      return;
    }

    let html = "<h2>Active Check-Ins</h2><ul>";
    data.forEach(c => {
      html += `<li>${escapeHtml(c.user)} at ${escapeHtml(c.site)} <span style="color:#888;">(expires ${new Date(c.expires).toLocaleTimeString()})</span></li>`;
    });
    html += "</ul>";
    container.innerHTML = html;

  } catch (error) {
    console.error("💥 Error fetching active check-ins:", error);
  }
}

// ===== Fetch and display check-in history (writes only to content div) =====
async function updateCheckinHistory() {
  try {
    const response = await fetch("https://loneworking-production.up.railway.app/checkin_history");
    const data = await response.json();

    const container = document.getElementById("checkinHistoryContent");
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = "<p>No check-in history.</p>";
      return;
    }

    // ✅ Sort newest sessions first (most recent at top)
    data.sort((a, b) => new Date(b.checked_in_at) - new Date(a.checked_in_at));

    let html = `
      <div style="display:flex; flex-direction:column; gap:10px;">
    `;

    data.forEach(c => {
      const checkInTime = new Date(c.checked_in_at).toLocaleString();
      const checkOutTime = c.canceled_at
        ? new Date(c.canceled_at).toLocaleString()
        : c.expired_at
        ? new Date(c.expired_at).toLocaleString()
        : null;

      // Build record block with card-like styling
      html += `
        <div style="
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 10px 12px;
          background: #fafafa;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        ">
          <div style="font-weight:bold; margin-bottom:4px;">
            ${escapeHtml(c.user)} — <span style="color:#555;">${escapeHtml(c.site)}</span>
          </div>
      `;

      // 🟧 Show Check Out / Expired first
      if (checkOutTime) {
        const isCheckout = !!c.canceled_at;
        const cssColor = isCheckout ? "#e67e22" : "#e74c3c";
        const action = isCheckout ? "🚪 Check Out" : "⚠️ Expired";
        html += `
          <div style="color:${cssColor}; margin-bottom:3px;">
            ${checkOutTime} — <strong>${action}</strong>
          </div>
        `;
      }

      // 🟩 Then show Check In below
      html += `
          <div style="color:#2ecc71;">
            ${checkInTime} — <strong>✅ Check In</strong>
          </div>
        </div>
      `;
    });

    html += "</div>";
    container.innerHTML = html;

  } catch (error) {
    console.error("💥 Error fetching check-in history:", error);
    const container = document.getElementById("checkinHistoryContent");
    if (container) container.innerHTML = "<p>Error loading history.</p>";
  }
}


// ===== Escape HTML helper =====
function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ===== Main Event Handlers =====
document.addEventListener("DOMContentLoaded", () => {
  // ----- Check-In Button -----
  document.getElementById("checkin").onclick = async () => {
    const user = document.getElementById("user").value;
    const site = document.getElementById("site").value;
    const minutes = document.getElementById("minutes").value;

    console.log("🚀 Starting check-in...");
    console.log("User input:", { user, site, minutes });

    try {
      const response = await fetch("https://loneworking-production.up.railway.app/checkin/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user,
          site: site,
          minutes: parseInt(minutes)
        })
      });

      const confirmationDiv = document.getElementById("confirmation");

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Server returned ${response.status}:`, errorText);
        confirmationDiv.textContent = `Error ${response.status}: ${errorText}`;
        confirmationDiv.style.display = "block";
        confirmationDiv.style.backgroundColor = "#f8d7da";
        confirmationDiv.style.color = "#721c24";
        setTimeout(() => { confirmationDiv.style.display = "none"; }, 5000);
        return;
      }

      const data = await response.json();
      confirmationDiv.textContent = data.message;
      confirmationDiv.style.display = "block";
      confirmationDiv.style.backgroundColor = "#d4edda";
      confirmationDiv.style.color = "#155724";

      updateActiveCheckins();
      updateCheckinHistory();

      setTimeout(() => { confirmationDiv.style.display = "none"; }, 3000);
    } catch (error) {
      console.error("💥 Network or fetch error:", error);
      const confirmationDiv = document.getElementById("confirmation");
      confirmationDiv.textContent = "Network error — check console for details.";
      confirmationDiv.style.display = "block";
      confirmationDiv.style.backgroundColor = "#f8d7da";
      confirmationDiv.style.color = "#721c24";
    }
  };

  // ----- Checkout Button -----
  document.getElementById("checkout").onclick = async () => {
    const user = document.getElementById("user").value;
    const site = document.getElementById("site").value;

    console.log("🚪 Attempting to check out...");
    console.log("User input:", { user, site });

    try {
      const response = await fetch("https://loneworking-production.up.railway.app/cancel_checkin/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user, site: site })
      });

      const confirmationDiv = document.getElementById("confirmation");

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Server returned ${response.status}:`, errorText);
        confirmationDiv.textContent = `Error ${response.status}: ${errorText}`;
        confirmationDiv.style.display = "block";
        confirmationDiv.style.backgroundColor = "#f8d7da";
        confirmationDiv.style.color = "#721c24";
        setTimeout(() => { confirmationDiv.style.display = "none"; }, 5000);
        return;
      }

      const data = await response.json();
      confirmationDiv.textContent = data.message;
      confirmationDiv.style.display = "block";
      confirmationDiv.style.backgroundColor = "#cce5ff";
      confirmationDiv.style.color = "#004085";

      updateActiveCheckins();
      updateCheckinHistory();

      setTimeout(() => { confirmationDiv.style.display = "none"; }, 3000);
    } catch (error) {
      console.error("💥 Network or fetch error:", error);
      const confirmationDiv = document.getElementById("confirmation");
      confirmationDiv.textContent = "Network error — check console for details.";
      confirmationDiv.style.display = "block";
      confirmationDiv.style.backgroundColor = "#f8d7da";
      confirmationDiv.style.color = "#721c24";
    }
  };

  // ----- Collapsible History Toggle -----
  const historyHeader = document.getElementById("toggleHistory");
  const historyContent = document.getElementById("checkinHistoryContent");
  if (historyHeader && historyContent) {
    historyHeader.onclick = () => {
      const isHidden = historyContent.style.display === "none";
      historyContent.style.display = isHidden ? "block" : "none";
      historyHeader.textContent = isHidden ? "▼ Check-In History" : "▶ Check-In History";
    };
  }

  // ----- Get My Location Button -----
  document.getElementById("getLocation").onclick = getUserLocation;

  // Auto-refresh
  updateActiveCheckins();
  updateCheckinHistory();
  setInterval(() => {
    updateActiveCheckins();
    updateCheckinHistory();
  }, 30000);

  getUserLocation();
});
