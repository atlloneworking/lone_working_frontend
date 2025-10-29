// ----- Get and autofill user location -----
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

      // Default: fill coordinates
      siteInput.value = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;

      // Try reverse geocoding for human-readable location
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

// ----- Function to fetch and display active check-ins -----
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
      html += `<li>${c.user} at ${c.site} (expires at ${new Date(c.expires).toLocaleTimeString()})</li>`;
    });
    html += "</ul>";
    container.innerHTML = html;

  } catch (error) {
    console.error("💥 Error fetching active check-ins:", error);
  }
}

// ----- Function to fetch and display check-in history -----
async function updateCheckinHistory() {
  try {
    const response = await fetch("https://loneworking-production.up.railway.app/checkin_history");
    const data = await response.json();

    const container = document.getElementById("checkinHistory");
    if (data.length === 0) {
      container.innerHTML = "<h2>Check-In History</h2><p>No check-in history.</p>";
      return;
    }

    let html = "<h2>Check-In History</h2><ul>";
    data.forEach(c => {
      const status = c.canceled_at ? "Canceled" : c.expired_at ? "Expired" : "Completed";
      const timestamp = new Date(c.checked_in_at).toLocaleString();
      html += `<li>${c.user} at ${c.site} - ${status} (Checked in: ${timestamp})</li>`;
    });
    html += "</ul>";
    container.innerHTML = html;

  } catch (error) {
    console.error("💥 Error fetching check-in history:", error);
  }
}

// Wait for DOM to load before binding buttons
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Server returned ${response.status}:`, errorText);

        const confirmationDiv = document.getElementById("confirmation");
        confirmationDiv.textContent = `Error ${response.status}: ${errorText}`;
        confirmationDiv.style.display = "block";
        confirmationDiv.style.backgroundColor = "#f8d7da";
        confirmationDiv.style.color = "#721c24";
        setTimeout(() => { confirmationDiv.style.display = "none"; }, 5000);
        return;
      }

      const data = await response.json();
      console.log("✅ Response data:", data);

      const confirmationDiv = document.getElementById("confirmation");
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

    console.log("🚀 Attempting to check out...");
    console.log("User input:", { user, site });

    try {
      const response = await fetch("https://loneworking-production.up.railway.app/cancel_checkin/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user, site: site })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Server returned ${response.status}:`, errorText);

        const confirmationDiv = document.getElementById("confirmation");
        confirmationDiv.textContent = `Error ${response.status}: ${errorText}`;
        confirmationDiv.style.display = "block";
        confirmationDiv.style.backgroundColor = "#f8d7da";
        confirmationDiv.style.color = "#721c24";
        setTimeout(() => { confirmationDiv.style.display = "none"; }, 5000);
        return;
      }

      const data = await response.json();
      console.log("✅ Checkout response data:", data);

      const confirmationDiv = document.getElementById("confirmation");
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

  // ----- Get My Location Button -----
  document.getElementById("getLocation").onclick = getUserLocation;

  // ----- Auto-refresh every 30 seconds -----
  updateActiveCheckins();
  updateCheckinHistory();
  setInterval(() => {
    updateActiveCheckins();
    updateCheckinHistory();
  }, 30000);

  // ----- Get location automatically on page load -----
  getUserLocation();
});
