chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({ id: 'nota_desde_seleccion', title: 'Guardar selección en Notas Fluido', contexts: ['selection'] });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId !== 'nota_desde_seleccion') return;
    const selection = info.selectionText || '';
    const { notes = [], selectedId = null } = await chrome.storage.local.get(["notes", "selectedId"]);

    // Usamos el mismo generador de ID seguro que en el popup
    const id = crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);

    // Estructura de ajustes limpia y actualizada
    const n = {
        id,
        title: 'Nueva Nota',
        html: selection ? `<p>${selection.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</p>` : '',
        settings: { fontKey: "system-ui", fontSize: "16px", fgColor: "#000000", bgColor: "#ffffff" }
    };

    notes.unshift(n);
    await chrome.storage.local.set({ notes, selectedId: id });
});

chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'new-note') return;
    const { notes = [], selectedId = null } = await chrome.storage.local.get(["notes", "selectedId"]);

    const id = crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);

    notes.unshift({
        id,
        title: 'Nueva Nota',
        html: '',
        settings: { fontKey: "system-ui", fontSize: "16px", fgColor: "#000000", bgColor: "#ffffff" }
    });

    await chrome.storage.local.set({ notes, selectedId: id });
});