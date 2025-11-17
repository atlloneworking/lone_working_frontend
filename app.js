// ===== PIN LOCK FEATURE =====
// (unchanged)
const CORRECT_PIN = "1234";

const pinScreen = document.getElementById("pinLockScreen");
const pinInput = document.getElementById("pinInput");
const pinSubmit = document.getElementById("pinSubmit");
const pinError = document.getElementById("pinError");
const mainContent = document.getElementById("mainContent");

if (pinScreen && pinInput && pinSubmit) {
  mainContent.style.filter = "blur(3px)";
  mainContent.style.pointerEvents = "none";

  pinSubmit.addEventListener("click", () => {
    if (pinInput.value.trim() === CORRECT_PIN) {
      pinScreen.style.display = "none";
      mainContent.style.filter = "none";
      mainContent.style.pointerEvents = "auto";
    } else {
      pinError.style.display = "block";
      pinInput.value = "";
    }
  });
}

// ===== NEW: CSV EXPORT FUNCTION =====
function exportHistoryCsv(history) {
  const rows = [
    ["User", "Site", "Checked In At", "Ended At", "Type", "Emergency Contact"]
  ];

  history.forEach(h => {
    rows.push([
      h.user,
      h.site,
      h.checked_in_at,
      h.canceled_at || h.expired_at || "",
      h.canceled_at ? "Check-Out" : "Expired",
      h.emergency_contact || ""
    ]);
  });

  let csvContent = rows.map(r => r.join(",")).join("\n");
  let blob = new Blob([csvContent], { type: "text/csv" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.download = `checkin-history-${timestamp}.csv`;
  a.click();
}

// ===== Escape HTML =====
function escapeHtml(str){
  if (typeof str !== "string") return str;
  return str.replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;")
            .replace(/'/g,"&#039;");
}

// (your existing app.js continues unchanged…)

// ===== Add Download Button Handler =====
document.getElementById("downloadHistoryBtn").onclick = async () => {
  const res = await fetch("https://loneworking-production.up.railway.app/checkin_history");
  const data = await res.json();
  exportHistoryCsv(data);
};
