// ===== Escape HTML =====
function escapeHtml(str) {
    if (typeof str !== "string") return str;
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
              .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

// ===== Get user location =====
async function getUserLocation() {
    const siteInput = document.getElementById("site");
    if (!navigator.geolocation) { siteInput.placeholder="Geolocation not supported"; return; }

    navigator.geolocation.getCurrentPosition(async (position)=>{
        const {latitude, longitude} = position.coords;
        siteInput.value=`Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;

        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
            const data = await res.json();
            if (data && data.display_name) siteInput.value = data.display_name;
        } catch(e){ console.warn("Reverse geocoding failed:", e); }
    }, (err)=>{
        console.error("Location error:", err);
        siteInput.placeholder="Location permission denied";
    });
}

// ===== Active Check-Ins =====
async function updateActiveCheckins() {
    try {
        const response = await fetch("https://loneworking-production.up.railway.app/checkins");
        if (!response.ok) throw new Error(`Server ${response.status}`);
        const data = await response.json();
        const container = document.getElementById("activeCheckins");
        if (!data.length) { container.innerHTML="<h2>Active Check-Ins</h2><p>No active check-ins.</p>"; return; }

        let html="<h2>Active Check-Ins</h2><ul style='padding-left:0; list-style:none;'>";
        data.forEach(c=>{
            html+=`<li style="margin-bottom:8px; display:flex; flex-wrap:wrap; align-items:center; justify-content: space-between;">
                <div style="flex:1 1 auto; min-width:150px; margin-right:10px;">
                    <span style="display:block; font-weight:500;">${escapeHtml(c.user)}</span>
                    <span style="display:block; color:#555;">${escapeHtml(c.site)}</span>
                    <span style="display:block; color:#888; font-size:14px;">Expires: ${new Date(c.expires).toLocaleTimeString()}</span>
                    <span style="display:block; color:#c0392b; font-size:14px;">Contact: ${escapeHtml(c.emergency_contact||'N/A')}</span>
                </div>
                <button class="cancel-btn" 
                    data-user="${encodeURIComponent(c.user)}" 
                    data-site="${encodeURIComponent(c.site)}" 
                    style="flex:0 0 auto;padding:10px 14px;font-size:16px;background-color:#e74c3c;color:white;border:none;border-radius:6px;margin-top:5px;"
                >Cancel</button>
            </li>`;
        });
        html+="</ul>";
        container.innerHTML = html;

        container.querySelectorAll(".cancel-btn").forEach(btn=>{
            btn.onclick=async ()=>{
                const user=decodeURIComponent(btn.getAttribute("data-user"));
                const site=decodeURIComponent(btn.getAttribute("data-site"));
                if(!confirm(`Cancel check-in for ${user} at ${site}?`)) return;
                try {
                    const response = await fetch("https://loneworking-production.up.railway.app/cancel_checkin/", {
                        method:"POST",
                        headers:{"Content-Type":"application/json"},
                        body: JSON.stringify({user_id:user, site:site})
                    });
                    if(!response.ok) throw new Error(`Server ${response.status}`);
                    const data = await response.json();
                    const cDiv=document.getElementById("confirmation");
                    cDiv.textContent=data.message; cDiv.style.display="block"; cDiv.style.backgroundColor="#cce5ff"; cDiv.style.color="#004085";
                    updateActiveCheckins(); updateCheckinHistory();
                    setTimeout(()=>{cDiv.style.display="none";},3000);
                } catch(err){console.error(err);}
            };
        });
    } catch(e){
        console.error("Error fetching check-ins:", e);
        document.getElementById("activeCheckins").innerHTML="<p>Error loading active check-ins.</p>";
    }
}

// ===== Check-in History =====
async function updateCheckinHistory(){
    try{
        const response=await fetch("https://loneworking-production.up.railway.app/checkin_history");
        if(!response.ok) throw new Error(`Server ${response.status}`);
        const data = await response.json();
        const container = document.getElementById("checkinHistoryContent");
        if(!data||!data.length){ container.innerHTML="<p>No check-in history.</p>"; return; }

        data.sort((a,b)=>{
            const aEnd=a.canceled_at||a.expired_at||a.checked_in_at;
            const bEnd=b.canceled_at||b.expired_at||b.checked_in_at;
            return new Date(bEnd)-new Date(aEnd);
        });

        let html=`<div style="display:flex; flex-direction:column; gap:12px;">`;
        data.forEach(c=>{
            const checkInTime=new Date(c.checked_in_at).toLocaleString();
            const checkOutTime=c.canceled_at?new Date(c.canceled_at).toLocaleString():c.expired_at?new Date(c.expired_at).toLocaleString():null;
            html+=`<div style="border:1px solid #ddd;border-radius:8px;padding:10px 12px;background:#fafafa;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="font-weight:bold;margin-bottom:4px;">${escapeHtml(c.user)} — <span style="color:#555;">${escapeHtml(c.site)}</span></div>`;
            if(checkOutTime){
                const isCheckout=!!c.canceled_at;
                const cssColor=isCheckout?"#e67e22":"#e74c3c";
                const action=isCheckout?"🚪 Check Out":"⚠️ Expired";
                html+=`<div style="color:${cssColor}; margin-bottom:3px;">${checkOutTime} — <strong>${action}</strong></div>`;
            }
            html+=`<div style="color:#2ecc71;">${checkInTime} — <strong>✅ Check In</strong></div>`;
            html+=`<div style="color:#c0392b;">Contact: ${escapeHtml(c.emergency_contact||'N/A')}</div>`;
            html+=`</div>`;
        });
        html+="</div>";
        container.innerHTML=html;
    }catch(e){ console.error("Error fetching history:", e); document.getElementById("checkinHistoryContent").innerHTML="<p>Error loading history.</p>"; }
}

// ===== Emergency Contacts =====
async function loadContacts(){
    const select=document.getElementById("emergencyContact");
    try{
        const response=await fetch("https://loneworking-production.up.railway.app/contacts");
        const data=await response.json();
        select.innerHTML="";
        data.forEach(c=>{
            const opt=document.createElement("option");
            opt.value=`${c.name} | ${c.phone}`;
            opt.textContent=`${c.name} (${c.phone})`;
            select.appendChild(opt);
        });
        const newOpt=document.createElement("option");
        newOpt.value="__new__"; newOpt.textContent="➕ Add New Contact...";
        select.appendChild(newOpt);
    }catch(e){ console.error("Error loading contacts:", e); select.innerHTML="<option value=''>Failed to load contacts</option>"; }
}

document.getElementById("emergencyContact").addEventListener("change", async function(){
    if(this.value==="__new__"){
        const name=prompt("Enter contact name:"); if(!name) return alert("Name is required.");
        const phone=prompt("Enter phone number:"); if(!phone) return alert("Phone number is required.");
        try{
            const response=await fetch("https://loneworking-production.up.railway.app/add_contact", {
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({name,phone})
            });
            if(!response.ok) throw new Error("Failed to add contact");
            await loadContacts();
            alert(`✅ Contact "${name}" added!`);
        }catch(e){ console.error(e); alert("Failed to add contact."); }
    }
});

// ===== Main Event Handlers =====
document.addEventListener("DOMContentLoaded", ()=>{
    document.getElementById("checkinTime").style.width="100%";

    document.getElementById("checkin").onclick=async ()=>{
        const user=document.getElementById("user").value.trim();
        const site=document.getElementById("site").value.trim();
        let checkoutTime=document.getElementById("checkinTime").value.trim();
        checkoutTime=checkoutTime.replace(/\s|\u00A0|\u200B/g,'');
        const selectedContact=document.getElementById("emergencyContact").value;

        if(!user||!site){ alert("Enter User ID and Site."); return; }
        if(!checkoutTime){ alert("Enter a valid check-out time."); return; }

        const parts=checkoutTime.split(":");
        if(parts.length!==2){ alert("Use HH:MM format."); return; }
        const hours=Number(parts[0]), minutes=Number(parts[1]);
        if(isNaN(hours)||isNaN(minutes)||hours<0||hours>23||minutes<0||minutes>59){ alert("Invalid time."); return; }

        const now=new Date();
        const expires=new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes,0,0);
        const minutesUntilCheckout=Math.ceil((expires-now)/60000);
        if(minutesUntilCheckout<=0){ alert("Check-out must be later than current time."); return; }

        try{
            const response=await fetch("https://loneworking-production.up.railway.app/checkin/", {
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({user_id:user, site:site, minutes:minutesUntilCheckout, emergency_contact:selectedContact||null})
            });
            const confirmationDiv=document.getElementById("confirmation");
            if(!response.ok){ const errText=await response.text(); confirmationDiv.textContent=`Error: ${errText}`; confirmationDiv.style.display="block"; confirmationDiv.style.backgroundColor="#f8d7da"; confirmationDiv.style.color="#721c24"; setTimeout(()=>{confirmationDiv.style.display="none";},5000); return; }
            const data=await response.json();
            confirmationDiv.textContent=data.message; confirmationDiv.style.display="block"; confirmationDiv.style.backgroundColor="#d4edda"; confirmationDiv.style.color="#155724";
            updateActiveCheckins(); updateCheckinHistory();
            setTimeout(()=>{confirmationDiv.style.display="none";},3000);
        }catch(e){ console.error(e); }
    };

    const historyHeader=document.getElementById("toggleHistory");
    const historyContent=document.getElementById("checkinHistoryContent");
    if(historyHeader&&historyContent){
        historyHeader.onclick=()=>{
            const hidden=historyContent.style.display==="none";
            historyContent.style.display=hidden?"block":"none";
            historyHeader.textContent=hidden?"▼ Check-In History":"▶ Check-In History";
        };
    }

    document.getElementById("getLocation").onclick=getUserLocation;

    loadContacts();
    updateActiveCheckins();
    updateCheckinHistory();
    setInterval(()=>{ updateActiveCheckins(); updateCheckinHistory(); }, 30000);
    getUserLocation();
});
