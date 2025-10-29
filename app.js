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

        let html = "<h2>Active Check-Ins</h2><ul style='padding-left:0; list-style:none;'>";
        data.forEach(c => {
            html += `
                <li style="margin-bottom:8px; display:flex; align-items:center; justify-content: space-between; flex-wrap:wrap;">
                    <span style="flex:1; min-width: 120px;">
                        ${escapeHtml(c.user)} at ${escapeHtml(c.site)} 
                        <span style="color:#888;">(expires ${new Date(c.expires).toLocaleTimeString()})</span>
                    </span>
                    <button class="cancel-btn" 
                        data-user="${encodeURIComponent(c.user)}" 
                        data-site="${encodeURIComponent(c.site)}" 
                        style="
                            margin-left:10px;
                            padding:8px 12px; 
                            font-size:16px; 
                            background-color:#e74c3c; 
                            color:white; 
                            border:none; 
                            border-radius:6px;
                            cursor:pointer;
                        "
                    >Cancel</button>
                </li>`;
        });
        html += "</ul>";
        container.innerHTML = html;

        // Add click handlers to cancel buttons
        const buttons = container.querySelectorAll(".cancel-btn");
        buttons.forEach(btn => {
            btn.onclick = async () => {
                const user = decodeURIComponent(btn.getAttribute("data-user"));
                const site = decodeURIComponent(btn.getAttribute("data-site"));

                if (!confirm(`Are you sure you want to cancel check-in for ${user} at ${site}?`)) return;

                try {
                    const response = await fetch("https://loneworking-production.up.railway.app/cancel_checkin/", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ user_id: user, site: site })
                    });

                    const confirmationDiv = document.getElementById("confirmation");
                    const data = await response.json();

                    confirmationDiv.textContent = data.message;
                    confirmationDiv.style.display = "block";
                    confirmationDiv.style.backgroundColor = "#cce5ff";
                    confirmationDiv.style.color = "#004085";

                    updateActiveCheckins();
                    updateCheckinHistory();
                    setTimeout(() => { confirmationDiv.style.display = "none"; }, 3000);
                } catch (error) {
                    console.error(error);
                }
            };
        });

    } catch (error) {
        console.error("💥 Error fetching active check-ins:", error);
    }
}

// ===== Fetch and display check-in history =====
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

            if (checkOutTime) {
                const isCheckout = !!c.canceled_at;
                const cssColor = isCheckout ? "#e67e22" : "#e74c3c";
                const action = isCheckout ? "🚪 Check Out" : "⚠️ Expired";
                html += `<div style="color:${cssColor}; margin-bottom:3px;">${checkOutTime} — <strong>${action}</strong></div>`;
            }

            html += `<div style="color:#2ecc71;">${checkInTime} — <strong>✅ Check In</strong></div>`;
            html += `</div>`;
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
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}

// ===== Main Event Handlers =====
document.addEventListener("DOMContentLoaded", () => {
    // Make checkinTime input full width like other inputs
    const checkoutInput = document.getElementById("checkinTime");
    if (checkoutInput) {
        checkoutInput.style.width = "100%";
        checkoutInput.style.boxSizing = "border-box";
        checkoutInput.style.padding = "10px";
        checkoutInput.style.fontSize = "16px";
        checkoutInput.style.border = "1px solid #ccc";
        checkoutInput.style.borderRadius = "6px";
    }

    // Check-In Button
    document.getElementById("checkin").onclick = async () => {
        const user = document.getElementById("user").value.trim();
        const site = document.getElementById("site").value.trim();
        const checkoutTimeInput = document.getElementById("checkinTime");
        const checkoutTime = checkoutTimeInput.value;

        if (!user || !site) {
            alert("Please enter both User ID and Site.");
            return;
        }

        if (!checkoutTime) {
            alert("Please enter a valid check-out time.");
            return;
        }

        const [hours, minutes] = checkoutTime.split(":").map(Number);

        const now = new Date();
        const expires = new Date(
            now.getFullYear(), now.getMonth(), now.getDate(),
            hours, minutes, 0, 0
        );

        const minutesUntilCheckout = Math.ceil((expires - now) / 60000);

        if (minutesUntilCheckout <= 0) {
            alert("Check-out time must be later than the current time.");
            return;
        }

        try {
            const response = await fetch("https://loneworking-production.up.railway.app/checkin/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: user, site: site, minutes: minutesUntilCheckout })
            });

            const confirmationDiv = document.getElementById("confirmation");
            if (!response.ok) {
                const errorText = await response.text();
                confirmationDiv.textContent = `Error: ${errorText}`;
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
            console.error(error);
        }
    };

    // Check-Out Button (general)
    document.getElementById("checkout").onclick = async () => {
        const user = document.getElementById("user").value.trim();
        const site = document.getElementById("site").value.trim();

        try {
            const response = await fetch("https://loneworking-production.up.railway.app/cancel_checkin/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: user, site: site })
            });

            const confirmationDiv = document.getElementById("confirmation");
            const data = await response.json();

            confirmationDiv.textContent = data.message;
            confirmationDiv.style.display = "block";
            confirmationDiv.style.backgroundColor = "#cce5ff";
            confirmationDiv.style.color = "#004085";

            updateActiveCheckins();
            updateCheckinHistory();
            setTimeout(() => { confirmationDiv.style.display = "none"; }, 3000);
        } catch (error) {
            console.error(error);
        }
    };

    // Collapsible History Toggle
    const historyHeader = document.getElementById("toggleHistory");
    const historyContent = document.getElementById("checkinHistoryContent");
    if (historyHeader && historyContent) {
        historyHeader.onclick = () => {
            const isHidden = historyContent.style.display === "none";
            historyContent.style.display = isHidden ? "block" : "none";
            historyHeader.textContent = isHidden ? "▼ Check-In History" : "▶ Check-In History";
        };
    }

    // Location button
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
