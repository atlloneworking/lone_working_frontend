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
    navigator.geolocation.getCurrentPosition(async pos => {
        const {latitude, longitude} = pos.coords;
        siteInput.value = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
            const data = await res.json();
            if (data.display_name) siteInput.value = data.display_name;
        } catch(e){ console.warn(e); }
    }, err => { console.error(err); siteInput.placeholder="Location permission denied"; });
}

// ===== Active Check-Ins =====
async function updateActiveCheckins() {
    try {
        const resp = await fetch("/checkins");
        const data = await resp.json();
        const container = document.getElementById("activeCheckins");
        if(!data.length){ container.innerHTML="<h2>Active Check-Ins</h2><p>No active check-ins.</p>"; return; }
        let html="<h2>Active Check-Ins</h2><ul style='padding-left:0; list-style:none;'>";
        data.forEach(c=>{
            html+=`<li style="margin-bottom:8px; display:flex; flex-wrap:wrap; align-items:center; justify-content: space-between;">
                <div style="flex:1 1 auto; min-width:150px; margin-right:10px;">
                    <span style="display:block; font-weight:500;">${escapeHtml(c.user)}</span>
                    <span style="display:block; color:#555;">${escapeHtml(c.site)}</span>
                    <span style="display:block; color:#888; font-size:14px;">Expires: ${new Date(c.expires).toLocaleTimeString()}</span>
                    <span style="display:block; color:#c0392b; font-size:14px;">Contact: ${escapeHtml(c.emergency_contact||'N/A')}</span>
                    <span style="display:block; color:#8e44ad; font-size:14px;">Notes: ${escapeHtml(c.contact_notes||'')}</span>
                </div>
                <button class="cancel-btn" data-user="${encodeURIComponent(c.user)}" data-site="${encodeURIComponent(c.site)}"
                    style="flex:0 0 auto;padding:10px 14px;font-size:16px;background-color:#e74c3c;color:white;border:none;border-radius:6px;margin-top:5px;">
                    Cancel
                </button>
            </li>`;
        });
        html+="</ul>";
        container.innerHTML = html;
        container.querySelectorAll(".cancel-btn").forEach(btn=>{
            btn.onclick=async ()=>{
                const user=decodeURIComponent(btn.dataset.user);
                const site=decodeURIComponent(btn.dataset.site);
                if(!confirm(`Cancel check-in for ${user} at ${site}?`)) return;
                const resp = await fetch("/cancel_checkin/", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({user_id:user, site})});
                const data = await resp.json();
                const cDiv = document.getElementById("confirmation");
                cDiv.textContent = data.message;
                cDiv.style.display="block"; cDiv.style.backgroundColor="#cce5ff"; cDiv.style.color="#004085";
                updateActiveCheckins(); updateCheckinHistory();
                setTimeout(()=>cDiv.style.display="none", 3000);
            };
        });
    } catch(e){ console.error(e); document.getElementById("activeCheckins").innerHTML="<p>Error loading active check-ins.</p>"; }
}

// ===== Check-in History =====
async function updateCheckinHistory(){
    try{
        const resp = await fetch("/checkin_history");
        const data = await resp.json();
        const container = document.getElementById("checkinHistoryContent");
        if(!data.length){ container.innerHTML="<p>No check-in history.</p>"; return; }
        let html=`<div style="display:flex; flex-direction:column; gap:12px;">`;
        data.forEach(c=>{
            const checkInTime = new Date(c.checked_in_at).toLocaleString();
            const checkOutTime = c.canceled_at?new Date(c.canceled_at).toLocaleString():c.expired_at?new Date(c.expired_at).toLocaleString():null;
            html+=`<div style="border:1px solid #ddd;border-radius:8px;padding:10px 12px;background:#fafafa;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="font-weight:bold;margin-bottom:4px;">${escapeHtml(c.user)} — <span style="color:#555;">${escapeHtml(c.site)}</span></div>`;
            if(checkOutTime){
                const cssColor=c.canceled_at?"#e67e22":"#e74c3c";
                const action=c.canceled_at?"🚪 Check Out":"⚠️ Expired";
                html+=`<div style="color:${cssColor}; margin-bottom:3px;">${checkOutTime} — <strong>${action}</strong></div>`;
            }
            html+=`<div style="color:#2ecc71;">${checkInTime} — <strong>✅ Check In</strong></div>`;
            html+=`<div style="color:#c0392b;">Contact: ${escapeHtml(c.emergency_contact||'N/A')}</div>`;
            html+=`<div style="color:#8e44ad;">Notes: ${escapeHtml(c.contact_notes||'')}</div>`;
            html+=`</div>`;
        });
        html+="</div>";
        container.innerHTML = html;
    }catch(e){ console.error(e); container.innerHTML="<p>Error loading history.</p>"; }
}

// ===== Load Contacts =====
async function loadContacts(selectedContact=null){
    const select = document.getElementById("emergencyContact");
    try{
        const resp = await fetch("/contacts");
        const data = await resp.json();
        select.innerHTML = "";
        data.forEach(c=>{
            const opt = document.createElement("option");
            opt.value = `${c.name} | ${c.phone} | ${c.notes||""}`;
            opt.textContent = `${c.name} (${c.phone})`;
            select.appendChild(opt);
        });
        const placeholder = document.createElement("option");
        placeholder.value=""; placeholder.textContent="-- Select Contact --";
        select.insertBefore(placeholder, select.firstChild);
        select.value = selectedContact || "";
    }catch(e){ console.error(e); select.innerHTML="<option>Failed to load contacts</option>"; }
}

// ===== Add Contact UI =====
function setupAddContactUI(){
    const container=document.getElementById("addContactContainer");
    document.getElementById("showAddContact").onclick = ()=>{ container.style.display="block"; };
    document.getElementById("saveContact").onclick = async ()=>{
        const name=document.getElementById("newContactName").value.trim();
        const phone=document.getElementById("newContactPhone").value.trim();
        const notes=document.getElementById("newContactNotes").value.trim();
        if(!name || !phone) return alert("Name and phone required");
        try{
            const resp = await fetch("/add_contact", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({name, phone, notes}) });
            if(!resp.ok) throw new Error("Failed to add contact");
            await loadContacts();
            alert(`✅ Contact "${name}" added!`);
            document.getElementById("newContactName").value="";
            document.getElementById("newContactPhone").value="";
            document.getElementById("newContactNotes").value="";
            container.style.display="none";
        }catch(e){ console.error(e); alert("Failed to add contact."); }
    };
}

// ===== Main =====
document.addEventListener("DOMContentLoaded", ()=>{
    document.getElementById("checkinTime").style.width="100%";
    document.getElementById("checkin").onclick=async ()=>{
        const user=document.getElementById("user").value.trim();
        const site=document.getElementById("site").value.trim();
        const checkoutTime=document.getElementById("checkinTime").value.trim();
        const contactValue=document.getElementById("emergencyContact").value;
        let emergency_contact=null, contact_notes=null;
        if(contactValue){
            const parts=contactValue.split("|").map(s=>s.trim());
            emergency_contact=`${parts[0]} | ${parts[1]}`;
            contact_notes=parts[2]||"";
        }
        if(!user||!site||!checkoutTime) return alert("Fill all required fields");
        const parts2=checkoutTime.split(":");
        const hours=Number(parts2[0]), minutes=Number(parts2[1]);
        const now=new Date();
        const expires=new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
        const minutesUntilCheckout=Math.ceil((expires-now)/60000);
        if(minutesUntilCheckout<=0) return alert("Check-out must be in the future");
        try{
            const resp=await fetch("/checkin/", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({user_id:user, site, minutes:minutesUntilCheckout, emergency_contact, contact_notes})});
            const data=await resp.json();
            const cDiv=document.getElementById("confirmation");
            cDiv.textContent=data.message; cDiv.style.display="block"; cDiv.style.backgroundColor="#d4edda"; cDiv.style.color="#155724";
            updateActiveCheckins(); updateCheckinHistory();
            setTimeout(()=>cDiv.style.display="none", 3000);
        }catch(e){ console.error(e); }
    };
    document.getElementById("getLocation").onclick=getUserLocation;
    loadContacts();
    setupAddContactUI();
    updateActiveCheckins(); updateCheckinHistory();
    setInterval(()=>{ updateActiveCheckins(); updateCheckinHistory(); },30000);
});
