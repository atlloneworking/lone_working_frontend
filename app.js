// ---------------- PIN LOGIN ----------------
const CORRECT_PIN = "1234"; // Change this to your new PIN

function checkPin() {
    const entered = document.getElementById("pinInput").value;
    const error = document.getElementById("pinError");

    if (entered === CORRECT_PIN) {
        document.getElementById("pinScreen").classList.add("hidden");
        document.getElementById("content").classList.remove("hidden");
    } else {
        error.textContent = "Incorrect PIN";
    }
}

// ---------------- DOWNLOAD HISTORY ----------------
async function downloadHistory() {
    try {
        const response = await fetch("https://your-api-url/checkin_history");
        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            alert("No history available.");
            return;
        }

        // Convert to CSV
        let csv = "User,Site,Checked In At,Expired At,Canceled At,Notes\n";

        data.forEach(item => {
            csv += [
                item.user || "",
                item.site || "",
                item.checked_in_at || "",
                item.expired_at || "",
                item.canceled_at || "",
                (item.contact_notes || "").replace(/,/g, ";")
            ].join(",") + "\n";
        });

        // Create file + force download
        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "checkin_history.csv";
        a.click();

        window.URL.revokeObjectURL(url);

    } catch (err) {
        console.error("Download error:", err);
        alert("Failed to download history.");
    }
}
