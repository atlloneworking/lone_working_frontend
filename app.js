// ----- Function to fetch and display active check-ins -----
async function updateActiveCheckins() {
  try {
    const response = await fetch("https://loneworking-production.up.railway.app/checkins");
    const data = await response.json();

    const container = document.getElementById("activeCheckins");
    if (data.length === 0) {
      container.innerHTML = "<p>No active check-ins.</p>";
      return;
    }

    let html = "<h3>Active Check-Ins:</h3><ul>";
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
      container.innerHTML = "<p>No check-in history.</p>";
      return;
    }

    let html = "<h3>Check-In History:</h3><ul>";
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
      confirmationDiv.style.color = "red";
      setTimeout(() => { confirmationDiv.style.display = "none"; }, 5000);
      return;
    }

    const data = await response.json();
    console.log("✅ Response data:", data);

    const confirmationDiv = document.getElementById("confirmation");
    confirmationDiv.textContent = data.message;
    confirmationDiv.style.display = "block";
    confirmationDiv.style.color = "green";

    updateActiveCheckins();   // Update active check-ins
    updateCheckinHistory();   // Update history

    setTimeout(() => { confirmationDiv.style.display = "none"; }, 3000);

  } catch (error) {
    console.error("💥 Network or fetch error:", error);
    const confirmationDiv = document.getElementById("confirmation");
    confirmationDiv.textContent = "Network error — check console for details.";
    confirmationDiv.style.display = "block";
    confirmationDiv.style.color = "red";
  }
};

// ----- Cancel Check-In Button -----
document.getElementById("cancel").onclick = async () => {
  const user = document.getElementById("user").value;
  const site = document.getElementById("site").value;

  console.log("🚀 Attempting to cancel check-in...");
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
      confirmationDiv.style.color = "red";
      setTimeout(() => { confirmationDiv.style.display = "none"; }, 5000);
      return;
    }

    const data = await response.json();
    console.log("✅ Cancel response data:", data);

    const confirmationDiv = document.getElementById("confirmation");
    confirmationDiv.textContent = data.message;
    confirmationDiv.style.display = "block";
    confirmationDiv.style.color = "blue";

    updateActiveCheckins();   // Update active check-ins
    updateCheckinHistory();   // Update history

    setTimeout(() => { confirmationDiv.style.display = "none"; }, 3000);

  } catch (error) {
    console.error("💥 Network or fetch error:", error);
    const confirmationDiv = document.getElementById("confirmation");
    confirmationDiv.textContent = "Network error — check console for details.";
    confirmationDiv.style.display = "block";
    confirmationDiv.style.color = "red";
  }
};

// ----- Auto-refresh every 30 seconds -----
updateActiveCheckins();   // initial load
updateCheckinHistory();   // initial load
setInterval(() => {
  updateActiveCheckins();
  updateCheckinHistory();
}, 30000);
