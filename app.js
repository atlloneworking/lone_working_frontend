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

    console.log("📡 Request sent, awaiting response...");

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Server returned ${response.status}:`, errorText);

      const confirmationDiv = document.getElementById("confirmation");
      confirmationDiv.textContent = `Error ${response.status}: ${errorText}`;
      confirmationDiv.style.display = "block";
      confirmationDiv.style.color = "red";

      setTimeout(() => {
        confirmationDiv.style.display = "none";
      }, 5000);
      return;
    }

    const data = await response.json();
    console.log("✅ Response data:", data);

    const confirmationDiv = document.getElementById("confirmation");
    confirmationDiv.textContent = data.message;
    confirmationDiv.style.display = "block";
    confirmationDiv.style.color = "green";

    setTimeout(() => {
      confirmationDiv.style.display = "none";
    }, 3000);

  } catch (error) {
    console.error("💥 Network or fetch error:", error);
    const confirmationDiv = document.getElementById("confirmation");
    confirmationDiv.textContent = "Network error — check console for details.";
    confirmationDiv.style.display = "block";
    confirmationDiv.style.color = "red";
  }
};
