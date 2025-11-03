chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({ id: 'nota_desde_seleccion', title: 'Guardar selección en Notas Fluido', contexts: ['selection'] });
});
chrome.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId !== 'nota_desde_seleccion') return;
    const selection = info.selectionText || '';
    const { notes = [], selectedId = null } = await chrome.storage.local.get(["notes", "selectedId"]);
    const id = crypto.randomUUID();
    const n = { id, title: 'Nueva nota', html: selection ? `<p>${selection.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</p>` : '', settings: { fontFamily: "system-ui", fontSize: "16px", fgColor: "#0b0b0c", bgColor: "#ffffff", fontWeight: "400", wdth: "100", opsz: "16" } };
    notes.unshift(n);
    await chrome.storage.local.set({ notes, selectedId: id });
});
chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'new-note') return;
    const { notes = [], selectedId = null } = await chrome.storage.local.get(["notes", "selectedId"]);
    const id = crypto.randomUUID();
    notes.unshift({ id, title: 'Nueva nota', html: '', settings: { fontFamily: "system-ui", fontSize: "16px", fgColor: "#0b0b0c", bgColor: "#ffffff", fontWeight: "400", wdth: "100", opsz: "16" } });
    await chrome.storage.local.set({ notes, selectedId: id });
});
