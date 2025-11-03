// Helpers
const $ = sel => document.querySelector(sel);
const uid = () => crypto.randomUUID();
const debounce = (fn, ms=160) => { let t; const w=(...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; w.flush=()=>fn(); return w; };

// State
let state = { notes: [], selectedId: null, ui: { theme: 'auto' } };

/* Fonts */
const FONT_KEYS = [
    'system-ui','ABeeZee','Abel','Agbalumo','Alan Sans','Arimo','Barlow Condensed','Be Vietnam Pro','Borel',
    'Bricolage Grotesque','Caveat','Comic Relief','Cormorant','Crafty Girls','Delius Swash Caps','Dosis','Exo',
    'Fredoka','Fuzzy Bubbles','Indie Flower','Inter','Lato','League Spartan','Lily Script One','Meow Script',
    'Montserrat','Noto Sans','Nunito','Open Sans','Parkinsans','Playfair Display','Playwrite AU NSW','Playwrite AU SA',
    'Playwrite AU TAS','Playwrite DE Grund','Playwrite DE SAS','Playwrite DK Uloopet','Playwrite HU','Playwrite IN',
    'Quicksand','Raleway','Ribeye Marrow','Roboto Flex','Roboto','Rubik','Sacramento','Sanchez','Satisfy','Send Flowers',
    'Smooch Sans','Space Grotesk','Special Gothic','Twinkle Star','Ubuntu','Urbanist','Varela Round','Vibur','Winky Sans'
];
const cssFont = key => key === 'system-ui'
    ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
    : `'${key}', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;

/* Persistence */
async function loadState(){
    const {notes=[],selectedId=null,ui={theme:'auto'}} = await chrome.storage.local.get(["notes","selectedId","ui"]);
    // migrate old fontFamily -> fontKey
    notes.forEach(n=>{
        n.settings = n.settings || {};
        if (!n.settings.fontKey) {
            const ff = n.settings.fontFamily || 'system-ui';
            const m = ff.match(/'([^']+)'/);
            n.settings.fontKey = m ? m[1] : (ff.includes('system-ui') ? 'system-ui' : ff);
        }
    });
    state.notes = notes;
    state.selectedId = selectedId || notes[0]?.id || null;
    state.ui = ui;
    await chrome.storage.local.set({notes}); // persist migration
    applyTheme(ui.theme || 'auto');
}
async function saveState(){ await chrome.storage.local.set({notes:state.notes, selectedId:state.selectedId, ui:state.ui}); }

/* Theme */
function applyTheme(mode){
    const b = document.body; b.removeAttribute('data-theme');
    if (mode === 'dark')  b.dataset.theme = 'dark';
    if (mode === 'light') b.dataset.theme = 'light';
    const t = $("#themeToggle");
    if (t) t.textContent = `Theme: ${mode[0].toUpperCase()+mode.slice(1)}`;
}
function cycleTheme(){
    const order=['auto','light','dark'];
    const idx = order.indexOf(state.ui.theme || 'auto');
    state.ui.theme = order[(idx+1)%order.length];
    applyTheme(state.ui.theme); saveState();
}

/* UI */
function populateFontSelect(){
    const sel = $("#fontFamily"); if (!sel) return;
    sel.innerHTML = "";
    FONT_KEYS.forEach(key=>{
        const opt = document.createElement("option");
        opt.value = key; opt.textContent = (key==='system-ui' ? 'System' : key);
        sel.appendChild(opt);
    });
}

function renderList(filter=""){
    const ul = $("#noteList"); if (!ul) return;
    ul.innerHTML = "";
    const term = filter.trim().toLowerCase();
    const items = state.notes.map(n=>({
        id:n.id,
        title:n.title || "(Untitled)",
        preview: stripHtml(n.html).slice(0,200),
        match: !term || (n.title && n.title.toLowerCase().includes(term)) || stripHtml(n.html).toLowerCase().includes(term)
    })).filter(x=>x.match);

    items.forEach(n=>{
        const li = document.createElement("li"); li.dataset.id = n.id;
        if (n.id === state.selectedId) li.classList.add("active");
        const t = document.createElement("div"); t.className = "title"; t.textContent = n.title;
        const p = document.createElement("div"); p.className = "preview"; p.textContent = n.preview;
        li.appendChild(t); li.appendChild(p);
        li.addEventListener("click", ()=> selectNote(n.id));
        ul.appendChild(li);
    });
}

function stripHtml(html){ const tmp=document.createElement('div'); tmp.innerHTML=html||''; return tmp.textContent||tmp.innerText||""; }

function renderEditor(){
    const editor=$("#editor"), title=$("#titleInput");
    if (!editor || !title) return;
    const note = state.notes.find(n=>n.id===state.selectedId);
    if (!note){ editor.innerHTML=""; title.value=""; return; }
    title.value = note.title || "";
    editor.innerHTML = note.html || "";
    const s = note.settings || {};
    $("#fontFamily").value = s.fontKey || 'system-ui';
    $("#fontSize").value   = s.fontSize || "16px";
    $("#fgColor").value    = s.fgColor  || "#000000";  // default black
    $("#bgColor").value    = s.bgColor  || "#ffffff";  // default white
    applyEditorStyles(currentSettings());
}

function applyEditorStyles({fontKey="system-ui", fontSize="16px", fgColor="#000000", bgColor="#ffffff"}={}){
    const editor=$("#editor"); if(!editor) return;
    editor.style.fontFamily = cssFont(fontKey);
    editor.style.fontSize   = fontSize;
    editor.style.color      = fgColor;
    editor.style.background = bgColor + (bgColor.length===7 ? "cc" : "");
}

/* Ensure note exists when user starts typing */
function ensureActiveNote(){
    if (state.selectedId) return;
    const n = {
        id: uid(),
        title: $("#titleInput").value.trim() || "New note",
        html: $("#editor").innerHTML || "",
        settings: currentSettings()
    };
    state.notes.unshift(n);
    state.selectedId = n.id;
    saveState();
    renderList($("#searchInput").value||"");
}

function selectNote(id){ state.selectedId=id; saveState(); renderList($("#searchInput").value||""); renderEditor(); }

function newNote(initialText=""){
    const n = {
        id: uid(),
        title: "New note",
        html: initialText ? `<p>${escapeHtml(initialText)}</p>` : "",
        settings: { fontKey:"system-ui", fontSize:"16px", fgColor:"#000000", bgColor:"#ffffff" } // defaults updated
    };
    state.notes.unshift(n);
    state.selectedId = n.id;
    saveState(); renderList($("#searchInput").value||""); renderEditor();
    $("#titleInput")?.focus();
}

function deleteCurrent(){
    if (!state.selectedId) return;
    const i = state.notes.findIndex(n=>n.id===state.selectedId);
    if (i>=0){
        state.notes.splice(i,1);
        state.selectedId = state.notes[0]?.id ?? null;
        saveState(); renderList($("#searchInput").value||""); renderEditor();
    }
}

// Auto-save (title/body/styles)
const persistNote = debounce(() => saveCurrentOnly(), 150);

function saveCurrentOnly(){
    ensureActiveNote(); // create if empty list
    const note = state.notes.find(n=>n.id===state.selectedId); if(!note) return;
    note.title = $("#titleInput").value.trim() || "Untitled";
    note.html  = $("#editor").innerHTML;
    note.settings = currentSettings();
    saveState(); renderList($("#searchInput").value||"");
}

// Save & New
function saveAndNew(){
    saveCurrentOnly();
    newNote();
}

function escapeHtml(s){
    return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

// Export TXT including Title + body
async function exportTxt(){
    ensureActiveNote();
    const note = state.notes.find(n=>n.id===state.selectedId); if(!note) return;
    const title = (note.title || 'Untitled');
    const body  = stripHtml(note.html);
    const text  = `${title}\n\n${body}\n`;
    const blob  = new Blob([text],{type:'text/plain;charset=utf-8'});
    const url   = URL.createObjectURL(blob);
    const safeName = title.replace(/[\\/:*?"<>|]/g,'_');
    try{
        if (chrome?.downloads?.download) {
            await chrome.downloads.download({ url, filename: `${safeName}.txt`, saveAs: true });
        } else {
            const a=document.createElement('a'); a.href=url; a.download=`${safeName}.txt`; document.body.appendChild(a); a.click(); a.remove();
        }
    } catch(e){
        const a=document.createElement('a'); a.href=url; a.download=`${safeName}.txt`; document.body.appendChild(a); a.click(); a.remove();
    } finally { setTimeout(()=>URL.revokeObjectURL(url), 10000); }
}

function bindFormatting(){
    document.querySelectorAll('[data-cmd]').forEach(btn=>{
        btn.addEventListener('click', ()=>{
            document.execCommand(btn.dataset.cmd, false); // bold/underline/list act on selection
            persistNote();
        });
    });
}

function bindInputs(){
    $("#addNote").addEventListener("click", ()=> newNote());
    $("#deleteNote").addEventListener("click", deleteCurrent);
    $("#exportTxt").addEventListener("click", exportTxt);
    $("#themeToggle").addEventListener("click", cycleTheme);
    $("#saveNote").addEventListener("click", saveAndNew);
    $("#donateBtn").addEventListener("click", () =>
        window.open("https://alekarpy.github.io/fluid_notes", "_blank", "noopener")
    );
    $("#titleInput").addEventListener("input", ()=>{ ensureActiveNote(); persistNote(); });
    $("#editor").addEventListener("input", ()=>{ ensureActiveNote(); persistNote(); });

    $("#fontFamily").addEventListener("change",  ()=>{ applyEditorStyles(currentSettings()); ensureActiveNote(); persistNote(); });
    $("#fontSize").addEventListener("change",    ()=>{ applyEditorStyles(currentSettings()); ensureActiveNote(); persistNote(); });
    $("#fgColor").addEventListener("input",      ()=>{ applyEditorStyles(currentSettings()); ensureActiveNote(); persistNote(); });
    $("#bgColor").addEventListener("input",      ()=>{ applyEditorStyles(currentSettings()); ensureActiveNote(); persistNote(); });

    $("#searchInput").addEventListener("input", debounce((e)=> renderList(e.target.value), 120));

    // Save on close to avoid loss if user didn't click
    window.addEventListener('beforeunload', ()=> { try{ persistNote.flush(); }catch{} });
}

function currentSettings(){
    return {
        fontKey: $("#fontFamily").value || "system-ui",
        fontSize: $("#fontSize").value  || "16px",
        fgColor: $("#fgColor").value    || "#000000", // default black
        bgColor: $("#bgColor").value    || "#ffffff"  // default white
    };
}

async function main(){
    populateFontSelect();
    await loadState();
    renderList("");
    renderEditor(); // empty or existing — inputs will create on first edit via ensureActiveNote
    bindFormatting();
    bindInputs();
}

document.addEventListener('DOMContentLoaded', main);
