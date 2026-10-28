/* ==========================================================================
   PlanPad – Sitzpläne am iPad
   Alles läuft lokal im Browser: keine Server, keine Cloud, keine
   automatische Gesichtserkennung. Pläne liegen im localStorage,
   Gesichtsausschnitte in der IndexedDB dieses Geräts.
   ========================================================================== */
'use strict';

document.addEventListener('DOMContentLoaded', () => {

    /* ==================================================
       Grundlagen
       ================================================== */
    const VERSION = '1.39.1';
    const $ = id => document.getElementById(id);
    const app = $('app');
    const classroom = $('classroom');
    const roomScroll = $('room-scroll');
    const studentInput = $('student-list');
    const inputArea = document.querySelector('.input-area');

    const missingElements = [];
    /** Event sicher anbinden: fehlt ein Element, läuft der Rest trotzdem. */
    function on(target, type, handler) {
        const el = typeof target === 'string' ? $(target) : target;
        if (!el) { missingElements.push(String(target)); return; }
        el.addEventListener(type, handler);
    }

    const countText = (n, one, many) => `${n} ${n === 1 ? one : many}`;

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    /* ----- Symbole (wie JPad: 24 × 24, Strich, currentColor) ----- */
    /** Vorne im Raum: Lehrerpult (von oben) mit Buch, iPad und Stift – ohne Text */
    const BOARD_SVG = `<svg viewBox="0 0 240 72" aria-hidden="true">
        <rect x="2" y="2" width="236" height="68" rx="8" class="d-top"/>
        <rect x="8" y="8" width="224" height="56" rx="5" class="d-inner"/>
        <g transform="translate(66 36) rotate(-13)">
            <rect x="-32" y="-19" width="64" height="38" rx="3" class="d-cover"/>
            <rect x="-29.5" y="-16.5" width="28" height="33" rx="1.5" class="d-page"/>
            <rect x="1.5" y="-16.5" width="28" height="33" rx="1.5" class="d-page"/>
            <path d="M0 -17v34" class="d-spine"/>
            <path d="M-25 -10h20M-25 -4.5h20M-25 1h20M-25 6.5h14M5 -10h20M5 -4.5h20M5 1h17M5 6.5h20M5 12h11" class="d-lines"/>
        </g>
        <g transform="translate(168 36) rotate(9)">
            <rect x="-20" y="-25" width="40" height="50" rx="6" class="d-tablet"/>
            <rect x="-16.5" y="-21.5" width="33" height="43" rx="2.5" class="d-screen"/>
            <path d="M-11 -14h16M-11 -8h22M-11 -2h12" class="d-lines"/>
        </g>
        <g transform="translate(204 40) rotate(-28)">
            <rect x="-2.6" y="-20" width="5.2" height="32" rx="1.6" class="d-pencil"/>
            <path d="M-2.6 12 L0 19 L2.6 12 Z" class="d-tip"/>
            <rect x="-2.6" y="-20" width="5.2" height="5" rx="1.6" class="d-cap"/>
        </g>
    </svg>`;
    const ICONS = {
        menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
        undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
        redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        minus: '<path d="M5 12h14"/>',
        open: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1"/><path d="M3 7v10a2 2 0 0 0 2 2h13l3-8H7l-3 8"/>',
        save: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
        share: '<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
        trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r="1" fill="currentColor"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
        auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
        close: '<path d="M6 6l12 12M18 6L6 18"/>',
        check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
        folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
        problems: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="1" fill="currentColor"/>',
        copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
        dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.4" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.4" fill="currentColor"/>',
        separate: '<path d="M12 4v16"/><path d="M8 12H3M6 9l-3 3 3 3"/><path d="M16 12h5M18 9l3 3-3 3"/>',
        link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
        grid: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/>',
        abcorder: '<path d="M11 6h9M11 12h9M11 18h9"/><path d="M2.8 10.5l2.6-7.5 2.6 7.5M3.8 7.9h3.2"/><path d="M3.3 13.5v7.5h2.9a1.85 1.85 0 0 0 0-3.7H3.3h2.6a1.9 1.9 0 0 0 0-3.8z"/>',
        camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
        printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
        sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
        chevron: '<path d="M6 9l6 6 6-6"/>',
        note: '<path d="M5 4h10l4 4v12H5z"/><path d="M14 4v5h5"/><path d="M8 13h8M8 17h5"/>',
        edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
        fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
        zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6M11 8v6"/>',
        zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6"/>',
        present: '<path d="M14 4h6v6M10 20H4v-6"/><path d="M20 4l-7 7M4 20l7-7"/>',
        lockOpen: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.8"/>',
        book: '<path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z"/><path d="M4 20a2 2 0 0 0 2 2h13v-4"/><path d="M8 7h7"/>',
        broom: '<path d="M21 3l-6.4 6.4"/><path d="M12.6 8.4l3 3"/><path d="M12.6 8.4l-1.8 1.8M15.6 11.4l-1.8 1.8"/><path d="M10.8 10.2c-2.7.4-5.8 2.1-7.8 5.9l1.9 1-1.2 2 2.3.2.2 2.3 2-1.2 1 1.9c3.8-2 5.5-5.1 5.9-7.8z"/><path d="M9.6 13.4l-3.4 3.4M11.6 14.4l-2.6 2.6"/>',
        listImport: '<path d="M4 6h7M4 11h7M4 16h5"/><path d="M17 20V8"/><path d="M13 12l4-4 4 4"/>',
        learn: '<path d="M3 8l9-4 9 4-9 4z"/><path d="M7 10v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5"/><path d="M21 8v6"/>',
        bulb: '<path d="M9.5 18.5h5M10.5 21.5h3"/><path d="M12 2.5a6.3 6.3 0 0 0-3.8 11.3c.8.6 1.3 1.5 1.3 2.5v.2h5v-.2c0-1 .5-1.9 1.3-2.5A6.3 6.3 0 0 0 12 2.5z" fill="#FFD43B" stroke="#B8860B"/><path d="M10.2 9.5a2 2 0 0 1 1.8-1.6" stroke="#fff" stroke-width="1.4"/>',
        sick: '<path d="M9.4 3.8h5.2v5.6h5.6v5.2h-5.6v5.6H9.4v-5.6H3.8V9.4h5.6z" fill="currentColor" stroke-linejoin="round" stroke-width="1.2"/>',
        clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.2 2"/>',
        arrive: '<path d="M14.5 3.5h5.5v17h-5.5"/><circle cx="17.6" cy="12.2" r=".6" fill="currentColor"/><circle cx="7.4" cy="4.9" r="1.7"/><path d="M3.5 12.3l2.6-2.8h3l2.4 3 2.3.7"/><path d="M7.6 9.6l-1.3 5.2 2.8 2v3.8"/><path d="M6.3 14.8l-2.6 5.7"/>',
        eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        thumbUp: '<path d="M7 10v10H4V10z"/><path d="M7 10l4-7a2 2 0 0 1 2.6 1.9L13 9h5.4a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.2 20H7"/>',
        thumbDown: '<path d="M7 14V4H4v10z"/><path d="M7 14l4 7a2 2 0 0 0 2.6-1.9L13 15h5.4a2 2 0 0 0 2-2.3l-1.2-7A2 2 0 0 0 17.2 4H7"/>',
        chart: '<path d="M4 4v16h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
        users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 20a6.5 6.5 0 0 0-2.5-5.5"/>'
    };
    function icon(name) {
        return `<svg class="pp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
    }
    document.querySelectorAll('[data-icon]').forEach(el => {
        el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
    });

    /* ==================================================
       Hinweise (Toast) & Dialoge (Sheets)
       ================================================== */
    let toastTimer = null;
    /** kind: 'info' | 'ok' | 'warn' */
    function showToast(text, kind = 'info', ms = 3200) {
        let t = document.querySelector('.pp-toast');
        if (!t) {
            t = document.createElement('div');
            t.className = 'pp-toast';
            t.setAttribute('role', 'status');
            document.body.appendChild(t);
        }
        t.className = `pp-toast is-${kind}`;
        t.innerHTML = icon(kind === 'ok' ? 'check' : kind === 'warn' ? 'problems' : 'info') + `<span>${escapeHtml(text)}</span>`;
        requestAnimationFrame(() => t.classList.add('is-visible'));
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('is-visible'), ms);
    }

    /**
     * Allgemeiner Dialog. Liefert ein Promise mit dem value des gewählten Buttons
     * (bzw. null beim Schließen über den Hintergrund oder Escape).
     * opts: { title, text, lines: [], content: Node, buttons: [{ label, value, kind }], input: { label, value } }
     */
    function sheet(opts) {
        return new Promise(resolve => {
            const layer = document.createElement('div');
            layer.className = 'pp-sheet-layer';
            const box = document.createElement('div');
            box.className = 'pp-sheet';
            box.setAttribute('role', 'dialog');
            box.setAttribute('aria-modal', 'true');
            if (opts.className) box.classList.add(...opts.className.split(' '));

            if (opts.title) {
                const h = document.createElement('h2');
                h.className = 'pp-sheet-title';
                h.textContent = opts.title;
                box.appendChild(h);
            }
            if (opts.text) {
                const p = document.createElement('p');
                p.className = 'pp-sheet-text';
                p.textContent = opts.text;
                box.appendChild(p);
            }
            if (opts.lines && opts.lines.length) {
                const ul = document.createElement('ul');
                ul.className = 'pp-sheet-list';
                opts.lines.forEach(l => {
                    const li = document.createElement('li');
                    li.textContent = l;
                    ul.appendChild(li);
                });
                box.appendChild(ul);
            }
            let input = null;
            if (opts.input) {
                const label = document.createElement('label');
                label.className = 'pp-field';
                label.textContent = opts.input.label || '';
                input = document.createElement('input');
                input.type = opts.input.type || 'text';
                input.value = opts.input.value || '';
                input.autocomplete = 'off';
                label.appendChild(input);
                box.appendChild(label);
            }
            if (opts.content) box.appendChild(opts.content);

            const bar = document.createElement('div');
            bar.className = 'pp-sheet-buttons';
            const finish = value => {
                layer.classList.remove('is-open');
                document.removeEventListener('keydown', onKey, true);
                setTimeout(() => layer.remove(), 220);
                resolve(value);
            };
            (opts.buttons || [{ label: 'OK', value: true, kind: 'primary' }]).forEach(b => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pp-btn' + (b.kind ? ` pp-btn-${b.kind}` : '');
                btn.textContent = b.label;
                btn.addEventListener('click', () => {
                    if (input && b.value === true) finish(input.value.trim());
                    else finish(b.value);
                });
                bar.appendChild(btn);
            });
            box.appendChild(bar);

            const onKey = e => {
                if (e.key === 'Escape') { e.stopPropagation(); finish(null); }
                if (e.key === 'Enter' && input && document.activeElement === input) {
                    e.preventDefault();
                    finish(input.value.trim());
                }
            };
            document.addEventListener('keydown', onKey, true);
            layer.addEventListener('click', e => { if (e.target === layer) finish(null); });

            layer.appendChild(box);
            document.body.appendChild(layer);
            requestAnimationFrame(() => {
                layer.classList.add('is-open');
                if (input) { input.focus(); input.select(); }
            });
        });
    }

    const ui = {
        alert: (title, text, lines) => sheet({ title, text, lines, buttons: [{ label: 'OK', value: true, kind: 'primary' }] }),
        confirm: (title, text, okLabel = 'OK', danger = false, lines) => sheet({
            title, text, lines,
            buttons: [{ label: 'Abbrechen', value: false }, { label: okLabel, value: true, kind: danger ? 'danger' : 'primary' }]
        }).then(v => v === true),
        prompt: (title, label, value, okLabel = 'OK', type = 'text') => sheet({
            title, input: { label, value, type },
            buttons: [{ label: 'Abbrechen', value: null }, { label: okLabel, value: true, kind: 'primary' }]
        }).then(v => (typeof v === 'string' && v ? v : null))
    };

    /* ==================================================
       Konstanten & Zustand
       ================================================== */
    // Alles liegt auf einem 20-px-Raster (die Punkte im Raum). Ein Tisch (76 px)
    // füllt eine 80-px-Zelle; zusammenstehende Tische haben 4 px Fuge.
    const GRID = 20;
    const MARGIN = 20;        // Abstand der Anordnung zum Raumrand
    const TIGHT = 4;          // Fuge zwischen Tischen, die zusammenstehen
    const ROW_GAP = 24;       // Abstand zwischen zwei Reihen  (76 + 24 = 100)
    const AISLE = 44;         // Gang zwischen Zweiertischen / Gruppen (156 + 44 = 200)
    const snap = v => Math.max(0, Math.round(v / GRID) * GRID);
    const NEIGHBOR_GAP = 30;  // bis hierhin gelten Tische als benachbart (Trennen)
    const TOGETHER_GAP = 15;  // bis hierhin gehören Tische zum selben Tischverbund (Koppeln)

    const KEY_PLANS = 'planpad.plans';
    const KEY_CURRENT = 'planpad.current';
    const KEY_THEME = 'planpad.theme';
    const KEY_PHOTOS = 'planpad.photos';

    const squares = [];             // alle Tisch-Elemente
    let students = [];              // eindeutige Namen
    let duplicateNames = [];
    let separationGroups = [];      // sollen getrennt sitzen
    let couplingGroups = [];        // sollen zusammen sitzen
    let currentLayout = '';         // zuletzt gewählte Anordnung
    let selecting = false;          // Auswahlmodus für Regeln
    let selectMode = 'separate';
    let currentSelection = [];
    // Fotos gehören zu einem Plan: planId → (Name → Gesichtsausschnitt). Nur lokal.
    const facesByPlan = new Map();
    let currentPlanId = null;
    let faces = new Map();          // Fotos des geöffneten Plans
    let paneViewReady = false;      // Notizansicht ist eingerichtet
    let notesMode = true;           // Standard: Notizansicht; „Gruppen“ schaltet auf Namen & Regeln
    let noteStudent = null;         // SuS, deren Notizen gerade angezeigt werden
    const KEY_NOTES = 'planpad.notes';
    const CLASS_KEY = '\u0000Klasse';  // Klassennotizen liegen bei den Notizen der Klasse unter diesem Schlüssel
    let zoom = 1;                   // Darstellungsgröße des Raums
    let fitMode = false;            // Raum automatisch einpassen
    let pinching = false;           // gerade Zwei-Finger-Zoom
    // Eine Klasse hat mehrere Sitzpläne (Tische + Plätze). Namen, Regeln, Notizen und Fotos gelten für alle.
    let seatings = [];              // [{ id, name, layout, squares, mixBase, mixResult }]
    let currentSeatingId = null;
    let lastDirty = null;           // zuletzt gezeigter Schloss-Zustand der Reiter
    let namesSession = null;        // laufende Bearbeitung der Namensliste: { lines, origins }
    let observ = { off: false, count: 4, periods: [] };   // Unterrichtsbeobachtungen der Klasse
    let votes = {};                 // Sterne je Kind und Kategorie
    let absences = [];              // Fehlzeiten: { id, name, date, from (fehlt seit), to (gekommen), late (Min.) }
    let lastNames = {};             // Name → Nachname (aus der CSV-Liste), für „In Reihenfolge“

    /* ==================================================
       Namen & Kärtchen
       ================================================== */
    // Die Namensliste wird erst übernommen, wenn die Eingabe endet (Fertig, anderswo tippen,
    // Klasse/Sitzplan wechseln, App schließen). So wird aus „Veronika“ → „Vroni“ eine
    // Umbenennung – und keine neue Person, bei der Notizen, Foto und Platz verloren gingen.
    on(studentInput, 'focus', () => { if (!namesSession) beginNamesSession(); });
    on(studentInput, 'input', trackNameLines);
    // kurz warten: ein Tipp auf „Fertig“ soll zuerst ankommen (sonst läge die Rückfrage darüber)
    on(studentInput, 'blur', () => {
        setTimeout(() => { if (document.activeElement !== studentInput) commitNames(true); }, 250);
    });
    on('edit-names-btn', 'click', () => {
        if (app.classList.contains('sidebar-collapsed')) setSidebar(true);
        app.classList.add('is-editing-names');
        studentInput.focus();
    });
    on('names-done-btn', 'click', async () => {
        studentInput.blur();
        await commitNames(true);
        if (!students.length) return;
        // Klasse von Hand angelegt, noch keine Tische: gleich Zweiertische aufstellen und befüllen –
        // die Ansicht bleibt dabei in der Klassen-/Gruppenansicht
        const fresh = !squares.length;
        if (fresh) setNotesMode(false);
        app.classList.remove('is-editing-names');
        if (fresh) {
            applyLayout('pairs');
            shuffleSeats();
            if (fitMode) requestAnimationFrame(fitToContent);
            showToast(`${students.length} SuS auf Zweiertische verteilt. „Layouts“ und „Mix“ ändern die Anordnung.`, 'ok', 4000);
        }
    });

    function beginNamesSession() {
        const lines = studentInput.value.split('\n');
        namesSession = { lines, origins: namesFromLines(lines).perLine, dirty: false };
    }

    /** Merkt sich bei jeder Eingabe, aus welchem ursprünglichen Namen eine Zeile entstanden ist. */
    function trackNameLines() {
        if (!namesSession) beginNamesSession();
        const sess = namesSession;
        const old = sess.lines;
        const neu = studentInput.value.split('\n');
        let p = 0;
        while (p < old.length && p < neu.length && old[p] === neu[p]) p++;
        let s = 0;
        while (s < old.length - p && s < neu.length - p && old[old.length - 1 - s] === neu[neu.length - 1 - s]) s++;
        const oldMid = old.slice(p, old.length - s);
        const origMid = sess.origins.slice(p, old.length - s);
        const newMid = neu.slice(p, neu.length - s);
        let carried;
        if (oldMid.length === 1 && newMid.length === 1) {
            carried = origMid.slice();                         // eine Zeile wurde geändert (Tippen) → gleiche Person
        } else {
            // mehrere Zeilen auf einmal (Einfügen, Liste ersetzen) oder Zeilen eingefügt/entfernt:
            // Herkunft nur bei unverändertem Text übernehmen
            const free = oldMid.map((t, i) => ({ t: t.trim(), o: origMid[i], used: false }));
            carried = newMid.map(t => {
                const hit = free.find(f => !f.used && f.t && f.t === t.trim());
                if (!hit) return '';
                hit.used = true;
                return hit.o;
            });
        }
        sess.origins = [...sess.origins.slice(0, p), ...carried, ...sess.origins.slice(old.length - s)];
        sess.lines = neu;
        sess.dirty = true;
    }

    /**
     * Textfeld → Personen. Eine Zeile „Nachname, Vorname“ (oder nur „Vorname“).
     * Angezeigt wird weiter der Vorname – bei gleichen Vornamen mit Nachnamen-Kürzel („Max Kra.“).
     * perLine: Anzeigename je Zeile ('' = leer/doppelt), list: alle Namen, last: Name → Nachname.
     */
    function namesFromLines(lines) {
        const seen = new Set();
        const dups = new Set();
        const people = [];
        const at = [];
        lines.forEach((raw, i) => {
            const t = raw.trim();
            if (!t) return;
            const c = t.indexOf(',');
            let first = t, last = '';
            if (c >= 0) {
                last = t.slice(0, c).trim().replace(/\s+/g, ' ');
                first = t.slice(c + 1).trim().replace(/\s+/g, ' ');
                if (!first) { first = last; last = ''; }
                if (!first) return;
            }
            if (!last) {
                // gleiche Zeile ohne Nachnamen zweimal: Tippfehler, als doppelt melden
                if (seen.has(first)) { dups.add(first); return; }
                seen.add(first);
            }
            people.push({ first, last });
            at.push(i);
        });
        const shown = displayNamesOrdered(people);
        const perLine = lines.map(() => '');
        const firstOf = lines.map(() => '');
        const last = {};
        shown.forEach((n, k) => { perLine[at[k]] = n; firstOf[at[k]] = people[k].first; if (people[k].last) last[n] = people[k].last; });
        return { perLine, firstOf, list: shown, dups: [...dups], last };
    }
    /** Textfeld-Inhalt: „Nachname, Vorname“, wo der Nachname bekannt ist */
    function namesText() {
        return students.map(n => (lastNames[n] ? `${lastNames[n]}, ${firstNameOf(n)}` : n)).join('\n');
    }
    function sameLastNames(a, b) {
        const ka = Object.keys(a).filter(k => a[k]), kb = Object.keys(b).filter(k => b[k]);
        return ka.length === kb.length && ka.every(k => a[k] === b[k]);
    }
    /** Nur das Nachnamen-Kürzel hat sich geändert („Max“ → „Max Kra.“): sicher dieselbe Person */
    function sameKid(oldName, newFirst, newLast) {
        const lc = x => String(x).toLocaleLowerCase('de');
        const strip = x => String(x).replace(/ \(\d+\)$/, '');
        const a = strip(firstNameOf(oldName)), b = newFirst;
        if (lc(a) === lc(b)) return !lastNames[oldName] || !newLast || lastNames[oldName] === newLast;
        // alte Klasse ohne gespeicherte Nachnamen: „Max Kra.“ → „Kraus, Max“
        const m = strip(oldName).match(/^(.+) (\S+?)\.?$/);
        return Boolean(m && newLast && lc(m[1]) === lc(b) && lc(newLast).startsWith(lc(m[2])));
    }

    let committingNames = null;
    /**
     * Übernimmt die bearbeitete Namensliste.
     * interactive = false (App wird geschlossen): Umbenennungen ohne Rückfrage übernehmen.
     */
    function commitNames(interactive = true) {
        if (committingNames) return committingNames;
        const sess = namesSession;
        if (!sess) return Promise.resolve(false);
        namesSession = null;
        const run = async () => {
            const lines = studentInput.value.split('\n');
            const { perLine, firstOf, list, dups, last: newLast } = namesFromLines(lines);
            const oldList = students.slice();
            const oldSet = new Set(oldList);
            const newSet = new Set(list);
            // Umbenennungen: Zeile stammt von einem bisherigen Namen, der so nicht mehr vorkommt
            const renames = [];
            const usedOrigins = new Set();
            const seenLine = new Set();
            const quiet = [];
            perLine.forEach((n, i) => {
                const o = sess.origins[i] || '';
                if (!n || seenLine.has(n)) return;
                seenLine.add(n);
                if (!o || o === n || !oldSet.has(o) || newSet.has(o) || oldSet.has(n) || usedOrigins.has(o)) return;
                usedOrigins.add(o);
                (sameKid(o, firstOf[i], newLast[n]) ? quiet : renames).push([o, n]);
            });
            if (sameList(oldList, list) && !renames.length && !quiet.length) {
                if (dups.join() !== duplicateNames.join()) { duplicateNames = dups; renderStudentList(); }
                if (!sameLastNames(lastNames, newLast)) {
                    lastNames = newLast;
                    if (!dups.length && document.activeElement !== studentInput) studentInput.value = namesText();
                    refreshSeatLabels();
                    renderStudentList();
                    changed();
                    saveCurrentPlan();
                    return true;
                }
                return false;
            }
            let accepted = renames;
            if (renames.length && interactive) accepted = await confirmRenames(renames);
            accepted = [...quiet, ...accepted];
            accepted.forEach(([o, n]) => renameStudent(o, n, { silent: true }));

            // Wer fehlt jetzt und hat Notizen oder ein Foto? Evtl. gehört das zu einem neuen Namen.
            const renamedTo = new Set(accepted.map(r => r[1]));
            if (interactive) {
                const added = list.filter(n => !oldSet.has(n) && !renamedTo.has(n) && !hasStudentData(n));
                // wer eben bewusst als „andere Person“ markiert wurde, wird nicht nochmal gefragt
                const declined = new Set(renames.filter(r => !accepted.includes(r)).map(r => r[0]));
                const orphans = dataNames().filter(n => !newSet.has(n) && !declined.has(n));
                for (const orphan of orphans) {
                    const free = added.slice();
                    if (!free.length) break;
                    const target = await askOrphanTarget(orphan, free);
                    if (!target) continue;
                    renameStudent(orphan, target, { silent: true });
                    renamedTo.add(target);
                    added.splice(added.indexOf(target), 1);
                }
            }
            duplicateNames = dups;
            lastNames = newLast;
            setStudents(list);
            if (!dups.length && document.activeElement !== studentInput) studentInput.value = namesText();   // einheitlich „Nachname, Vorname“
            refreshSeatLabels();
            renderNotes();
            const kept = oldList.filter(n => !newSet.has(n) && !accepted.some(r => r[0] === n) && hasStudentData(n));
            if (kept.length) {
                showToast(`${kept.join(', ')} ${kept.length === 1 ? 'steht' : 'stehen'} nicht mehr in der Liste. Notizen und Fotos bleiben gespeichert und erscheinen wieder, wenn der Name erneut eingetragen wird.`, 'info', 6000);
            } else if (renamedTo.size) {
                showToast(`Umbenannt – Notizen, Foto, Sitzplätze und Regeln wurden übernommen.`, 'ok', 3500);
            }
            changed();
            if (renamedTo.size) { saveCurrentPlan(); resetHistory(); }
            return true;
        };
        committingNames = run().finally(() => { committingNames = null; });
        return committingNames;
    }

    function sameList(a, b) {
        return a.length === b.length && a.every((x, i) => x === b[i]);
    }

    /** Rückfrage: welche geänderten Zeilen sind Umbenennungen? */
    async function confirmRenames(renames) {
        const content = document.createElement('div');
        content.className = 'pp-rename-list';
        const boxes = renames.map(([o, n]) => {
            const label = document.createElement('label');
            label.className = 'pp-rename-item';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = true;
            const t = document.createElement('span');
            t.innerHTML = `<s>${escapeHtml(o)}</s> → <b>${escapeHtml(n)}</b>`;
            label.append(cb, t);
            content.appendChild(label);
            return cb;
        });
        const hint = document.createElement('p');
        hint.className = 'pp-hint';
        hint.textContent = 'Haken entfernen, wenn es eine andere Person ist. Deren Notizen bleiben dann beim alten Namen gespeichert.';
        content.appendChild(hint);
        const ok = await sheet({
            title: renames.length === 1 ? 'Name geändert' : 'Namen geändert',
            text: 'Notizen, Foto, Sitzplätze (in allen Sitzplänen) und Regeln werden übernommen:',
            content,
            buttons: [{ label: 'Übernehmen', value: true, kind: 'primary' }]
        });
        // Schließen ohne Auswahl gilt ebenfalls als „übernehmen“ – so geht nichts verloren
        if (ok === null) return renames;
        return renames.filter((_, i) => boxes[i].checked);
    }

    async function askOrphanTarget(orphan, candidates) {
        const nNotes = (notesOfPlan(currentPlanId)[orphan] || []).length;
        const what = [nNotes ? countText(nNotes, 'Notiz', 'Notizen') : '', faces.has(orphan) ? 'ein Foto' : ''].filter(Boolean).join(' und ');
        const verb = (nNotes === 1 && !faces.has(orphan)) || (!nNotes && faces.has(orphan)) ? 'ist' : 'sind';
        const buttons = candidates.slice(0, 6).map(n => ({ label: `Ja, ${n}`, value: n }));
        buttons.push({ label: 'Nein, neue Person', value: false, kind: 'primary' });
        const v = await sheet({
            title: `Gehört das zu ${orphan}?`,
            text: `Für „${orphan}“ ${verb} ${what} gespeichert, der Name steht aber nicht mehr in der Liste. Ist ${orphan} unter einem neuen Namen dabei?`,
            buttons
        });
        return typeof v === 'string' ? v : null;
    }

    /** Namen dieser Klasse, zu denen Notizen oder Fotos gespeichert sind */
    function dataNames() {
        const set = new Set(Object.keys(notesOfPlan(currentPlanId)).filter(n => n !== CLASS_KEY && (notesOfPlan(currentPlanId)[n] || []).length));
        faces.forEach((_, n) => set.add(n));
        return [...set];
    }
    function hasStudentData(name) {
        return faces.has(name) || (notesOfPlan(currentPlanId)[name] || []).length > 0;
    }

    /**
     * Person umbenennen: Notizen, Foto, Sitzplätze in allen Sitzplänen, Regeln und
     * Mix-Stände wandern mit. Nichts wird gelöscht.
     */
    function renameStudent(oldName, newName, { silent = false } = {}) {
        if (!oldName || !newName || oldName === newName) return false;
        const i = students.indexOf(oldName);
        if (i >= 0) {
            if (students.includes(newName)) return false;
            students[i] = newName;
        }
        const swap = n => (n === oldName ? newName : n);
        squares.forEach(sq => { if (sq.dataset.student === oldName) setSeat(sq, newName); });
        seatings.forEach(st => {
            if (Array.isArray(st.squares)) st.squares.forEach(q => { if (q.student === oldName) q.student = newName; });
            if (st.work && Array.isArray(st.work.squares)) st.work.squares.forEach(q => { if (q.student === oldName) q.student = newName; });
            if (st.orderBase && Array.isArray(st.orderBase.squares)) st.orderBase.squares.forEach(q => { if (q.student === oldName) q.student = newName; });
            ['mixBase', 'mixResult'].forEach(k => {
                if (st[k] && typeof st[k] === 'object') Object.keys(st[k]).forEach(t => { st[k][t] = swap(st[k][t]); });
            });
        });
        if (lastNames[oldName] !== undefined) { lastNames[newName] = lastNames[oldName]; delete lastNames[oldName]; }
        observ.periods.forEach(p => { if (p.name === oldName) p.name = newName; });
        absences.forEach(a => { if (a.name === oldName) a.name = newName; });
        if (votes[oldName]) {
            const o = votes[oldName];
            const n = votes[newName] || {};
            votes[newName] = { ...n };
            Object.entries(o).forEach(([k, a]) => { votes[newName][k] = [...(n[k] || []), ...a]; });
            delete votes[oldName];
        }
        separationGroups = separationGroups.map(g => g.map(swap));
        couplingGroups = couplingGroups.map(g => g.map(swap));
        currentSelection = currentSelection.map(swap);
        if (noteStudent === oldName) noteStudent = newName;
        // Notizen
        const all = readAllNotes();
        const pl = all[currentPlanId];
        if (pl && pl[oldName]) {
            pl[newName] = [...(pl[newName] || []), ...pl[oldName]];
            delete pl[oldName];
            writeAllNotes(all);
        }
        // Foto (ein vorhandenes Foto unter dem neuen Namen bleibt)
        const url = faces.get(oldName);
        if (url && !faces.has(newName)) { setFace(newName, url); setFace(oldName, null); }
        if (!silent) {
            studentInput.value = namesText();
            renderStudentList();
            renderRules();
            renderNotes();
            refreshMarks();
            changed();
            saveCurrentPlan();
            resetHistory();
        }
        return true;
    }

    function readStudentInput(names) {
        const list = [...new Set(names.map(n => String(n).trim()).filter(Boolean))];
        Object.keys(lastNames).forEach(n => { if (!list.includes(n) || !lastNames[n]) delete lastNames[n]; });
        duplicateNames = [];
        students = list;
        studentInput.value = namesText();
        setStudents(list);
    }

    /** Übernimmt eine neue Namensliste und räumt alles auf, was nicht mehr passt. */
    function setStudents(list) {
        students = list;
        const valid = new Set(list);
        squares.forEach(sq => {
            if (sq.dataset.student && !valid.has(sq.dataset.student)) setSeat(sq, '');
        });
        const prune = groups => groups.map(g => g.filter(n => valid.has(n))).filter(g => g.length > 1);
        separationGroups = prune(separationGroups);
        couplingGroups = prune(couplingGroups);
        currentSelection = currentSelection.filter(n => valid.has(n));
        renderStudentList();
        renderRules();
        if (paneViewReady) updatePaneView();
    }

    /** Kinder, die (noch) keinen Tisch haben */
    function unseatedStudents() {
        const seated = new Set(squares.map(sq => sq.dataset.student).filter(Boolean));
        return students.filter(n => !seated.has(n));
    }

    let lastPillsKey = null;
    let pillsPref = null;            // „Kärtchen ein-/ausblenden“: null = automatisch (offen, solange jemand keinen Platz hat)
    let trayKey = null;              // zuletzt gezeigte Ablage (um unnötiges Neuzeichnen zu vermeiden)

    /** Ablage „Ohne Platz“: nur Kinder ohne Tisch als ziehbare Kärtchen */
    function renderStudentList() {
        const open = unseatedStudents();
        trayKey = open.join('\u0000') + '|' + students.length;
        const wrapper = document.createElement('div');
        wrapper.className = 'student-list';

        const head = $('tray-head');
        if (head) head.textContent = students.length ? 'Sitzplätze' : 'Namen';
        if (!students.length) {
            const p = document.createElement('p');
            p.className = 'pp-empty-pills';
            p.textContent = 'Noch keine Namen. Tippe auf „Namen bearbeiten“ und gib die Klasse ein – ein Kind pro Zeile als „Nachname, Vorname“.';
            wrapper.appendChild(p);
        } else {
            // Stand: grün = alle sitzen, gelb = einige, neutral = noch niemand
            const seatedCount = students.length - open.length;
            const p = document.createElement('p');
            p.className = 'pp-tray-done' + (!open.length ? '' : seatedCount ? ' is-partial' : ' is-none');
            p.innerHTML = !open.length
                ? `${icon('check')}<span>Alle ${students.length} SuS haben einen Platz.</span>`
                : `${icon('users')}<span>${seatedCount} von ${students.length} SuS haben einen Platz.</span>`;
            wrapper.appendChild(p);
            if (open.length) {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'pp-chipbtn pp-photo-btn pp-seat-all';
                b.id = 'seat-rest';
                b.innerHTML = `<span>Plätze anlegen oder verteilen</span>`;
                b.title = `${countText(open.length, 'Kind ohne Platz bekommt', 'Kinder ohne Platz bekommen')} einen Tisch`;
                b.addEventListener('click', seatRemaining);
                wrapper.appendChild(b);
            }
        }
        // Kärtchen gibt es nur noch in einer Ansicht: im Kasten darunter (renderAllPills)
        if (duplicateNames.length) {
            const hint = document.createElement('div');
            hint.className = 'student-hint';
            hint.textContent = `Doppelt eingegeben (nur einmal übernommen): ${duplicateNames.join(', ')}`;
            wrapper.appendChild(hint);
        }

        const old = inputArea.querySelector('.student-list');
        if (old) old.replaceWith(wrapper);
        else inputArea.appendChild(wrapper);

        const count = $('student-count');
        if (count) count.textContent = students.length ? `${students.length} SuS` : '';
        renderAllPills();
        renderLearnButton();
        refreshMarks();
    }

    /* ==================================================
       Hilfe: „So verwendest Du PlanPad“ (kleines HowTo mit Bildschirmfotos)
       ================================================== */
    const HELP_PAGES = [
        {
            title: 'Einstieg in PlanPad', img: 'help/einstieg.webp',
            text: 'PlanPad erstellt Sitzpläne für Deine Klassen – direkt am iPad, ohne Anmeldung. Dazu kommen Notizen zu einzelnen Schüler:innen, Fotos zum Namenlernen und Regeln, wer (nicht) nebeneinander sitzen soll. Eine Klasse legst Du im Menü ☰ auf zwei Wegen an:',
            points: [
                'Manuell: „Klasse anlegen“, die Namen eintippen – ein Kind pro Zeile als „Nachname, Vorname“ – und „Fertig“ tippen: PlanPad stellt Zweiertische auf und verteilt die Klasse.',
                'Als Import: Lade z. B. im Infoportal Deine Klasse als Liste (Excel-Liste mit Namen) herunter. Dann „Klasse als Liste importieren“ und die Datei auswählen – PlanPad übernimmt alle Namen, stellt Zweiertische auf und verteilt die Klasse.',
                'Die Datei wird nur im Browser gelesen und nirgends hochgeladen.',
                'Zum Ausprobieren: Menü ☰ → „Demoklasse laden“. Hilfe zu jedem Button: Finger länger als 1 Sekunde darauf legen. Die gelbe Glühbirne oben öffnet dieses Handbuch.'
            ]
        },
        {
            title: 'Klassen & Sitzpläne', img: 'help/sitzplaene.webp',
            text: 'Oben steht die geöffnete Klasse, daneben ihre Sitzpläne als Reiter.',
            points: [
                'Klassenname antippen (▾): Klasse wechseln, umbenennen oder neu anlegen. Liste importieren, sichern: Menü ☰.',
                'Reiter antippen: zu diesem Sitzplan wechseln – z. B. „Normal“, „Gruppenarbeit“, „Prüfung“.',
                '„+ Sitzplan ergänzen“ legt einen weiteren Sitzplan an (Kopie oder leer).',
                'Namen, Regeln, Notizen und Fotos gelten für alle Sitzpläne der Klasse.',
                'Gelber Reiter mit offenem Schloss: Tische oder Plätze wurden verändert. Antippen → übernehmen oder verwerfen.'
            ]
        },
        {
            title: 'Zwei Modi der Seitenleiste', img: 'help/umschalter.webp',
            text: 'Rechts oben im Raum schaltest Du die linke Leiste um:',
            points: [
                'Männchen = Gruppen-Modus: Namen, Sitzplätze, Klassenfoto und Regeln.',
                'Notizblatt = Notizen-Modus: Notizen zu einzelnen Schüler:innen (Standard).',
                'Das Leisten-Symbol oben links (neben ☰) klappt die Leiste ganz ein – mehr Platz für den Raum.'
            ]
        },
        {
            title: 'Gruppen-Modus', img: 'help/gruppen.webp', tall: true,
            text: 'Hier entsteht die Sitzordnung.',
            points: [
                '„Namen bearbeiten“: ein Kind pro Zeile als „Nachname, Vorname“ (der Nachname ist freiwillig). Umbenennen (z. B. Veronika → Vroni) behält Notizen und Foto.',
                'Ohne Platz: Kärtchen auf einen freien Tisch ziehen.',
                '„Mix“ mischt die SuS, die schon an Tischen sitzen (auch Teilgruppen) – wer links in der Liste steht, bleibt dort. Sitzt noch niemand, bekommt die ganze Klasse einen Platz. „Demix“ holt die Ordnung von vorher zurück.',
                'Umsetzen: zwei Tische nacheinander antippen.',
                'Klassenfoto: Gesichter zuordnen – danach „Namen lernen“ (Foto + 4 Namen). Gezählt wird die Serie ohne Fehler; ein Fehler setzt sie auf 0. Der Rekord steht auf dem Button.',
                'Regeln: „Trennen“ und „Koppeln“, darunter „Konflikte lösen“.'
            ]
        },
        {
            title: 'Notizen-Modus', img: 'help/notizen.webp',
            text: 'Für den Unterricht: Tisch antippen, Notiz schreiben.',
            points: [
                'Tisch antippen: Notizen dieser Person, oben eine neue Notiz (Unterrichtsnotiz, Note, Bemerkung).',
                'Neue Notizen sind gelb markiert („neu“), der Tisch bekommt einen gelben Punkt. Ohne Auswahl zeigt die Leiste alle neuen Notizen der Klasse – mit ✓ einzeln abhaken oder „Alle als gelesen markieren“. Hat ein Kind keine neue Notiz mehr, verschwindet der Punkt.',
                'Stift neben dem Namen: Namen ändern – Notizen bleiben erhalten. Foto antippen: Foto ändern.',
                'Irgendwo ins Leere tippen: Auswahl aufheben.',
                'Ganz oben ohne Auswahl: „Beobachten“ (wer gerade beobachtet wird, wie lange noch; „Beobachtungen planen“) und „Statistik“ (Beobachtungen, Noten, Sterne je Kind – Zeile antippen für Details und Verlauf). Darunter die Klassennotizen (gestrichelter Kasten) – „Anlegen“ für Notizen zur ganzen Klasse.',
                'Unterrichtsbeobachtung: Ist seit dem letzten Öffnen der Klasse eine Beobachtung abgelaufen oder beendet worden, schlägt PlanPad beim Öffnen genauso viele neue Kinder vor (zuerst die noch nie Beobachteten). Ein Zeitraum dauert 10 Schultage, Ferien zählen nicht. Das Auge oben links auf dem Tisch zeigt, wer beobachtet wird – der dunkle Ring, wie viel Zeit noch bleibt (beim Präsentieren unsichtbar).',
                'Fehlzeiten: Kreuz|Uhr in der Raumleiste → Tische der fehlenden Kinder antippen (grau). Kommt jemand später: Tür-Button → Tisch antippen, PlanPad rechnet die Verspätung aus (auf 5 Min. aufgerundet). Ohne Auswahl zeigt die Leiste „Fehlzeiten“ Tag für Tag (‹ ›), beim Kind und in der Statistik stehen alle Einträge.',
                'Unter der Notiz: Sterne je Kategorie (neue Klassen: Verhalten und Selbstorganisation) – Daumen hoch/runter = ±½ Stern. Stift: umbenennen oder entfernen. „weitere hinzufügen“: eigene Kategorie (bis zu 10) für diese Klasse oder alle.',
                'Notizen gelten in allen Sitzplänen. Beim Präsentieren werden sie nie angezeigt.'
            ]
        },
        {
            title: 'Tische & Layouts', img: 'help/raumleiste.webp',
            text: 'Die Leiste über dem Raum:',
            points: [
                '„Layouts“: Reihen, Zweier, Vierer, U-Form, Prüfung … und eigene Vorlagen („+ Aktuelles Layout als Vorlage übernehmen“).',
                '„+“ fügt einen Tisch hinzu. Tische lassen sich frei verschieben und rasten am Punkteraster ein.',
                'Pinsel: löst Kinder von den Tischen – den angewählten Tisch, sonst „Alle“ oder „Einzelne …“ (mehrere Tische antippen, dann bestätigen). Die Tische bleiben stehen.',
                'Papierkorb: löscht den angewählten Tisch, sonst „Alle“ oder „Einzelne …“. Immer mit Rückfrage.',
                'A-B-Schalter: alphabetisch in Reihen sortieren – nochmal antippen stellt alles wieder her.',
                'Lupen, Einpassen und Präsentieren (Vollbild für den Beamer).'
            ]
        },
        {
            title: 'Datenschutz & Sicherung', icon: 'info',
            text: 'Alles bleibt auf diesem Gerät: kein Server, keine Cloud, keine automatische Gesichtserkennung.',
            points: [
                'Regelmäßig sichern: Menü ☰ → „Alle Klassen als Datei sichern“ (mit Notizen oder Fotos am besten mit Passwort).',
                'Am Ende des Schuljahres alle Klassen, Notizen, Fotos und Sicherungsdateien löschen.',
                'Tipp fürs iPad: Teilen → „Zum Home-Bildschirm“ – dann läuft PlanPad auch offline.'
            ]
        }
    ];

    const KEY_HELP = 'planpad.helpSeen';
    /** Beim allerersten Öffnen die Anleitung zeigen */
    function firstRunHelp() {
        let seen = null;
        try { seen = localStorage.getItem(KEY_HELP); } catch { return Promise.resolve(); }
        if (seen) return Promise.resolve();
        try { localStorage.setItem(KEY_HELP, new Date().toISOString()); } catch { /* egal */ }
        return openHelp(0);
    }

    function openHelp(start = 0) {
        let done;
        const closed = new Promise(r => { done = r; });
        let page = start;
        const layer = document.createElement('div');
        layer.className = 'pp-sheet-layer';
        const box = document.createElement('div');
        box.className = 'pp-sheet pp-help';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-label', 'So verwendest Du PlanPad');
        layer.appendChild(box);
        document.body.appendChild(layer);

        function render() {
            const p = HELP_PAGES[page];
            const last = page === HELP_PAGES.length - 1;
            box.innerHTML = `<div class="pp-help-head"><span class="pp-help-kicker">${icon('book')}So verwendest Du PlanPad</span><span class="pp-help-count">${page + 1}/${HELP_PAGES.length}</span></div>
                <h2 class="pp-sheet-title">${escapeHtml(p.title)}</h2>
                ${p.img ? `<div class="pp-help-shot${p.tall ? ' is-tall' : ''}"><img src="${p.img}" alt="Bildschirmfoto: ${escapeHtml(p.title)}" loading="lazy"></div>` : `<div class="pp-help-icon">${icon(p.icon || 'info')}</div>`}
                <p class="pp-sheet-text">${escapeHtml(p.text)}</p>
                <ul class="pp-help-points">${p.points.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
                <div class="pp-help-dots">${HELP_PAGES.map((_, i) => `<button type="button" class="pp-help-dot${i === page ? ' is-on' : ''}" data-page="${i}" aria-label="Seite ${i + 1}"></button>`).join('')}</div>
                <div class="pp-sheet-buttons">
                    <button type="button" class="pp-btn" data-act="close">Schließen</button>
                    <button type="button" class="pp-btn" data-act="prev" ${page === 0 ? 'disabled' : ''}>Zurück</button>
                    <button type="button" class="pp-btn pp-btn-primary" data-act="next">${last ? 'Fertig' : 'Weiter'}</button>
                </div>`;
            box.scrollTop = 0;
        }
        function go(i) { page = Math.max(0, Math.min(HELP_PAGES.length - 1, i)); render(); }
        function close() {
            document.removeEventListener('keydown', onKey, true);
            layer.classList.remove('is-open');
            setTimeout(() => { layer.remove(); done(); }, 220);
        }
        box.addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.dataset.page) go(Number(b.dataset.page));
            else if (b.dataset.act === 'close') close();
            else if (b.dataset.act === 'prev') go(page - 1);
            else if (b.dataset.act === 'next') { if (page === HELP_PAGES.length - 1) close(); else go(page + 1); }
        });
        // Wischen zwischen den Seiten
        let sx = null;
        box.addEventListener('pointerdown', e => { sx = e.clientX; });
        box.addEventListener('pointerup', e => {
            if (sx === null) return;
            const dx = e.clientX - sx;
            sx = null;
            if (Math.abs(dx) > 60 && !e.target.closest('button')) go(page + (dx < 0 ? 1 : -1));
        });
        const onKey = e => {
            if (e.key === 'Escape') { e.stopPropagation(); close(); }
            else if (e.key === 'ArrowRight') go(page + 1);
            else if (e.key === 'ArrowLeft') go(page - 1);
        };
        document.addEventListener('keydown', onKey, true);
        layer.addEventListener('click', e => { if (e.target === layer) close(); });
        render();
        requestAnimationFrame(() => layer.classList.add('is-open'));
        return closed;
    }
    document.querySelectorAll('[data-help]').forEach(b => b.addEventListener('click', () => openHelp(b.id === 'help-btn-notes' ? HELP_PAGES.findIndex(p => p.title === 'Notizen-Modus') : 0)));

    /* ==================================================
       Hilfe: Glühbirne oben + langes Drücken (> 1 s) auf Buttons und Dropdowns
       ================================================== */
    const TIPS = {
        'menu-btn': 'Menü: Klassen anlegen, importieren und sichern, Demoklasse, Drucken, Datenschutz.',
        'sidebar-btn': 'Seitenleiste ein- oder ausblenden – mehr Platz für den Raum.',
        'plan-btn': 'Klasse wechseln: Liste aller Klassen. Dort auch umbenennen und neue Klasse anlegen.',
        'seating-select': 'Sitzplan dieser Klasse wählen.',
        'seating-action': 'Sitzplan umbenennen oder löschen. Bei offenem Schloss: Änderungen übernehmen oder verwerfen.',
        'add-seating-btn': 'Weiteren Sitzplan für diese Klasse anlegen, z. B. für Gruppenarbeit oder Prüfungen.',
        'help-bulb': 'Hilfe: Tipp zum langen Drücken und Handbuch.',
        'undo-btn': 'Letzte Änderung rückgängig machen.',
        'redo-btn': 'Rückgängig gemachte Änderung wiederholen.',
        'save-btn': 'Diese Klasse als Datei sichern (optional mit Passwort). Der Punkt zeigt: seit der letzten Sicherung geändert.',
        'edit-names-btn': 'Namensliste bearbeiten – ein Kind pro Zeile als „Nachname, Vorname“.',
        'names-done-btn': 'Namensliste übernehmen.',
        'toggle-pills': 'Kärtchen aller Kinder ein- oder ausblenden. Kärtchen auf einen Tisch ziehen = Platz zuweisen.',
        'shuffle-btn': 'Mix: Kinder an den Tischen zufällig neu verteilen – Trennen und Koppeln werden beachtet. Ausgegraut, solange noch niemand an einem Tisch sitzt.',
        'demix-btn': 'Demix: Sitzordnung vor dem letzten Mix wiederherstellen.',
        'class-photo': 'Klassenfoto aufnehmen oder wählen und die Gesichter den Kindern zuordnen – alles nur auf diesem Gerät.',
        'learn-names': 'Namen lernen: Quiz mit den Fotos der Klasse. Der Rekord steht auf dem Button.',
        'separate-students': 'Trennen: Kinder wählen, die nicht nebeneinander, hintereinander oder schräg sitzen sollen.',
        'couple-students': 'Koppeln: Kinder wählen, die am selben Tisch bzw. Gruppentisch sitzen sollen.',
        'cancel-selection': 'Auswahl abbrechen.',
        'finish-separation': 'Regel speichern.',
        'fix-conflicts': 'Verletzte Regeln automatisch lösen – mit möglichst wenig Umsetzen.',
        'layout-btn': 'Layouts: Tische in Reihen, Paaren, Gruppen, U-Form oder Prüfungsform aufstellen; eigene Vorlagen speichern.',
        'add-square': 'Neuen Tisch in den Raum stellen.',
        'absent-btn': 'Wer fehlt heute? Tische der fehlenden Kinder antippen. Sie werden grau mit Kreuz. Fehlzeiten stehen beim Kind und in der Statistik.',
        'arrive-btn': 'Kind kommt in den Raum: Tisch antippen. Stand es auf „fehlt“, rechnet PlanPad die Verspätung aus (auf 5 Minuten aufgerundet), sonst nur „zu spät“.',
        'clear-seats': 'Pinsel: Kinder von den Tischen lösen – alle oder einzelne. Ist ein Tisch gewählt, nur diesen.',
        'clear-tables': 'Papierkorb: Tische löschen – alle oder einzelne. Ist ein Tisch gewählt, nur diesen.',
        'distribute': 'A–B: Tische in Reihen nach Nachnamen sortieren, Namen zweizeilig. Nochmal tippen: alles wie vorher.',
        'view-groups': 'Gruppen-Ansicht: Namen, Plätze, Mix und Regeln bearbeiten.',
        'view-notes': 'Notizen-Ansicht: Tisch antippen und Notiz, Note und Sterne eintragen.',
        'zoom-out': 'Raum verkleinern.',
        'zoom-in': 'Raum vergrößern.',
        'zoom-fit': 'Ganzen Raum einpassen. Die Zahl zeigt die aktuelle Größe.',
        'present-btn': 'Präsentieren: Sitzplan bildschirmfüllend für die Klasse – ohne Notizen, Augen und Punkte.',
        'present-exit': 'Präsentieren beenden.',
        'drawer-close': 'Menü schließen.',
        'new-plan-btn': 'Neue, leere Klasse anlegen.',
        'new-plan-csv-btn': 'Klasse aus einer Excel- oder CSV-Liste anlegen, z. B. aus dem Infoportal.',
        'duplicate-plan-btn': 'Kopie dieser Klasse anlegen.',
        'demo-btn': 'Demoklasse laden: zeigt mit 15 Pixel-Kindern, was PlanPad kann.',
        'import': 'Sicherungsdatei (.json) öffnen und die Klassen übernehmen.',
        'export-current': 'Geöffnete Klasse als Datei sichern.',
        'export': 'Alle Klassen in einer Datei sichern.',
        'delete-all-btn': 'Alle Daten von diesem Gerät löschen, z. B. am Schuljahresende.',
        'clear-faces': 'Alle Fotos dieser Klasse löschen.',
        'print-btn': 'Sitzplan drucken oder als PDF sichern.',
        'obs-btn': 'Beobachten: Wer wird gerade beobachtet und wie lange noch? Dort auch neue Beobachtungen planen.',
        'note-eye': 'Dieses Kind wird gerade beobachtet. Antippen: bis wann.',
        'stats-btn': 'Statistik: Beobachtungen, Noten und Sterne je Kind – Zeile antippen für Details und Verlauf.',
        'add-cat': 'Eigene Sterne-Kategorie anlegen – für diese Klasse oder alle.',
        'class-note-add': 'Notiz zur ganzen Klasse anlegen, z. B. Stoff, Hausaufgabe, Termin.',
        'mark-all-read': 'Alle neuen Notizen als gelesen abhaken.'
    };
    let tipBox = null;
    function closeTip() {
        if (!tipBox) return;
        tipBox.remove();
        tipBox = null;
    }
    function tipLabel(el) {
        const t = (el.getAttribute('aria-label') || '').trim() || (el.tagName === 'SELECT' ? '' : el.textContent.replace(/\s+/g, ' ').trim()) || (el.title || '').trim();
        return t.length > 60 ? t.slice(0, 57) + '…' : t;
    }
    function showTip(anchor, { title = '', text = '', extra = null } = {}) {
        closeTip();
        const box = document.createElement('div');
        box.className = 'pp-tip';
        box.setAttribute('role', 'tooltip');
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'pp-tip-close';
        x.setAttribute('aria-label', 'Hinweis schließen');
        x.innerHTML = icon('close');
        x.addEventListener('click', closeTip);
        box.appendChild(x);
        if (title) { const b = document.createElement('b'); b.textContent = title; box.appendChild(b); }
        if (text) { const p = document.createElement('p'); p.textContent = text; box.appendChild(p); }
        if (extra) box.appendChild(extra);
        document.body.appendChild(box);
        const r = anchor.getBoundingClientRect();
        const w = box.offsetWidth, h = box.offsetHeight;
        const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8));
        const below = r.bottom + 8 + h < window.innerHeight - 8;
        box.style.left = `${left}px`;
        box.style.top = `${below ? r.bottom + 8 : Math.max(8, r.top - h - 8)}px`;
        box.classList.add(below ? 'is-below' : 'is-above');
        box.style.setProperty('--arrow', `${Math.max(14, Math.min(w - 14, r.left + r.width / 2 - left))}px`);
        tipBox = box;
    }
    function helpTipFor(el) {
        const title = tipLabel(el);
        let text = TIPS[el.id] || el.dataset.tip || '';
        if (!text && el.title && el.title.trim() !== title) text = el.title.trim();
        if (!text && !title) text = 'Für diesen Button gibt es keine Beschreibung.';
        return { title: title || 'Button', text };
    }
    // Glühbirne: Hinweis + Handbuch
    on('help-bulb', 'click', () => {
        if (tipBox && tipBox.dataset.bulb) { closeTip(); return; }
        const extra = document.createElement('button');
        extra.type = 'button';
        extra.className = 'pp-tip-link';
        extra.id = 'open-manual';
        extra.innerHTML = `${icon('book')}<span>Handbuch öffnen</span>`;
        extra.addEventListener('click', () => {
            closeTip();
            openHelp(notesViewActive() ? Math.max(0, HELP_PAGES.findIndex(p => p.title === 'Notizen-Modus')) : 0);
        });
        showTip($('help-bulb'), { title: 'Hilfe zu jedem Button', text: 'Lege den Finger länger als 1 Sekunde auf einen Button oder ein Auswahlmenü – dann erscheint eine kurze Erklärung.', extra });
        tipBox.dataset.bulb = '1';
    });
    // langes Drücken
    {
        let timer = null, start = null, target = null, fired = false;
        const HOLD = 1000;
        const cancel = () => { clearTimeout(timer); timer = null; target = null; };
        document.addEventListener('pointerdown', e => {
            if (tipBox && !tipBox.contains(e.target)) closeTip();
            const el = e.target.closest && e.target.closest('button, select');
            if (!el || el.closest('.pp-tip') || el.disabled && el.tagName === 'SELECT') return;
            fired = false;
            target = el;
            start = { x: e.clientX, y: e.clientY };
            clearTimeout(timer);
            timer = setTimeout(() => {
                if (!target) return;
                fired = true;
                if (target.tagName === 'SELECT') target.blur();
                showTip(target, helpTipFor(target));
                if (navigator.vibrate) { try { navigator.vibrate(12); } catch { /* egal */ } }
                timer = null;
            }, HOLD);
        }, true);
        document.addEventListener('pointermove', e => {
            if (timer && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel();
        }, true);
        document.addEventListener('pointerup', cancel, true);
        document.addEventListener('pointercancel', cancel, true);
        // der Klick nach dem langen Drücken löst den Button NICHT aus
        document.addEventListener('click', e => {
            if (!fired) return;
            const el = e.target.closest && e.target.closest('button, select');
            if (el && !el.closest('.pp-tip')) { e.preventDefault(); e.stopPropagation(); }
            fired = false;
        }, true);
        document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('button, select')) e.preventDefault(); }, true);
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTip(); });
        window.addEventListener('resize', closeTip);
    }

    /* ==================================================
       Namen lernen: Foto zeigen, aus 4 Namen den richtigen wählen (nur lokal)
       ================================================== */
    const KEY_LEARN = 'planpad.learn';     // { Klassen-ID: bestes Ergebnis }
    function readLearn() {
        try { const v = JSON.parse(localStorage.getItem(KEY_LEARN) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
    }
    /** Kinder der Klasse, für die es ein Foto gibt */
    function photographed() { return students.filter(n => faces.has(n)); }

    function renderLearnButton() {
        const btn = $('learn-names');
        const score = $('learn-score');
        if (!btn) return;
        const withPhoto = photographed();
        const can = withPhoto.length > 0 && students.length >= 2;
        btn.disabled = !can;
        btn.title = can ? `Namen lernen: ${withPhoto.length} Gesichter – Rekord = meiste Gesichter ohne Fehler hintereinander` : 'Erst über „Gesichter zuordnen“ Fotos den Namen zuordnen';
        if (score) {
            const best = Math.min(Number(readLearn()[currentPlanId]) || 0, withPhoto.length);
            score.textContent = can ? `${best}/${withPhoto.length}` : '';
            score.classList.toggle('is-empty', !best);
        }
    }

    function saveLearnBest(n) {
        const all = readLearn();
        if (n <= (Number(all[currentPlanId]) || 0)) return false;
        all[currentPlanId] = n;
        try { localStorage.setItem(KEY_LEARN, JSON.stringify(all)); } catch { /* egal */ }
        return true;
    }

    on('learn-names', 'click', startNameQuiz);

    function startNameQuiz() {
        const pool = photographed();
        if (!pool.length || students.length < 2) return;
        const total = pool.length;
        // Wertung: Serie ohne Fehler. Jeder Durchgang zeigt jedes Gesicht genau einmal;
        // ein Fehler setzt die Serie auf 0 und startet einen neuen Durchgang.
        let streak = 0;
        let sessionBest = 0;
        let queue = [];
        let current = null;
        let timer = null;
        const bestBefore = Math.min(Number(readLearn()[currentPlanId]) || 0, total);

        const layer = document.createElement('div');
        layer.className = 'pp-sheet-layer';
        const box = document.createElement('div');
        box.className = 'pp-sheet pp-quiz';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.innerHTML = `<div class="pp-quiz-head"><h2>Namen lernen</h2><div class="pp-quiz-score" aria-live="polite"><span class="pp-quiz-now">0/${total}</span><small>Rekord ${bestBefore}/${total}</small></div></div>
            <img class="pp-quiz-photo" alt="Wer ist das?">
            <div class="pp-quiz-choices"></div>
            <p class="pp-quiz-msg"></p>
            <div class="pp-sheet-buttons"><button type="button" class="pp-btn pp-btn-primary pp-quiz-done">Fertig</button></div>`;
        layer.appendChild(box);
        document.body.appendChild(layer);
        const img = box.querySelector('.pp-quiz-photo');
        const choicesEl = box.querySelector('.pp-quiz-choices');
        const msg = box.querySelector('.pp-quiz-msg');
        const scoreEl = box.querySelector('.pp-quiz-now');
        const bestEl = box.querySelector('.pp-quiz-score small');

        const mix = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

        function next() {
            clearTimeout(timer);
            box.classList.remove('is-answered');
            if (!queue.length) {                 // neuer Durchgang
                if (streak >= total) { streak = 0; scoreEl.textContent = `0/${total}`; }
                queue = mix(pool);
                if (queue.length > 1 && queue[0] === current) queue.push(queue.shift());
            }
            current = queue.shift();
            img.src = faces.get(current);
            const others = mix(students.filter(n => n !== current)).slice(0, Math.min(3, students.length - 1));
            choicesEl.textContent = '';
            mix([current, ...others]).forEach(name => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'pp-quiz-choice';
                b.textContent = name;
                b.addEventListener('click', () => answer(b, name));
                choicesEl.appendChild(b);
            });
        }

        function answer(btn, name) {
            if (box.classList.contains('is-answered')) return;
            box.classList.add('is-answered');
            if (name === current) {
                btn.classList.add('is-right');
                streak++;
                sessionBest = Math.max(sessionBest, streak);
                scoreEl.textContent = `${streak}/${total}`;
                const record = saveLearnBest(streak);
                if (record) bestEl.textContent = `Rekord ${streak}/${total}`;
                msg.textContent = streak === total ? `Alle ${total} ohne Fehler erkannt! 🎉 Weiter geht es mit einem neuen Durchgang.` : 'Richtig!';
                timer = setTimeout(next, streak === total ? 2200 : 700);
            } else {
                btn.classList.add('is-wrong');
                choicesEl.querySelectorAll('.pp-quiz-choice').forEach(b => { if (b.textContent === current) b.classList.add('is-right'); });
                msg.textContent = `Das ist ${current}. Die Serie beginnt von vorne.`;
                streak = 0;
                scoreEl.textContent = `0/${total}`;
                box.classList.add('is-reset');
                setTimeout(() => box.classList.remove('is-reset'), 600);
                // neuer Durchgang mit allen Gesichtern – das verwechselte kommt bald nochmal
                const missed = current;
                queue = mix(pool.filter(n => n !== missed));
                queue.splice(Math.min(2, queue.length), 0, missed);
                timer = setTimeout(next, 1700);
            }
        }

        function finish() {
            clearTimeout(timer);
            document.removeEventListener('keydown', onKey, true);
            layer.classList.remove('is-open');
            setTimeout(() => layer.remove(), 220);
            renderLearnButton();
            const n = sessionBest;
            if (n > bestBefore) showToast(`${n}/${total} ohne Fehler – neuer Rekord!`, 'ok', 3000);
            else showToast(`Beste Serie: ${n}/${total} (Rekord: ${bestBefore}/${total}).`, 'info', 3000);
        }
        const onKey = e => {
            if (e.key === 'Escape') { e.stopPropagation(); finish(); return; }
            const k = Number(e.key);
            if (k >= 1 && k <= 4) { const b = choicesEl.children[k - 1]; if (b) b.click(); }
        };
        document.addEventListener('keydown', onKey, true);
        layer.addEventListener('click', e => { if (e.target === layer) finish(); });
        box.querySelector('.pp-quiz-done').addEventListener('click', finish);
        next();
        requestAnimationFrame(() => layer.classList.add('is-open'));
    }

    /**
     * „Plätze anlegen oder verteilen“: Kinder ohne Platz auf freie Tische setzen. Reichen die Tische nicht,
     * wird je Kind ein Tisch angelegt und alles nach dem gewählten Layout neu aufgestellt.
     */
    function seatRemaining() {
        const open = unseatedStudents().sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
        if (!open.length) return;
        setActiveTable(null);
        const free = () => squares.filter(sq => !sq.dataset.student).length;
        const missing = Math.max(0, open.length - free());
        for (let i = 0; i < missing; i++) {
            const p = findFreePosition();
            createSquare(p.x, p.y);
        }
        const tpl = currentLayout && currentLayout.startsWith('tpl:') ? findTemplate(currentLayout) : null;
        const layoutKnown = Boolean(currentLayout && (LAYOUTS[currentLayout] || tpl));
        if (missing && layoutKnown) applyLayout(currentLayout);
        const empties = readingOrder().filter(sq => !sq.dataset.student);
        open.forEach((name, i) => { if (empties[i]) setSeat(empties[i], name); });
        refreshMarks();
        scheduleResize();
        changed();
        showWholePlan();
        const info = LAYOUT_INFO.find(x => x.id === currentLayout);
        const layoutName = info ? info.name : tpl ? tpl.name : '';
        showToast(`${countText(open.length, 'Kind sitzt', 'Kinder sitzen')} jetzt an einem Tisch`
            + (missing ? ` – ${countText(missing, 'Tisch', 'Tische')} neu angelegt${layoutKnown ? ` (Layout „${layoutName}“)` : ''}.` : '.'), 'ok', 3500);
    }

    /** Alle Kärtchen der Klasse (alphabetisch nach Vornamen) ein-/ausblenden */
    function renderAllPills() {
        const box = $('all-pills');
        const btn = $('toggle-pills');
        if (!box || !btn) return;
        const seatedNames = new Set(squares.map(sq => sq.dataset.student).filter(Boolean));
        const anyOpen = students.some(n => !seatedNames.has(n));
        // ändert sich, wer keinen Platz hat, gilt wieder „automatisch“
        const key = students.filter(n => !seatedNames.has(n)).join('\u0000');
        if (key !== lastPillsKey) { lastPillsKey = key; pillsPref = null; }
        btn.hidden = !students.length;
        const open = students.length > 0 && (pillsPref === null ? anyOpen : pillsPref);
        btn.textContent = open ? 'Kärtchen ausblenden …' : 'Kärtchen einblenden …';
        btn.setAttribute('aria-expanded', String(open));
        box.hidden = !open;
        box.textContent = '';
        if (!open) return;
        const seated = new Set(squares.map(sq => sq.dataset.student).filter(Boolean));
        students.slice().sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' })).forEach(name => {
            const item = makePill(name, 'student-item');
            item.classList.toggle('is-seated', seated.has(name));
            item.title = seated.has(name) ? `${name} sitzt schon – auf einen anderen Tisch ziehen zum Tauschen` : `${name} hat noch keinen Platz`;
            attachStudentHandlers(item, name);
            box.appendChild(item);
        });
    }
    on('toggle-pills', 'click', () => {
        pillsPref = $('toggle-pills').getAttribute('aria-expanded') !== 'true';
        renderAllPills();
    });

    /** Markierungen aktualisieren (sitzt schon / ausgewählt). */
    function refreshMarks() {
        // Ablage aktuell halten: hat sich die Menge der Kinder ohne Platz geändert?
        const key = unseatedStudents().join('\u0000') + '|' + students.length;
        if (key !== trayKey) { renderStudentList(); return; }
        const seated = new Set(squares.map(sq => sq.dataset.student).filter(Boolean));
        const selected = new Set(currentSelection);
        document.querySelectorAll('.input-area .student-item, #all-pills .student-item').forEach(item => {
            const n = item.dataset.name;
            item.classList.toggle('is-seated', seated.has(n));
            item.classList.toggle('selected-for-separation', selected.has(n));
        });
        const planNotes = notesOfPlan(currentPlanId);
        squares.forEach(sq => {
            sq.classList.toggle('selected-for-separation', selected.has(sq.dataset.student));
            sq.classList.toggle('is-noting', notesViewActive() && Boolean(noteStudent) && sq.dataset.student === noteStudent);
            sq.classList.toggle('has-notes', Boolean(sq.dataset.student) && (planNotes[sq.dataset.student] || []).some(n => n.unread));
        });
        const hint = $('drag-hint');
        if (hint) hint.hidden = !students.length || students.every(n => seated.has(n));
        const mixHint = $('tray-mix-hint');
        if (mixHint) mixHint.hidden = !students.length || seated.size > 0;
        const swapHint = $('swap-hint');
        if (swapHint) swapHint.hidden = seated.size < 2;
        renderTrash();
    }

    /** Namens-Kärtchen, bei vorhandenem Foto mit kleinem Gesicht */
    function makePill(name, className) {
        const item = document.createElement('div');
        item.className = className;
        item.dataset.name = name;
        const url = faces.get(name);
        if (url) {
            const img = document.createElement('img');
            img.className = 'pill-face';
            img.src = url;
            img.alt = '';
            item.appendChild(img);
        }
        item.appendChild(document.createTextNode(name));
        return item;
    }

    /**
     * Ziehen eines Kärtchens mit Maus, Stift oder Finger.
     * opts: canStart(), makeGhost(), onHover(x, y), onDrop(x, y), onEnd()
     */
    function enablePillDrag(item, opts) {
        item.addEventListener('pointerdown', e => {
            if (e.button !== 0 || (opts.canStart && !opts.canStart())) return;
            e.preventDefault();
            if (item.setPointerCapture) item.setPointerCapture(e.pointerId);

            const startX = e.clientX;
            const startY = e.clientY;
            let ghost = null;

            const onMove = ev => {
                if (!ghost) {
                    if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
                    ghost = opts.makeGhost();
                    document.body.appendChild(ghost);
                    item.classList.add('is-dragging');
                }
                ghost.style.left = `${ev.clientX}px`;
                ghost.style.top = `${ev.clientY}px`;
                if (opts.onHover) opts.onHover(ev.clientX, ev.clientY);
            };
            const onEnd = ev => {
                item.removeEventListener('pointermove', onMove);
                item.removeEventListener('pointerup', onEnd);
                item.removeEventListener('pointercancel', onEnd);
                if (!ghost) return;
                ghost.remove();
                item.classList.remove('is-dragging');
                // Klick nach dem Ziehen unterdrücken
                item.dataset.justDragged = '1';
                setTimeout(() => { delete item.dataset.justDragged; }, 60);
                if (opts.onEnd) opts.onEnd();
                if (ev.type === 'pointerup') opts.onDrop(ev.clientX, ev.clientY);
            };
            item.addEventListener('pointermove', onMove);
            item.addEventListener('pointerup', onEnd);
            item.addEventListener('pointercancel', onEnd);
        });
    }

    function textGhost(name) {
        const g = document.createElement('div');
        g.className = 'drag-ghost';
        g.textContent = name;
        return g;
    }

    function attachStudentHandlers(item, name) {
        item.addEventListener('click', () => {
            if (item.dataset.justDragged) return;
            if (selecting) toggleSelection(name);
            else openStudentSheet(name);
        });
        let target = null;
        enablePillDrag(item, {
            canStart: () => !selecting,
            makeGhost: () => textGhost(name),
            onHover: (x, y) => {
                const t = squareAt(x, y);
                if (t === target) return;
                if (target) target.classList.remove('drop-highlight');
                target = t;
                if (target) target.classList.add('drop-highlight');
            },
            onEnd: () => {
                if (target) target.classList.remove('drop-highlight');
                target = null;
            },
            onDrop: (x, y) => {
                const t = squareAt(x, y);
                if (t) placeStudent(name, t);
            }
        });
    }

    function squareAt(x, y) {
        const el = document.elementFromPoint(x, y);
        const sq = el && el.closest ? el.closest('.square') : null;
        return sq && squares.includes(sq) ? sq : null;
    }

    function seatOf(name) {
        return squares.find(sq => sq.dataset.student === name) || null;
    }

    /** Setzt einen Schüler auf einen Tisch. Sitzt dort schon jemand, wird getauscht. */
    function placeStudent(name, target) {
        const from = seatOf(name);
        if (from === target) return;
        const displaced = target.dataset.student || '';
        if (from) setSeat(from, displaced);
        setSeat(target, name);
        refreshMarks();
        changed();

        const p = findProblems();
        const sep = p.sep.filter(pair => pair.includes(name));
        if (sep.length) {
            showToast(`${name} sitzt jetzt neben ${sep.map(pair => pair.find(n => n !== name)).join(', ')} (Trennen-Regel).`, 'warn', 4000);
        }
    }

    /* ==================================================
       Tische
       ================================================== */
    on('add-square', 'click', () => {
        const p = findFreePosition();
        createSquare(p.x, p.y);
        scheduleResize();
        changed();
    });

    const tableId = () => Math.random().toString(36).slice(2, 10);
    function createSquare(x, y, name = '', tid = '') {
        const div = document.createElement('div');
        div.className = 'square';
        div.dataset.tid = tid || tableId();      // feste Tisch-ID (für Demix)
        div.style.left = `${Math.round(x)}px`;
        div.style.top = `${Math.round(y)}px`;
        attachTableHandlers(div);
        classroom.appendChild(div);
        squares.push(div);
        setSeat(div, name);
        return div;
    }

    function removeSquare(sq) {
        if (sq === activeTable) setActiveTable(null);
        const i = squares.indexOf(sq);
        if (i >= 0) squares.splice(i, 1);
        sq.remove();
    }

    function removeAllSquares() {
        squares.slice().forEach(removeSquare);
    }

    // Während „A–B“ aktiv ist: Nachname (oben) und Vorname (unten) auf den Tischen
    function sortLabels() { const st = currentSeating(); return Boolean(st && st.orderBase); }
    function firstNameOf(name) {
        let n = String(name).replace(/ \(\d+\)$/, '');
        const last = lastNames[name];
        const m = last && n.match(/^(.+) (\S+?)\.?$/);
        if (m && last.toLocaleLowerCase('de').startsWith(m[2].toLocaleLowerCase('de'))) n = m[1];
        return n;
    }
    /** „Vorname Nachname“, wenn der Nachname bekannt ist – sonst der Anzeigename */
    function fullName(name) { return lastNames[name] ? `${firstNameOf(name)} ${lastNames[name]}` : name; }
    let labelMode = false;
    function refreshSeatLabels() {
        labelMode = sortLabels();
        document.querySelectorAll('.classroom .square').forEach(sq => { if (sq.dataset.student) setSeat(sq, sq.dataset.student); });
    }

    function setSeat(sq, name) {
        sq.dataset.student = name || '';
        sq.textContent = '';
        if (name) {
            const label = document.createElement('span');
            label.className = 'seat-name';
            const last = sortLabels() ? lastNames[name] : '';
            if (last) {
                label.classList.add('is-full');
                const l = document.createElement('span'); l.className = 'seat-last'; l.textContent = last;
                const f = document.createElement('span'); f.className = 'seat-first'; f.textContent = firstNameOf(name);
                label.append(l, f);
                label.title = `${firstNameOf(name)} ${last}`;
            } else {
                label.textContent = name;
            }
            sq.appendChild(label);
        }
        const watched = isObserved(name);
        sq.classList.toggle('is-observed', watched);
        if (watched) {
            const eye = document.createElement('span');
            eye.className = 'seat-eye';
            const left = obsProgress(name);
            eye.style.setProperty('--p', `${Math.round(left * 360)}deg`);
            eye.title = 'wird gerade beobachtet';
            eye.innerHTML = `<span class="seat-eye-in">${icon('eye')}</span>`;
            sq.appendChild(eye);
        }
        const today = name ? absenceToday(name) : null;
        sq.classList.toggle('is-absent', Boolean(today && !today.to));
        sq.classList.toggle('is-late', Boolean(today && today.to));
        if (today) {
            const badge = document.createElement('span');
            badge.className = 'seat-abs';
            badge.title = today.to ? lateText(today) : 'fehlt heute';
            badge.innerHTML = icon(today.to ? 'clock' : 'sick');
            sq.appendChild(badge);
        }
        sq.classList.toggle('has-student', Boolean(name));
        applyFace(sq);
    }

    /** Gesichtsfoto als Tisch-Hintergrund */
    function applyFace(sq) {
        const url = sq.dataset.student ? faces.get(sq.dataset.student) : null;
        sq.classList.toggle('has-photo', Boolean(url));
        sq.style.backgroundImage = url ? `url("${url}")` : '';
        sq.style.backgroundSize = url ? 'cover' : '';
        sq.style.backgroundPosition = url ? 'center' : '';
        sq.style.backgroundRepeat = url ? 'no-repeat' : '';
    }

    function ensureTables(n) {
        while (squares.length < n) {
            const p = findFreePosition();
            createSquare(p.x, p.y);
        }
    }

    function tableSize() {
        const s = squares[0];
        return { w: (s && s.offsetWidth) || 76, h: (s && s.offsetHeight) || 76 };
    }

    /* ----- Verschieben, antippen, doppelt antippen ----- */

    function attachTableHandlers(el) {
        el.addEventListener('pointerdown', e => {
            if (e.button !== 0) return;
            e.preventDefault();
            if (el.setPointerCapture) el.setPointerCapture(e.pointerId);

            const startX = e.clientX;
            const startY = e.clientY;
            const origX = el.offsetLeft;
            const origY = el.offsetTop;
            let moved = false;

            const onMove = ev => {
                if (pinching) return;
                const dx = (ev.clientX - startX) / zoom;
                const dy = (ev.clientY - startY) / zoom;
                if (!moved && Math.hypot(dx * zoom, dy * zoom) > 6) {
                    moved = true;
                    el.classList.add('is-dragging');
                }
                if (moved) {
                    el.style.left = `${Math.max(0, origX + dx)}px`;
                    el.style.top = `${Math.max(0, origY + dy)}px`;
                }
            };
            const onEnd = ev => {
                el.removeEventListener('pointermove', onMove);
                el.removeEventListener('pointerup', onEnd);
                el.removeEventListener('pointercancel', onEnd);
                if (moved) {
                    el.classList.remove('is-dragging');
                    // am Punkteraster einrasten
                    el.style.left = `${snap(el.offsetLeft)}px`;
                    el.style.top = `${snap(el.offsetTop)}px`;
                    scheduleResize();
                    changed();
                } else if (ev.type === 'pointerup' && !pinching) {
                    onTableTap(el);
                }
            };
            el.addEventListener('pointermove', onMove);
            el.addEventListener('pointerup', onEnd);
            el.addEventListener('pointercancel', onEnd);
        });
    }

    /* ----- Tisch antippen: markieren, tauschen, entfernen ----- */
    let activeTable = null;
    let activateHints = 0;

    let activeTimer = null;
    function setActiveTable(el) {
        clearTimeout(activeTimer);
        if (activeTable) activeTable.classList.remove('is-active');
        activeTable = el && squares.includes(el) ? el : null;
        if (activeTable) {
            activeTable.classList.add('is-active');
            // ohne zweiten Tipp nach 2 Sekunden wieder lösen
            activeTimer = setTimeout(() => setActiveTable(null), 2000);
        }
        renderTrash();
    }

    function renderTrash() {
        const trash = $('clear-tables');
        if (!trash) return;
        const sel = paneViewReady ? selectedTable() : activeTable;
        const label = sel ? 'Angewählten Tisch löschen' : 'Alle Tische löschen';
        trash.title = label;
        trash.setAttribute('aria-label', label);
        trash.classList.toggle('is-armed', Boolean(sel));
        const brush = $('clear-seats');
        if (brush) {
            const who = sel && sel.dataset.student;
            const bl = who ? `${who} vom Tisch lösen` : 'Schüler:innen von Tischen lösen (alle oder einzelne)';
            brush.title = bl;
            brush.setAttribute('aria-label', bl);
            brush.classList.toggle('is-armed', Boolean(who));
        }
    }

    function onTableTap(el) {
        if (picking) { togglePick(el); return; }
        if (selecting) {
            if (el.dataset.student) toggleSelection(el.dataset.student);
            return;
        }
        // Notizansicht: Tipp wählt die Person für Notizen (beim Präsentieren nie – keine Noten am Beamer)
        if (notesViewActive() && !app.classList.contains('presenting')) {
            if (el.dataset.student) {
                setActiveTable(null);
                if (app.classList.contains('sidebar-collapsed')) setSidebar(true);
                selectNoteStudent(el.dataset.student);
            } else {
                // leerer Tisch: zum Löschen markieren (Papierkorb)
                selectNoteStudent(null);
                setActiveTable(activeTable === el ? null : el);
            }
            return;
        }
        if (!activeTable) {
            setActiveTable(el);
            if (activateHints < 2) {
                activateHints++;
                showToast('Innerhalb von 2 Sekunden einen zweiten Tisch antippen, um zu tauschen – oder Pinsel (Kind lösen) bzw. Papierkorb (Tisch löschen).', 'info', 3500);
            }
            return;
        }
        if (activeTable === el) {          // nochmal antippen = Markierung aufheben
            setActiveTable(null);
            return;
        }
        // Inhalt der beiden Tische tauschen
        const first = activeTable;
        const a = first.dataset.student || '';
        const b = el.dataset.student || '';
        setActiveTable(null);
        if (!a && !b) return;
        setSeat(first, b);
        setSeat(el, a);
        [first, el].forEach(sq => flashMoved(sq, 500));
        refreshMarks();
        changed();
        const p = findProblems();
        const moved = [a, b].filter(Boolean);
        const sep = p.sep.filter(pair => moved.some(n => pair.includes(n)));
        if (sep.length) showToast(`Achtung: ${sep.map(pair => pair.join(' und ')).join(', ')} sitzen jetzt nebeneinander (Trennen-Regel).`, 'warn', 4000);
    }

    // Tippen auf eine freie Stelle im Raum hebt die Markierung auf –
    // in der Notizansicht wird auch der/die gewählte Schüler:in abgewählt (nicht beim Verschieben/Zoomen).
    let emptyTap = null;
    roomScroll.addEventListener('pointerdown', e => {
        if (e.target.closest('.square')) { emptyTap = null; return; }
        setActiveTable(null);
        emptyTap = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    roomScroll.addEventListener('pointerup', e => {
        const t = emptyTap;
        emptyTap = null;
        if (!t || t.id !== e.pointerId || pinching) return;
        if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) return;
        if (e.target.closest('.square')) return;
        if (notesViewActive() && noteStudent) selectNoteStudent(null);
    });
    roomScroll.addEventListener('pointercancel', () => { emptyTap = null; });

    function overlaps(x, y, ignore = null) {
        const { w, h } = tableSize();
        return squares.some(sq => {
            if (sq === ignore) return false;
            return x < sq.offsetLeft + w && x + w > sq.offsetLeft && y < sq.offsetTop + h && y + h > sq.offsetTop;
        });
    }

    function findFreePosition() {
        const { w, h } = tableSize();
        const stepX = Math.ceil((w + MARGIN) / GRID) * GRID;
        const stepY = Math.ceil((h + MARGIN) / GRID) * GRID;
        const width = Math.max(roomScroll.clientWidth / zoom, 4 * stepX + 2 * MARGIN);
        const cols = Math.max(1, Math.floor((width - MARGIN) / stepX));
        for (let r = 0; r < 500; r++) {
            for (let c = 0; c < cols; c++) {
                const x = MARGIN + c * stepX;
                const y = MARGIN + r * stepY;
                if (!overlaps(x, y)) return { x, y };
            }
        }
        return { x: MARGIN, y: MARGIN };
    }

    /* ==================================================
       Anordnungen
       ================================================== */
    const LAYOUTS = {
        rows: layoutRows, pairs: layoutPairs, groups: layoutGroups,
        uform: layoutU, ufilled: layoutUFilled, exam: layoutExam
    };
    const KEY_TEMPLATES = 'planpad.templates';
    const LAYOUT_INFO = [
        { id: 'rows', name: 'Reihen', desc: 'Einzeltische in Reihen', n: 18 },
        { id: 'pairs', name: 'Zweier', desc: 'Zweiertische in Reihen', n: 18 },
        { id: 'groups', name: 'Vierer', desc: 'Gruppentische 2 × 2', n: 16 },
        { id: 'uform', name: 'U-Form', desc: 'offen zur Lehrkraft', n: 14 },
        { id: 'ufilled', name: 'Gefülltes U', desc: 'U mit Zweiern innen', n: 26 },
        { id: 'exam', name: 'Prüfung', desc: 'Einzeltische mit Abstand', n: 16 }
    ];

    /** Kleine Vorschau, direkt aus der Vorlage berechnet */
    function layoutPreview(id, n) {
        const pos = id.startsWith('tpl:') ? (findTemplate(id) || { positions: [] }).positions : LAYOUTS[id](n, { w: 76, h: 76 }, 1000);
        return previewSVG(pos);
    }
    function previewSVG(pos) {
        if (!pos.length) pos = [{ x: 0, y: 0 }];
        const maxX = Math.max(...pos.map(p => p.x)) + 76;
        const maxY = Math.max(...pos.map(p => p.y)) + 76 + 60;
        const pad = 24;
        const rects = pos.map(p => `<rect x="${p.x}" y="${p.y}" width="76" height="76" rx="10"/>`).join('');
        const teacher = `<rect class="pp-prev-teacher" x="${maxX / 2 - 60}" y="${maxY - 30}" width="120" height="26" rx="5"/>`;
        return `<svg class="pp-layout-preview" viewBox="${-pad} ${-pad} ${maxX + 2 * pad} ${maxY + 2 * pad}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${rects}${teacher}</svg>`;
    }

    /* ----- Eigene Vorlagen (nur Tischpositionen, keine Namen – gelten für alle Pläne) ----- */
    function readTemplates() {
        try {
            const v = JSON.parse(localStorage.getItem(KEY_TEMPLATES) || '[]');
            return Array.isArray(v) ? v.filter(t => t && t.id && Array.isArray(t.positions) && t.positions.length) : [];
        } catch { return []; }
    }
    function writeTemplates(list) {
        try { localStorage.setItem(KEY_TEMPLATES, JSON.stringify(list)); return true; } catch (err) {
            console.error(err);
            ui.alert('Vorlage nicht gespeichert', 'Der Browserspeicher ist voll oder gesperrt.');
            return false;
        }
    }
    function findTemplate(layoutId) {
        const id = String(layoutId).replace(/^tpl:/, '');
        return readTemplates().find(t => t.id === id) || null;
    }
    /** Positionen einer eigenen Vorlage; fehlen Plätze, werden Tische unten angefügt */
    function templateLayout(tpl) {
        return (n, { w, h }, avail) => {
            const pos = tpl.positions.map(p => ({ x: p.x, y: p.y }))
                .sort((a, b) => (a.y - b.y) || (a.x - b.x));
            if (n <= pos.length) return pos.slice(0, n);
            const extra = n - pos.length;
            const width = Math.max(...pos.map(p => p.x)) + w;
            const y0 = Math.max(...pos.map(p => p.y)) + h + 2 * GRID + 4;   // eine Reihe Abstand
            const step = w + TIGHT;
            const per = Math.max(1, Math.floor((Math.max(width, avail * 0.6) + TIGHT) / step));
            for (let i = 0; i < extra; i++) {
                pos.push({ x: (i % per) * step, y: snap(y0) + Math.floor(i / per) * (h + ROW_GAP) });
            }
            return pos;
        };
    }

    async function saveAsTemplate() {
        closeLayoutMenu();
        if (!squares.length) {
            ui.alert('Noch keine Tische', 'Stelle zuerst die Tische so, wie die Vorlage aussehen soll.');
            return;
        }
        const list = readTemplates();
        const raw = await sheet({
            title: 'Als Vorlage übernehmen',
            text: `Das Layout der ${squares.length} Tische wird als eigene Vorlage gespeichert – ohne Namen, Fotos oder Notizen. Sie steht danach in allen Klassen zur Verfügung und bleibt auch erhalten, wenn am Schuljahresende alle Daten gelöscht werden.`,
            input: { label: 'Name der Vorlage', value: `Eigene Vorlage ${list.length + 1}` },
            buttons: [{ label: 'Abbrechen', value: null }, { label: 'Speichern', value: true, kind: 'primary' }]
        });
        const name = typeof raw === 'string' && raw ? raw : null;
        if (!name) return;
        const minX = Math.min(...squares.map(sq => sq.offsetLeft));
        const minY = Math.min(...squares.map(sq => sq.offsetTop));
        const positions = squares
            .map(sq => ({ x: snap(sq.offsetLeft - minX), y: snap(sq.offsetTop - minY) }))
            .sort((a, b) => (a.y - b.y) || (a.x - b.x));
        const tpl = { id: newId(), name, positions, created: new Date().toISOString() };
        if (!writeTemplates([tpl, ...list])) return;
        currentLayout = `tpl:${tpl.id}`;
        renderLayoutSwitch();
        changed();
        showToast(`Vorlage „${name}“ gespeichert – sie steht im Menü ganz oben.`, 'ok', 3500);
    }

    async function deleteTemplate(tpl) {
        if (!await ui.confirm('Vorlage löschen?', `Die eigene Vorlage „${tpl.name}“ wird gelöscht. Bestehende Sitzpläne bleiben unverändert.`, 'Löschen', true)) return;
        writeTemplates(readTemplates().filter(t => t.id !== tpl.id));
        if (currentLayout === `tpl:${tpl.id}`) currentLayout = '';
        renderLayoutSwitch();
        renderLayoutMenu();
    }

    const layoutMenu = $('layout-menu');
    const layoutBtn = $('layout-btn');

    function layoutItem(id, name, desc, previewHtml) {
        const b = document.createElement('button');
        b.className = 'pp-layout-item';
        b.id = id.startsWith('tpl:') ? `layout-${id.slice(4)}` : id;
        b.dataset.layout = id;
        b.setAttribute('role', 'menuitemradio');
        b.innerHTML = previewHtml
            + `<span class="pp-layout-text"><span class="pp-layout-name">${escapeHtml(name)}</span><span class="pp-layout-desc">${escapeHtml(desc)}</span></span>`;
        b.addEventListener('click', () => { closeLayoutMenu(); applyLayout(id); });
        return b;
    }

    function renderLayoutMenu() {
        if (!layoutMenu) return;
        layoutMenu.textContent = '';
        // 1) „+ Aktuelle Anordnung als Vorlage übernehmen“
        const add = document.createElement('button');
        add.className = 'pp-layout-add';
        add.id = 'save-template-btn';
        add.innerHTML = `${icon('plus')}<span>Aktuelles Layout als Vorlage übernehmen</span>`;
        add.addEventListener('click', saveAsTemplate);
        layoutMenu.appendChild(add);
        // 2) eigene Vorlagen – immer zuerst
        const own = readTemplates();
        if (own.length) {
            const h = document.createElement('div');
            h.className = 'pp-layout-head';
            h.textContent = 'Eigene Vorlagen';
            layoutMenu.appendChild(h);
            own.forEach(t => {
                const wrap = document.createElement('div');
                wrap.className = 'pp-layout-own';
                wrap.appendChild(layoutItem(`tpl:${t.id}`, t.name, `${t.positions.length} Tische`, previewSVG(t.positions)));
                const del = document.createElement('button');
                del.className = 'pp-iconbtn pp-layout-del';
                del.setAttribute('aria-label', `Vorlage „${t.name}“ löschen`);
                del.title = 'Vorlage löschen';
                del.innerHTML = icon('close');
                del.addEventListener('click', e => { e.stopPropagation(); deleteTemplate(t); });
                wrap.appendChild(del);
                layoutMenu.appendChild(wrap);
            });
            const h2 = document.createElement('div');
            h2.className = 'pp-layout-head';
            h2.textContent = 'Vorlagen';
            layoutMenu.appendChild(h2);
        }
        // 3) eingebaute Vorlagen
        LAYOUT_INFO.forEach(info => layoutMenu.appendChild(layoutItem(info.id, info.name, info.desc, layoutPreview(info.id, info.n))));
        layoutMenu.querySelectorAll('.pp-layout-item').forEach(b =>
            b.setAttribute('aria-checked', String(b.dataset.layout === currentLayout)));
    }

    function openLayoutMenu() {
        if (!layoutMenu) return;
        renderLayoutMenu();
        layoutMenu.hidden = false;
        layoutBtn.setAttribute('aria-expanded', 'true');
        const cur = layoutMenu.querySelector('[aria-checked="true"]') || layoutMenu.firstElementChild;
        if (cur) cur.focus({ preventScroll: true });
    }
    function closeLayoutMenu() {
        if (!layoutMenu || layoutMenu.hidden) return;
        layoutMenu.hidden = true;
        layoutBtn.setAttribute('aria-expanded', 'false');
    }
    on('layout-btn', 'click', e => {
        e.stopPropagation();
        if (layoutMenu.hidden) openLayoutMenu(); else closeLayoutMenu();
    });
    document.addEventListener('pointerdown', e => {
        if (layoutMenu && !layoutMenu.hidden && !e.target.closest('.pp-layout-picker')) closeLayoutMenu();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLayoutMenu(); });

    function renderLayoutSwitch() {
        let name = null;
        let preview = null;
        if (currentLayout.startsWith('tpl:')) {
            const t = findTemplate(currentLayout);
            if (t) { name = t.name; preview = previewSVG(t.positions); }
        } else {
            const info = LAYOUT_INFO.find(i => i.id === currentLayout);
            if (info) { name = info.name; preview = layoutPreview(info.id, info.n); }
        }
        const label = $('layout-label');
        if (label) label.textContent = name || 'wählen';
        const prev = $('layout-btn-preview');
        if (prev) prev.innerHTML = preview ? preview.replace('class="pp-layout-preview"', 'class="pp-layout-preview" width="40" height="30"') : icon('grid');
        if (layoutMenu) layoutMenu.querySelectorAll('.pp-layout-item').forEach(b =>
            b.setAttribute('aria-checked', String(b.dataset.layout === currentLayout)));
    }

    function readingOrder() {
        const { h } = tableSize();
        return [...squares].sort((a, b) => {
            const dy = a.offsetTop - b.offsetTop;
            if (Math.abs(dy) > h / 2) return dy;
            return a.offsetLeft - b.offsetLeft;
        });
    }

    function applyLayout(id) {
        let layoutFn = LAYOUTS[id];
        let tpl = null;
        if (String(id).startsWith('tpl:')) {
            tpl = findTemplate(id);
            if (!tpl) { ui.alert('Vorlage nicht gefunden', 'Diese eigene Vorlage gibt es nicht mehr.'); return; }
            layoutFn = templateLayout(tpl);
            ensureTables(Math.max(students.length, tpl.positions.length));
        }
        if (!layoutFn) return;
        ensureTables(students.length);
        if (!squares.length) {
            ui.alert('Noch keine Tische', 'Gib zuerst die Namen ein oder lege mit „+“ Tische an.');
            return;
        }
        const size = tableSize();
        const ordered = readingOrder();
        let viewW = layoutViewWidth();
        const avail = Math.max(size.w, viewW - 2 * MARGIN);
        let positions = layoutFn(ordered.length, size, avail);
        // Beim Einpassen (v. a. iPhone hochkant): Anordnung so wählen, dass sie den sichtbaren
        // Raum möglichst groß ausfüllt – statt einer langen, schmalen Spalte am linken Rand
        if (fitMode && !tpl) {
            const W = roomScroll.clientWidth;
            const H = roomScroll.clientHeight;
            const fitOf = pos => {
                const lw = Math.max(...pos.map(q => q.x)) + size.w;
                const lh = Math.max(...pos.map(q => q.y)) + size.h;
                return { lw, z: Math.min(W / (lw + 2 * MARGIN), H / (lh + 2 * MARGIN + 70)) };
            };
            let best = { pos: positions, ...fitOf(positions) };
            if (W && H && best.z < 1) {
                for (let a = size.w; a <= 3200; a += GRID) {
                    const pos = layoutFn(ordered.length, size, a);
                    const f = fitOf(pos);
                    if (f.z > best.z + 0.005) best = { pos, ...f };
                }
                positions = best.pos;
                // in der Breite zentrieren, die beim Einpassen sichtbar ist
                viewW = Math.max(best.lw + 2 * MARGIN, W / Math.max(ZOOM_MIN, Math.min(1, best.z)));
            }
        }

        const layoutWidth = Math.max(...positions.map(p => p.x)) + size.w;
        const shiftX = Math.max(MARGIN, snap((viewW - layoutWidth) / 2));
        ordered.forEach((sq, i) => {
            sq.style.left = `${positions[i].x + shiftX}px`;
            sq.style.top = `${positions[i].y + MARGIN}px`;
        });
        currentLayout = id;
        renderLayoutSwitch();
        scheduleResize();
        changed();
        if (tpl && ordered.length > tpl.positions.length) {
            showToast(`Die Vorlage hat ${tpl.positions.length} Plätze – ${ordered.length - tpl.positions.length} Tische wurden unten angefügt.`, 'info', 4000);
        }
    }

    function splitEvenly(n, k) {
        const base = Math.floor(n / k);
        const extra = n % k;
        return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
    }

    /** Reihen aus Einzeltischen, die direkt aneinanderstehen */
    function layoutRows(n, { w, h }, avail) {
        const fit = Math.max(1, Math.floor((avail + TIGHT) / (w + TIGHT)));
        const cols = Math.max(1, Math.min(fit, Math.ceil(Math.sqrt(n * 1.5))));
        const rows = Math.ceil(n / cols);
        const pos = [];
        splitEvenly(n, rows).forEach((count, r) => {
            for (let c = 0; c < count; c++) pos.push({ x: c * (w + TIGHT), y: r * (h + ROW_GAP) });
        });
        return pos;
    }

    /** Zweiertische in Reihen, dazwischen Gänge */
    function layoutPairs(n, { w, h }, avail) {
        const pairs = Math.ceil(n / 2);
        const pairWidth = 2 * w + TIGHT;
        const fit = Math.max(1, Math.floor((avail + AISLE) / (pairWidth + AISLE)));
        const perRow = Math.min(fit, pairs <= 4 ? 2 : pairs <= 9 ? 3 : 4);
        const pos = [];
        for (let k = 0; k < n; k++) {
            const pair = Math.floor(k / 2);
            pos.push({
                x: (pair % perRow) * (pairWidth + AISLE) + (k % 2) * (w + TIGHT),
                y: Math.floor(pair / perRow) * (h + ROW_GAP)
            });
        }
        return pos;
    }

    /** Vierer-Gruppentische (2 × 2), gleichmäßig aufgeteilt */
    function layoutGroups(n, { w, h }, avail) {
        const groupCount = Math.ceil(n / 4);
        const blockW = 2 * w + TIGHT;
        const fit = Math.max(1, Math.floor((avail + AISLE) / (blockW + AISLE)));
        const perRow = Math.min(fit, groupCount <= 2 ? groupCount : groupCount <= 6 ? 3 : 4);
        const blockH = 2 * h + TIGHT;
        const pos = [];
        splitEvenly(n, groupCount).forEach((size, g) => {
            for (let p = 0; p < size; p++) {
                pos.push({
                    x: (g % perRow) * (blockW + AISLE) + (p % 2) * (w + TIGHT),
                    y: Math.floor(g / perRow) * (blockH + AISLE) + Math.floor(p / 2) * (h + TIGHT)
                });
            }
        });
        return pos;
    }

    /** U-Form, zur Lehrkraft (unten) hin offen */
    function layoutU(n, { w, h }, avail) {
        const stepX = w + TIGHT;
        let side = Math.max(0, Math.round((n - 2) / 3));
        let top = n - 2 * side;
        const maxTop = Math.max(2, Math.floor((avail + TIGHT) / stepX));
        if (top > maxTop) {          // zu breit: Seiten verlängern
            side = Math.ceil((n - maxTop) / 2);
            top = n - 2 * side;
        }
        const stepY = h + TIGHT;
        const pos = [];
        for (let r = side; r >= 1; r--) pos.push({ x: 0, y: r * stepY });
        for (let c = 0; c < top; c++) pos.push({ x: c * stepX, y: 0 });
        for (let r = 1; r <= side; r++) pos.push({ x: (top - 1) * stepX, y: r * stepY });
        return pos;
    }

    /** Prüfung: Einzeltische mit einem Feld Abstand – niemand sitzt direkt neben- oder hintereinander */
    function layoutExam(n, { w, h }, avail) {
        const stepX = w + AISLE;
        const stepY = h + AISLE;
        const fit = Math.max(1, Math.floor((avail + AISLE) / stepX));
        const cols = Math.max(1, Math.min(fit, Math.ceil(Math.sqrt(n * 1.4))));
        const rows = Math.ceil(n / cols);
        const pos = [];
        splitEvenly(n, rows).forEach((count, r) => {
            for (let c = 0; c < count; c++) pos.push({ x: c * stepX, y: r * stepY });
        });
        return pos;
    }

    /**
     * Grundgerüst für U-Varianten: sucht Breite T (Tische oben) und Seitenlänge S (Tische je Seite),
     * sodass außen + innen möglichst genau n Plätze ergeben.
     * inner(T, S) liefert die Innenplätze (in Füllreihenfolge) für diese Größe.
     */
    function uVariant(n, { w, h }, avail, inner) {
        const step = w + TIGHT;                 // 80
        const maxT = Math.max(4, Math.floor((avail + TIGHT) / step));
        let best = null;
        for (let T = 4; T <= 16; T++) {
            for (let S = 1; S <= 12; S++) {
                const outer = T + 2 * S;
                if (outer > n) continue;
                const innerPos = inner(T, S);
                const cap = outer + innerPos.length;
                if (cap < n) continue;
                const width = T * step;
                const height = (S + 1) * step;
                // breite, raumfüllende Form bevorzugen; wenige leere Innenplätze sind unproblematisch
                const score = (cap - n) + Math.abs(width / height - 1.35) * 12 + (T > maxT ? 100 : 0);
                if (!best || score < best.score) best = { T, S, innerPos, score };
            }
        }
        if (!best) return layoutU(n, { w, h }, avail);    // zu wenige Tische: normales U
        const { T, S, innerPos } = best;
        const pos = [];
        for (let c = 0; c < T; c++) pos.push({ x: c * step, y: 0 });       // Querreihe
        for (let r = 1; r <= S; r++) {                                       // Seiten
            pos.push({ x: 0, y: r * step });
            pos.push({ x: (T - 1) * step, y: r * step });
        }
        return pos.concat(innerPos.slice(0, n - pos.length));
    }

    /** Gefülltes U: außen ein U, innen Zweiertische in Reihen */
    function layoutUFilled(n, size, avail) {
        const { w, h } = size;
        const step = w + TIGHT;
        return uVariant(n, size, avail, (T, S) => {
            const left = w + AISLE;                              // 120
            const right = (T - 1) * step - AISLE;                // rechte Grenze
            const innerW = right - left;
            const pairW = 2 * w + TIGHT;                         // 156
            const per = Math.floor((innerW + AISLE) / (pairW + AISLE));
            if (per < 1) return [];
            const used = per * (pairW + AISLE) - AISLE;
            const x0 = left + snap((innerW - used) / 2);
            const out = [];
            for (let y = h + AISLE; y <= S * step; y += h + ROW_GAP) {
                for (let k = 0; k < per; k++) {
                    out.push({ x: x0 + k * (pairW + AISLE), y });
                    out.push({ x: x0 + k * (pairW + AISLE) + step, y });
                }
            }
            return out;
        });
    }

    /** Tische auf ein Raster einrasten, Doppelbelegungen auf den nächsten freien Platz */
    function alignToGrid() {
        if (!squares.length) return;
        const { w, h } = tableSize();
        const stepX = w + TIGHT;
        const stepY = h + TIGHT;
        const taken = new Set();
        const key = (c, r) => `${c},${r}`;
        readingOrder().forEach(sq => {
            const c0 = Math.max(0, Math.round((sq.offsetLeft - MARGIN) / stepX));
            const r0 = Math.max(0, Math.round((sq.offsetTop - MARGIN) / stepY));
            let best = null;
            for (let radius = 0; radius < 50 && !best; radius++) {
                let bestDist = Infinity;
                for (let dr = -radius; dr <= radius; dr++) {
                    for (let dc = -radius; dc <= radius; dc++) {
                        if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
                        const c = c0 + dc;
                        const r = r0 + dr;
                        if (c < 0 || r < 0 || taken.has(key(c, r))) continue;
                        const d = dc * dc + dr * dr;
                        if (d < bestDist) { bestDist = d; best = { c, r }; }
                    }
                }
            }
            taken.add(key(best.c, best.r));
            sq.style.left = `${MARGIN + best.c * stepX}px`;
            sq.style.top = `${MARGIN + best.r * stepY}px`;
        });
        scheduleResize();
        changed();
    }

    /* ----- Raumgröße & Zoom ----- */
    const roomSizer = $('room-sizer');
    const teacherEl = classroom.querySelector('.teacher');
    if (teacherEl) { teacherEl.innerHTML = BOARD_SVG; teacherEl.setAttribute('aria-label', 'Vorne: Pult der Lehrkraft'); teacherEl.setAttribute('role', 'img'); }
    const ZOOM_MIN = 0.4;
    const ZOOM_MAX = 3;
    const FIT_MIN = 0.2;            // Untergrenze beim Einpassen (ganzer Plan immer sichtbar, auch am iPhone)
    const KEY_VIEW = 'planpad.view';

    /** Breite, nach der sich Anordnungen richten (beim Einpassen: wie bei 100 %) */
    function layoutViewWidth() {
        return roomScroll.clientWidth / (fitMode ? 1 : zoom);
    }

    function contentBounds() {
        if (!squares.length) return null;
        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
        squares.forEach(sq => {
            minX = Math.min(minX, sq.offsetLeft);
            minY = Math.min(minY, sq.offsetTop);
            maxX = Math.max(maxX, sq.offsetLeft + sq.offsetWidth);
            maxY = Math.max(maxY, sq.offsetTop + sq.offsetHeight);
        });
        return { minX, minY, maxX, maxY };
    }

    let resizePending = false;
    function scheduleResize() {
        if (resizePending) return;
        resizePending = true;
        requestAnimationFrame(() => {
            resizePending = false;
            if (fitMode) fitToContent();
            else resizeClassroom();
        });
    }

    function resizeClassroom() {
        const W = roomScroll.clientWidth;
        const H = roomScroll.clientHeight;
        const b = contentBounds();
        // Platz unten für das Lehrerpult
        const w = Math.max(b ? b.maxX + MARGIN : 0, W / zoom);
        const h = Math.max(b ? b.maxY + MARGIN + 90 : 0, H / zoom);
        classroom.style.width = `${w}px`;
        classroom.style.height = `${h}px`;
        classroom.style.transform = zoom === 1 ? '' : `scale(${zoom})`;
        roomSizer.style.width = `${w * zoom}px`;
        roomSizer.style.height = `${h * zoom}px`;
        if (teacherEl) {
            if (b) {
                teacherEl.style.left = `${(b.minX + b.maxX) / 2}px`;
                teacherEl.style.top = `${b.maxY + 34}px`;
                teacherEl.style.bottom = 'auto';
            } else {
                teacherEl.style.left = teacherEl.style.top = teacherEl.style.bottom = '';
            }
        }
        renderZoom();
    }

    /** Sitzplan so groß wie möglich in den sichtbaren Bereich einpassen */
    function fitToContent() {
        const W = roomScroll.clientWidth;
        const H = roomScroll.clientHeight;
        const b = contentBounds();
        if (!b || !W || !H) { zoom = 1; resizeClassroom(); return; }
        const bw = b.maxX - b.minX + 2 * MARGIN;
        const bh = b.maxY - b.minY + 2 * MARGIN + 70;
        zoom = Math.max(FIT_MIN, Math.min(ZOOM_MAX, W / bw, H / bh));   // Einpassen darf kleiner werden als von Hand
        resizeClassroom();
        roomScroll.scrollLeft = Math.max(0, (b.minX - MARGIN) * zoom - (W - bw * zoom) / 2);
        roomScroll.scrollTop = Math.max(0, (b.minY - MARGIN) * zoom - (H - bh * zoom) / 2);
    }

    /** Zoomen um einen Punkt (Bildschirmkoordinaten relativ zum Raum) */
    function setZoom(z, ax = roomScroll.clientWidth / 2, ay = roomScroll.clientHeight / 2) {
        const old = zoom;
        const lx = (roomScroll.scrollLeft + ax) / old;
        const ly = (roomScroll.scrollTop + ay) / old;
        zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
        fitMode = false;
        resizeClassroom();
        roomScroll.scrollLeft = lx * zoom - ax;
        roomScroll.scrollTop = ly * zoom - ay;
        saveView();
    }

    function renderZoom() {
        const label = $('zoom-label');
        if (label) label.textContent = `${Math.round(zoom * 100)} %`;
        const fit = $('zoom-fit');
        if (fit) fit.setAttribute('aria-pressed', String(fitMode));
    }

    function saveView() {
        try { localStorage.setItem(KEY_VIEW, JSON.stringify({ zoom, fitMode, sidebar: !app.classList.contains('sidebar-collapsed') })); } catch { /* egal */ }
    }

    /**
     * Nach dem Öffnen einer Klasse oder eines Sitzplans: einmal „Einpassen“ auslösen,
     * damit der ganze Sitzplan sichtbar ist (zweiter Durchlauf, falls das Layout noch nachrückt).
     */
    let showAllTimer = null;
    function showWholePlan() {
        fitMode = true;
        renderZoom();
        requestAnimationFrame(() => requestAnimationFrame(fitToContent));
        clearTimeout(showAllTimer);
        showAllTimer = setTimeout(() => { if (fitMode) fitToContent(); }, 350);
        saveView();
    }

    on('zoom-in', 'click', () => setZoom(zoom * 1.25));
    on('zoom-out', 'click', () => setZoom(zoom / 1.25));
    on('zoom-fit', 'click', () => {
        if (fitMode) {                 // nochmal tippen: zurück auf 100 %
            fitMode = false;
            setZoom(1);
        } else {
            fitMode = true;
            fitToContent();
            saveView();
        }
    });

    /* Zwei-Finger-Zoom im Raum */
    let pinch = null;
    const touchDist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    roomScroll.addEventListener('touchstart', e => {
        if (e.touches.length !== 2) return;
        e.preventDefault();
        pinching = true;
        pinch = { d0: touchDist(e.touches) || 1, z0: zoom };
    }, { passive: false });
    roomScroll.addEventListener('touchmove', e => {
        if (!pinch || e.touches.length !== 2) return;
        e.preventDefault();
        const r = roomScroll.getBoundingClientRect();
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
        setZoom(pinch.z0 * touchDist(e.touches) / pinch.d0, mx, my);
    }, { passive: false });
    const endPinch = e => {
        if (!pinch) return;
        if (e.touches.length < 2) {
            pinch = null;
            setTimeout(() => { pinching = false; }, 80);
        }
    };
    roomScroll.addEventListener('touchend', endPinch);
    roomScroll.addEventListener('touchcancel', endPinch);
    // Safari: Seitenzoom per Geste verhindern, solange im Raum gezoomt wird
    document.addEventListener('gesturestart', e => { if (roomScroll.contains(e.target)) e.preventDefault(); });

    // Trackpad-Zoom (Strg + Scrollen bzw. Zwei-Finger-Spreizen am Mac)
    roomScroll.addEventListener('wheel', e => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const r = roomScroll.getBoundingClientRect();
        setZoom(zoom * Math.exp(-e.deltaY / 200), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    // Drehen / Fenstergröße: neu einpassen, damit alle Tische sichtbar bleiben
    let resizeFitTimer = null;
    window.addEventListener('resize', () => {
        scheduleResize();
        if (app.classList.contains('presenting')) return;
        clearTimeout(resizeFitTimer);
        resizeFitTimer = setTimeout(showWholePlan, 200);
    });

    /* ----- Klassenliste ein-/ausblenden ----- */
    function setSidebar(open) {
        app.classList.toggle('sidebar-collapsed', !open);
        const btn = $('sidebar-btn');
        if (btn) btn.setAttribute('aria-pressed', String(!open));
        saveView();
        showWholePlan();                 // Raum wird breiter/schmaler: ganzen Plan zeigen
    }
    on('sidebar-btn', 'click', () => setSidebar(app.classList.contains('sidebar-collapsed')));

    /* ----- Präsentationsmodus ----- */
    let beforePresent = null;
    function enterPresent() {
        if (app.classList.contains('presenting')) return;
        if (selecting) endSelection();
        setActiveTable(null);
        beforePresent = { zoom, fitMode };
        app.classList.add('presenting');
        fitMode = true;
        const el = document.documentElement;
        try {
            const req = el.requestFullscreen || el.webkitRequestFullscreen;
            if (req) { const r = req.call(el); if (r && r.catch) r.catch(() => {}); }
        } catch { /* Vollbild nicht verfügbar – egal */ }
        requestAnimationFrame(() => requestAnimationFrame(fitToContent));
    }
    function exitPresent() {
        if (!app.classList.contains('presenting')) return;
        app.classList.remove('presenting');
        try {
            const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
            const exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (fsEl && exit) { const r = exit.call(document); if (r && r.catch) r.catch(() => {}); }
        } catch { /* egal */ }
        if (beforePresent) { zoom = beforePresent.zoom; fitMode = beforePresent.fitMode; }
        requestAnimationFrame(() => requestAnimationFrame(scheduleResize));
    }
    on('present-btn', 'click', enterPresent);
    on('present-exit', 'click', exitPresent);

    // gespeicherte Ansicht wiederherstellen
    try {
        const v = JSON.parse(localStorage.getItem(KEY_VIEW) || 'null');
        if (v) {
            zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number(v.zoom) || 1));
            fitMode = Boolean(v.fitMode);
            if (v.sidebar === false) app.classList.add('sidebar-collapsed');
        }
    } catch { /* egal */ }

    /** Gerade angewählter Tisch: markiert (Gruppen) oder in der Notizansicht gewählt */
    function selectedTable() {
        if (activeTable) return activeTable;
        if (notesViewActive() && noteStudent) return seatOf(noteStudent);
        return null;
    }

    /* ----- Pinsel (Kinder vom Tisch lösen) und Papierkorb (Tische löschen) -----
       Mit Auswahl: nur dieser Tisch (nach Rückfrage).
       Ohne Auswahl: Frage „Alle oder einzelne?“ – „Einzelne“ startet eine Mehrfachauswahl. */
    let picking = null;              // null | 'unseat' | 'delete'
    const picked = new Set();

    function afterTableChange() {
        refreshMarks();
        scheduleResize();
        changed();
    }
    /** Kärtchen sichtbar machen: in die Gruppen-/Klassenansicht wechseln */
    function showTray() {
        setNotesMode(false);
        if (app.classList.contains('sidebar-collapsed')) setSidebar(true);
        const sc = document.querySelector('.pp-pane-class .pp-pane-scroll');
        if (sc) sc.scrollTop = 0;
    }

    function unseatTables(list) {
        const names = list.map(sq => sq.dataset.student).filter(Boolean);
        list.forEach(sq => setSeat(sq, ''));
        afterTableChange();
        showTray();
        return names;
    }
    function deleteTables(list) {
        const names = list.map(sq => sq.dataset.student).filter(Boolean);
        list.forEach(sq => { if (squares.includes(sq)) removeSquare(sq); });
        afterTableChange();
        if (names.length) showTray();
        return names;
    }

    on('clear-seats', 'click', async () => {
        if (picking) { finishPicking(true); return; }
        const target = selectedTable();
        if (target && target.dataset.student) {
            clearTimeout(activeTimer);
            const name = target.dataset.student;
            const ok = await ui.confirm(`${name} vom Tisch lösen?`, `${name} kommt zurück unter „Sitzplätze“ – der Tisch bleibt stehen. Notizen und Foto bleiben erhalten.`, 'Lösen', true);
            setActiveTable(null);
            if (!ok || !squares.includes(target)) { refreshMarks(); return; }
            if (noteStudent === name) noteStudent = null;
            unseatTables([target]);
            showToast(`${name} ist wieder unter „Sitzplätze“.`, 'ok', 2500);
            return;
        }
        const seated = squares.filter(sq => sq.dataset.student);
        if (!seated.length) { showToast('Es sitzt noch niemand an einem Tisch.', 'info', 2200); return; }
        setActiveTable(null);
        const v = await sheet({
            title: 'Schüler:innen von Tischen lösen',
            text: `Alle Schüler:innen von Tischen lösen oder einzelne? Die Tische bleiben stehen, die Kinder kommen zurück unter „Sitzplätze“. Notizen und Fotos bleiben erhalten.`,
            buttons: [
                { label: 'Abbrechen', value: null },
                { label: 'Einzelne …', value: 'some' },
                { label: `Alle ${seated.length} lösen`, value: 'all', kind: 'danger' }
            ]
        });
        if (v === 'all') {
            if (selecting) endSelection();
            noteStudent = null;
            unseatTables(seated);
            showToast('Alle Tische sind frei – Kärtchen auf die Tische ziehen oder „Mix“.', 'ok', 3500);
        } else if (v === 'some') startPicking('unseat');
    });

    on('clear-tables', 'click', async () => {
        if (picking) { finishPicking(true); return; }
        const target = selectedTable();
        if (target) {                    // nur den angewählten Tisch entfernen – nach Rückfrage
            clearTimeout(activeTimer);   // Markierung bleibt sichtbar, solange gefragt wird
            const name = target.dataset.student;
            const ok = await ui.confirm('Tisch löschen?', name
                ? `Willst Du den Tisch wirklich löschen? ${name} kommt in die Ablage „Sitzplätze“ – Notizen und Foto bleiben erhalten.`
                : 'Willst Du den Tisch wirklich löschen?', 'Löschen', true);
            setActiveTable(null);
            if (!ok || !squares.includes(target)) { refreshMarks(); return; }
            if (noteStudent === name) noteStudent = null;
            deleteTables([target]);
            showToast(name ? `Tisch von ${name} gelöscht – ${name} ist wieder unter „Sitzplätze“.` : 'Tisch gelöscht.', 'ok', 2500);
            return;
        }
        if (!squares.length) return;
        setActiveTable(null);
        const v = await sheet({
            title: 'Tische löschen',
            text: 'Alle Tische löschen oder einzelne? Kinder an gelöschten Tischen kommen zurück unter „Sitzplätze“. Mit „Rückgängig“ holst Du Tische zurück.',
            buttons: [
                { label: 'Abbrechen', value: null },
                { label: 'Einzelne …', value: 'some' },
                { label: `Alle ${squares.length} löschen`, value: 'all', kind: 'danger' }
            ]
        });
        if (v === 'all') {
            noteStudent = null;
            const hadKids = squares.some(sq => sq.dataset.student);
            removeAllSquares();
            afterTableChange();
            if (hadKids) showTray();
        } else if (v === 'some') startPicking('delete');
    });

    /* Mehrfachauswahl von Tischen */
    function startPicking(mode) {
        if (selecting) endSelection();
        setActiveTable(null);
        picking = mode;
        picked.clear();
        app.classList.add('is-picking');
        app.classList.toggle('picking-delete', mode === 'delete');
        app.classList.toggle('picking-absent', mode === 'absent' || mode === 'arrive');
        // „fehlt“: heute schon Fehlende sind vorausgewählt (abwählen = Versehen korrigieren)
        if (mode === 'absent') squares.forEach(sq => { const a = sq.dataset.student && absenceToday(sq.dataset.student); if (a && !a.to) picked.add(sq); });
        let bar = $('pick-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'pick-bar';
            bar.className = 'pp-pickbar';
            bar.innerHTML = `<span class="pp-pickbar-text"></span>
                <button type="button" class="pp-btn pp-btn-small" data-pick="cancel">Abbrechen</button>
                <button type="button" class="pp-btn pp-btn-small pp-btn-danger" data-pick="ok"></button>`;
            bar.addEventListener('click', e => {
                const b = e.target.closest('[data-pick]');
                if (b) finishPicking(b.dataset.pick === 'ok');
            });
            document.querySelector('.pp-roombar').after(bar);        // direkt unter der Raumleiste
        }
        renderPicking();
    }
    function togglePick(el) {
        if ((picking === 'unseat' || picking === 'absent' || picking === 'arrive') && !el.dataset.student) return;   // leere Tische: niemand da
        if (picked.has(el)) picked.delete(el); else picked.add(el);
        renderPicking();
    }
    function renderPicking() {
        squares.forEach(sq => sq.classList.toggle('is-picked', picked.has(sq)));
        const bar = $('pick-bar');
        if (!bar) return;
        bar.hidden = !picking;
        if (!picking) return;
        const n = picked.size;
        const ok = bar.querySelector('[data-pick="ok"]');
        ok.classList.toggle('pp-btn-danger', picking === 'unseat' || picking === 'delete');
        ok.classList.toggle('pp-btn-primary', picking === 'absent' || picking === 'arrive');
        if (picking === 'absent') {
            bar.querySelector('.pp-pickbar-text').textContent = n ? `${countText(n, 'Kind fehlt', 'Kinder fehlen')} heute` : 'Tische der Kinder antippen, die heute fehlen';
            ok.textContent = 'Speichern';
            ok.disabled = false;
            return;
        }
        if (picking === 'arrive') {
            bar.querySelector('.pp-pickbar-text').textContent = n ? `${countText(n, 'Kind', 'Kinder')} gerade gekommen` : 'Tische der Kinder antippen, die gerade gekommen sind';
            ok.textContent = n ? `${n} eingetroffen` : 'Eingetroffen';
            ok.disabled = !n;
            return;
        }
        bar.querySelector('.pp-pickbar-text').textContent = picking === 'unseat'
            ? (n ? `${countText(n, 'Kind', 'Kinder')} gewählt` : 'Tische antippen, deren Schüler:innen gelöst werden sollen')
            : (n ? `${countText(n, 'Tisch', 'Tische')} gewählt` : 'Tische antippen, die gelöscht werden sollen');
        ok.textContent = picking === 'unseat' ? (n ? `${n} lösen` : 'Lösen') : (n ? `${n} löschen` : 'Löschen');
        ok.disabled = !n;
    }
    function finishPicking(apply) {
        const mode = picking;
        const list = [...picked].filter(sq => squares.includes(sq));
        picking = null;
        picked.clear();
        app.classList.remove('is-picking', 'picking-delete', 'picking-absent');
        squares.forEach(sq => sq.classList.remove('is-picked'));
        renderPicking();
        if (apply && mode === 'absent') { saveAbsent(list.map(sq => sq.dataset.student).filter(Boolean)); return; }
        if (apply && mode === 'arrive') { saveArrived(list.map(sq => sq.dataset.student).filter(Boolean)); return; }
        if (!apply || !list.length || mode === 'absent' || mode === 'arrive') return;
        if (list.some(sq => sq.dataset.student === noteStudent)) noteStudent = null;
        if (mode === 'unseat') {
            const names = unseatTables(list);
            showToast(`${countText(names.length, 'Kind', 'Kinder')} vom Tisch gelöst – wieder unter „Sitzplätze“.`, 'ok', 3000);
        } else {
            const names = deleteTables(list);
            showToast(`${countText(list.length, 'Tisch', 'Tische')} gelöscht` + (names.length ? ` – ${names.join(', ')} wieder unter „Sitzplätze“.` : '.'), 'ok', 3200);
        }
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && picking && !document.querySelector('.pp-sheet-layer')) finishPicking(false); });

    /* ==================================================
       Regeln: Nachbarschaft, Prüfung, Optimierung
       ================================================== */
    const RULE_TIP = 'Tipp: Für getrennte SuS Tische mit Abstand stellen (z. B. Zweier) oder mehr Tische hinzufügen. Gekoppelte Gruppen mit mehr als 2 SuS brauchen Vierer oder Reihen.';

    function hasRules() {
        return separationGroups.length > 0 || couplingGroups.length > 0;
    }

    function boxOf(sq) {
        return { x: sq.offsetLeft, y: sq.offsetTop, w: sq.offsetWidth || 80, h: sq.offsetHeight || 80 };
    }

    /** Benachbart = Lücke in beiden Richtungen höchstens maxGap (auch schräg). */
    function areNeighbors(a, b, maxGap) {
        const gapX = Math.abs(a.x - b.x) - (a.w + b.w) / 2;
        const gapY = Math.abs(a.y - b.y) - (a.h + b.h) / 2;
        return Math.max(0, gapX) <= maxGap && Math.max(0, gapY) <= maxGap;
    }

    function neighborLists(maxGap) {
        const boxes = squares.map(boxOf);
        const nb = squares.map(() => []);
        for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
                if (areNeighbors(boxes[i], boxes[j], maxGap)) { nb[i].push(j); nb[j].push(i); }
            }
        }
        return nb;
    }

    function conflictMap() {
        const map = new Map();
        separationGroups.forEach(group => {
            group.forEach(a => group.forEach(b => {
                if (a === b) return;
                if (!map.has(a)) map.set(a, new Set());
                map.get(a).add(b);
            }));
        });
        return map;
    }

    /** 0 = Gruppe sitzt zusammenhängend, sonst Anzahl fehlender Verbindungen */
    function couplingPenalty(group, seatOfName, tg) {
        const seats = group.map(seatOfName).filter(s => s !== undefined && s !== null);
        const pen = group.length - seats.length;
        if (seats.length < 2) return pen;
        const set = new Set(seats);
        const seen = new Set();
        let parts = 0;
        seats.forEach(s => {
            if (seen.has(s)) return;
            parts++;
            const stack = [s];
            seen.add(s);
            while (stack.length) {
                const u = stack.pop();
                tg[u].forEach(v => { if (set.has(v) && !seen.has(v)) { seen.add(v); stack.push(v); } });
            }
        });
        return pen + parts - 1;
    }

    function findProblems() {
        const nb = neighborLists(NEIGHBOR_GAP);
        const tg = neighborLists(TOGETHER_GAP);
        const conf = conflictMap();
        const seen = new Set();
        const sep = [];
        squares.forEach((sq, i) => {
            const a = sq.dataset.student;
            if (!a || !conf.has(a)) return;
            nb[i].forEach(j => {
                const b = squares[j].dataset.student;
                if (!b || !conf.get(a).has(b)) return;
                const k = [a, b].sort().join('\u0000');
                if (seen.has(k)) return;
                seen.add(k);
                sep.push([a, b]);
            });
        });
        const index = new Map();
        squares.forEach((sq, i) => { if (sq.dataset.student) index.set(sq.dataset.student, i); });
        const couple = couplingGroups.filter(g => couplingPenalty(g, n => index.get(n), tg) > 0);
        return { sep, couple, count: sep.length + couple.length };
    }

    function problemLines(p) {
        return [
            ...p.sep.map(([a, b]) => `✕  ${a} und ${b} sitzen nebeneinander`),
            ...p.couple.map(g => `✕  ${g.join(', ')} sitzen nicht zusammen`)
        ];
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /**
     * Sitzordnung optimieren: Trennungen und Kopplungen einhalten.
     * base: Startbelegung je Tisch · randomStart: mischen · orig: aktuelle Belegung
     * (jede Umsetzung kostet etwas – für „Konflikte lösen“).
     */
    function optimizeSeating({ base, randomStart, orig = null, restarts = 40, steps = 3000 }) {
        const M = squares.length;
        const W = 1000;
        const conf = conflictMap();
        // Koppeln-Regeln nur für SuS, die mitgemischt werden (wer in der Liste bleibt, zählt nicht)
        const inBase = new Set(base.filter(Boolean));
        const couples = couplingGroups.map(g => g.filter(n => inBase.has(n))).filter(g => g.length > 1);
        if (!conf.size && !couples.length) {
            return { assignment: randomStart ? shuffle(base.slice()) : base.slice(), violations: 0 };
        }

        const nb = neighborLists(NEIGHBOR_GAP);
        const tg = neighborLists(TOGETHER_GAP);
        const coupleOf = new Map();
        couples.forEach((g, gi) => g.forEach(n => {
            if (!coupleOf.has(n)) coupleOf.set(n, []);
            coupleOf.get(n).push(gi);
        }));
        const origIndex = new Map();
        if (orig) orig.forEach((n, i) => { if (n) origIndex.set(n, i); });

        let A = [];
        let pos = new Map();
        const clash = (a, b) => Boolean(a && b && conf.has(a) && conf.get(a).has(b));
        const sepSeat = i => nb[i].reduce((s, k) => s + (clash(A[i], A[k]) ? 1 : 0), 0);
        const couplePen = gi => couplingPenalty(couples[gi], n => pos.get(n), tg);
        const moveCost = (n, i) => (orig && n && origIndex.has(n) && origIndex.get(n) !== i ? 1 : 0);
        const localCost = (i, j) => {
            let c = W * (sepSeat(i) + sepSeat(j)) + moveCost(A[i], i) + moveCost(A[j], j);
            new Set([...(coupleOf.get(A[i]) || []), ...(coupleOf.get(A[j]) || [])]).forEach(g => { c += W * couplePen(g); });
            return c;
        };
        const doSwap = (i, j) => {
            const a = A[i];
            const b = A[j];
            A[i] = b;
            A[j] = a;
            if (a) pos.set(a, j);
            if (b) pos.set(b, i);
        };
        const swapDelta = (i, j) => {
            const before = localCost(i, j);
            doSwap(i, j);
            const after = localCost(i, j);
            doSwap(i, j);
            return after - before;
        };
        const violationCount = () => {
            let v = 0;
            for (let i = 0; i < M; i++) for (const k of nb[i]) if (k > i && clash(A[i], A[k])) v++;
            couples.forEach((_, g) => { v += couplePen(g); });
            return v;
        };
        const total = () => W * violationCount() + A.reduce((s, n, i) => s + moveCost(n, i), 0);
        const badSeats = () => {
            const badGroups = new Set();
            couples.forEach((_, g) => { if (couplePen(g) > 0) badGroups.add(g); });
            const bad = [];
            for (let i = 0; i < M; i++) {
                const n = A[i];
                if (n && (sepSeat(i) > 0 || (coupleOf.get(n) || []).some(g => badGroups.has(g)))) bad.push(i);
            }
            return bad;
        };
        const load = arr => {
            A = arr.slice();
            pos = new Map();
            A.forEach((n, i) => { if (n) pos.set(n, i); });
        };

        // Beim Mischen immer von einer zufälligen Ordnung ausgehen – sonst bliebe eine Ordnung,
        // die die Regeln schon erfüllt, einfach stehen und „Mix“ würde nichts verändern.
        let best = randomStart ? shuffle(base.slice()) : base.slice();
        load(best);
        let bestCost = total();

        for (let restart = 0; restart < restarts && bestCost >= W; restart++) {
            load(restart === 0 ? best : randomStart ? shuffle(base.slice()) : base);
            let cost = total();
            if (cost < bestCost) { bestCost = cost; best = A.slice(); }
            for (let step = 0; step < steps; step++) {
                const bad = badSeats();
                if (!bad.length) break;
                const i = bad[Math.floor(Math.random() * bad.length)];
                let bestJ = -1;
                let bestD = Infinity;
                let ties = 0;
                for (let j = 0; j < M; j++) {
                    if (j === i || A[j] === A[i]) continue;
                    const d = swapDelta(i, j);
                    if (d < bestD) { bestD = d; bestJ = j; ties = 1; }
                    else if (d === bestD && Math.random() < 1 / ++ties) bestJ = j;
                }
                if (bestJ < 0) break;
                if (bestD < 0 || (bestD === 0 && Math.random() < 0.7) || Math.random() < (orig ? 0.3 : 0.05)) {
                    doSwap(i, bestJ);
                    cost += bestD;
                } else if (!orig && Math.random() < 0.2) {
                    const j = Math.floor(Math.random() * M);
                    if (j !== i) { cost += swapDelta(i, j); doSwap(i, j); }
                }
                if (cost < bestCost) { bestCost = cost; best = A.slice(); }
            }
        }

        if (orig) {   // unnötige Umsetzungen zurücknehmen
            load(best);
            let improved = true;
            while (improved) {
                improved = false;
                for (let i = 0; i < M; i++) {
                    const n = A[i];
                    if (!n || !origIndex.has(n) || origIndex.get(n) === i) continue;
                    const j = origIndex.get(n);
                    if (swapDelta(i, j) < 0) { doSwap(i, j); improved = true; }
                }
            }
            best = A.slice();
        }
        load(best);
        return { assignment: best, violations: violationCount() };
    }

    /* ==================================================
       Verteilen
       ================================================== */
    on('shuffle-btn', 'click', distributeRandomly);
    on('demix-btn', 'click', demix);

    /** Sitzordnung von vor dem Mischen wiederherstellen */
    function demix() {
        const st = currentSeating();
        if (!st || !st.mixBase) return;
        setActiveTable(null);
        const base = st.mixBase;
        const valid = new Set(students);
        const used = new Set();
        squares.forEach(sq => {
            let n = base[sq.dataset.tid] || '';
            if (!valid.has(n) || used.has(n)) n = '';
            if (n) used.add(n);
            setSeat(sq, n);
        });
        delete st.mixBase;
        delete st.mixResult;
        refreshMarks();
        changed();
        renderMixButtons();
        const open = unseatedStudents().length;
        showToast('Sitzordnung von vor dem Mischen wiederhergestellt.' + (open ? ` ${open} SuS hatten damals noch keinen Platz.` : ''), 'ok', 3000);
    }
    on('distribute', 'click', distributeInOrder);
    on('fix-conflicts', 'click', fixConflictsOnly);

    function needStudents() {
        if (students.length) return true;
        app.classList.add('is-editing-names');
        ui.alert('Noch keine Namen', 'Gib zuerst die Namen der Klasse ein – ein Kind pro Zeile als „Nachname, Vorname“.');
        return false;
    }

    /** Mischen ohne Rückmeldung; liefert die Zahl verletzter Regeln */
    /**
     * Mischen. Sitzt schon jemand an einem Tisch, werden NUR diese SuS auf die vorhandenen Tische
     * gemischt (z. B. Teilgruppen) – wer links in der Liste steht, bleibt dort.
     * Sitzt noch niemand, bekommt die ganze Klasse einen Platz (fehlende Tische werden angelegt).
     */
    function shuffleSeats() {
        const seatedNow = squares.map(sq => sq.dataset.student || '');
        let base;
        if (squares.length && seatedNow.some(Boolean)) {
            base = seatedNow;
        } else {
            ensureTables(students.length);
            base = [...students, ...Array(Math.max(0, squares.length - students.length)).fill('')];
        }
        const { assignment, violations } = optimizeSeating({ base, randomStart: true });
        squares.forEach((sq, i) => setSeat(sq, assignment[i]));
        refreshMarks();
        scheduleResize();
        changed();
        return violations;
    }

    /** Wer sitzt an welchem Tisch? { Tisch-ID: Name } */
    function seatMap() {
        const m = {};
        squares.forEach(sq => { m[sq.dataset.tid] = sq.dataset.student || ''; });
        return m;
    }
    function sameSeatMap(a, b) {
        if (!a || !b) return false;
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const k of keys) if ((a[k] || '') !== (b[k] || '')) return false;
        return true;
    }

    /** Demix möglich? (es gibt einen Stand von vor dem Mischen, der sich vom jetzigen unterscheidet) */
    function renderMixButtons() {
        const b = $('demix-btn');
        if (!b) return;
        const st = currentSeating();
        const can = Boolean(st && st.mixBase && !sameSeatMap(st.mixBase, seatMap()));
        b.disabled = !can;
        // Mix nur, wenn schon mindestens ein Kind an einem Tisch sitzt
        const mix = $('shuffle-btn');
        if (mix) {
            const anySeated = squares.some(sq => sq.dataset.student);
            mix.disabled = !anySeated;
            mix.title = anySeated ? 'Kinder an den Tischen zufällig neu verteilen' : 'Erst Kinder auf Tische setzen: „Plätze anlegen oder verteilen“ oder Kärtchen auf Tische ziehen';
        }
        renderOrderButton();
    }

    function distributeRandomly() {
        if (!needStudents()) return;
        if (!squares.some(sq => sq.dataset.student)) {
            showToast('Erst Kinder auf Tische setzen – mit „Plätze anlegen oder verteilen“ oder per Kärtchen.', 'info', 3500);
            return;
        }
        if (selecting) endSelection();
        setActiveTable(null);
        // Stand vor dem Mischen merken. Mehrmals hintereinander „Mix“: es zählt der Stand vor dem ersten Mischen.
        const st = currentSeating();
        const before = seatMap();
        if (st && !(st.mixBase && st.mixResult && sameSeatMap(st.mixResult, before))) st.mixBase = before;
        const violations = shuffleSeats();
        if (st) st.mixResult = seatMap();
        renderMixButtons();
        saveCurrentPlan(true);
        const left = unseatedStudents().length;
        const leftNote = left ? ` ${countText(left, 'Kind', 'Kinder')} ohne Platz ${left === 1 ? 'bleibt' : 'bleiben'} in der Liste.` : '';
        if (!hasRules()) showToast('Neu gemischt.' + leftNote, 'ok', left ? 3200 : 1800);
        else if (violations === 0) showToast('Neu gemischt – alle Regeln eingehalten.' + leftNote, 'ok');
        else ui.alert('Nicht alle Regeln passen', RULE_TIP, problemLines(findProblems()));
    }

    /** Reihenfolge: nach Nachnamen (bei Klassen aus einer CSV-Liste), sonst wie in der Namensliste */
    function orderedStudents() {
        if (!students.some(n => lastNames[n])) return students.slice();
        const key = n => (lastNames[n] ? lastNames[n] : '\uffff');
        return students.slice().sort((a, b) =>
            key(a).localeCompare(key(b), 'de', { sensitivity: 'base' }) || a.localeCompare(b, 'de', { sensitivity: 'base' }));
    }

    function renderOrderButton() {
        const b = $('distribute');
        if (!b) return;
        const st = currentSeating();
        const on = Boolean(st && st.orderBase);
        b.setAttribute('aria-pressed', String(on));
        if (on !== labelMode) refreshSeatLabels();
        const label = on ? 'Sortierung aus – ursprüngliche Tische und Plätze wiederherstellen' : 'In Reihenfolge sortieren (an/aus)';
        b.title = label;
        b.setAttribute('aria-label', label);
    }

    /**
     * Schalter „In Reihenfolge sortiert“.
     * An: Tischlayout und Plätze merken, dann Layout „Reihen“ in Reihenfolge der Nachnamen.
     * Aus: gemerkte Tische (Positionen) und Plätze genau wiederherstellen.
     */
    function distributeInOrder() {
        const st = currentSeating();
        if (!st) return;
        setActiveTable(null);
        if (st.orderBase) { restoreOrderBase(st); return; }
        if (!needStudents()) return;
        if (selecting) endSelection();
        st.orderBase = { layout: currentLayout, squares: snapshotData().squares };
        applyLayout('rows');
        const order = orderedStudents();
        readingOrder().forEach((sq, i) => setSeat(sq, order[i] || ''));
        refreshMarks();
        scheduleResize();
        changed();
        renderOrderButton();
        saveCurrentPlan(true);
        if (fitMode) requestAnimationFrame(fitToContent);
        const how = students.some(n => lastNames[n]) ? 'nach Nachnamen' : 'in Listen-Reihenfolge';
        showToast(`In Reihen ${how} sortiert. Nochmal antippen: ursprüngliche Sitzordnung zurück.`, 'ok', 3500);
    }

    function restoreOrderBase(st) {
        const base = st.orderBase;
        delete st.orderBase;
        removeAllSquares();
        const valid = new Set(students);
        const used = new Set();
        (base.squares || []).forEach(q => {
            let n = q.student || '';
            if (!valid.has(n) || used.has(n)) n = '';
            if (n) used.add(n);
            createSquare(Number(q.x) || 0, Number(q.y) || 0, n, typeof q.t === 'string' ? q.t : '');
        });
        currentLayout = typeof base.layout === 'string' ? base.layout : '';
        renderLayoutSwitch();
        refreshMarks();
        scheduleResize();
        changed();
        renderOrderButton();
        saveCurrentPlan(true);
        if (fitMode) requestAnimationFrame(fitToContent);
        showToast('Ursprüngliche Tische und Sitzordnung wiederhergestellt.', 'ok', 2500);
    }

    function fixConflictsOnly() {
        if (!needStudents()) return;
        if (!hasRules()) {
            ui.alert('Noch keine Regeln', 'Lege zuerst links unter „Regeln“ fest, wer getrennt oder zusammen sitzen soll.');
            return;
        }
        ensureTables(students.length);
        const before = squares.map(sq => sq.dataset.student || '');
        const seatedBefore = new Set(before.filter(Boolean));
        const base = before.slice();
        students.filter(n => !seatedBefore.has(n)).forEach(n => {
            const k = base.indexOf('');
            if (k >= 0) base[k] = n;
        });
        const { assignment, violations } = optimizeSeating({ base, orig: before, randomStart: false, restarts: 30, steps: 1500 });
        let moved = 0;
        squares.forEach((sq, i) => {
            setSeat(sq, assignment[i]);
            if (assignment[i] && assignment[i] !== before[i]) {
                flashMoved(sq);
                if (seatedBefore.has(assignment[i])) moved++;
            }
        });
        refreshMarks();
        scheduleResize();
        changed();
        if (violations === 0) {
            showToast(moved === 0 ? 'Alle Regeln sind bereits eingehalten.' : `${moved} SuS umgesetzt (blau markiert), alle anderen bleiben sitzen.`, 'ok', 4000);
        } else {
            ui.alert(`${moved} SuS umgesetzt – aber nicht alle Regeln passen`, RULE_TIP, problemLines(findProblems()));
        }
    }

    /** Tisch kurz blau umranden (Tausch: 0,5 s · „Konflikte lösen“: 5 s) */
    function flashMoved(sq, ms = 5000) {
        clearTimeout(sq._flashTimer);
        sq.classList.add('just-moved');
        sq._flashTimer = setTimeout(() => sq.classList.remove('just-moved'), ms);
    }

    /* ==================================================
       Regeln festlegen (Trennen / Koppeln)
       ================================================== */
    const selectBar = $('select-bar');
    const ruleButtons = $('rule-buttons');

    on('separate-students', 'click', () => startSelection('separate'));
    on('couple-students', 'click', () => startSelection('couple'));
    on('finish-separation', 'click', finishSelection);
    on('cancel-selection', 'click', endSelection);

    function startSelection(mode) {
        if (students.length < 2) {
            if (needStudents()) ui.alert('Zu wenige Namen', 'Für Regeln braucht es mindestens zwei Namen.');
            return;
        }
        setActiveTable(null);
        selecting = true;
        selectMode = mode;
        currentSelection = [];
        document.body.classList.add('is-selecting');
        document.body.classList.toggle('mode-couple', mode === 'couple');
        if (ruleButtons) ruleButtons.hidden = true;
        if (selectBar) selectBar.hidden = false;
        updateSelectBar();
        refreshMarks();
    }

    function toggleSelection(name) {
        if (currentSelection.includes(name)) currentSelection = currentSelection.filter(n => n !== name);
        else currentSelection.push(name);
        updateSelectBar();
        refreshMarks();
    }

    function updateSelectBar() {
        const n = currentSelection.length;
        const what = selectMode === 'couple' ? 'Koppeln: Wer soll zusammen sitzen?' : 'Trennen: Wer soll nicht nebeneinander sitzen?';
        $('select-text').textContent = `${what}\nTippe die SuS an – in der Liste oder auf den Tischen. ${n ? `(${n} ausgewählt)` : ''}`;
        const fin = $('finish-separation');
        if (fin) fin.disabled = n < 2;
        if (fin) fin.style.opacity = n < 2 ? '0.45' : '';
    }

    function contradictions(selection, otherGroups) {
        const found = [];
        otherGroups.forEach(g => {
            const both = selection.filter(n => g.includes(n));
            if (both.length >= 2) found.push(both.join(' & '));
        });
        return found;
    }

    async function finishSelection() {
        const sel = [...currentSelection];
        if (sel.length < 2) return;
        if (selectMode === 'couple') {
            const c = contradictions(sel, separationGroups);
            if (c.length) {
                await ui.alert('Widerspruch', `${c.join(', ')} sollen bereits getrennt sitzen. Lösche zuerst diese Trennen-Regel.`);
                return;
            }
            couplingGroups.push(sel);
            showToast(`Gekoppelt: ${sel.join(', ')}` + (sel.length > 4 ? '\nMehr als 4 SuS passen nur in Reihen zusammen.' : ''), 'ok', 3500);
        } else {
            const c = contradictions(sel, couplingGroups);
            if (c.length) {
                await ui.alert('Widerspruch', `${c.join(', ')} sind bereits gekoppelt. Lösche zuerst diese Koppeln-Regel.`);
                return;
            }
            separationGroups.push(sel);
            showToast(`Getrennt: ${sel.join(', ')}`, 'ok', 3000);
        }
        endSelection();
        renderRules();
        changed();
    }

    function endSelection() {
        selecting = false;
        currentSelection = [];
        document.body.classList.remove('is-selecting', 'mode-couple');
        if (ruleButtons) ruleButtons.hidden = false;
        if (selectBar) selectBar.hidden = true;
        refreshMarks();
    }

    function renderRules() {
        const list = $('rule-list');
        if (!list) return;
        list.textContent = '';
        const add = (group, kind, index) => {
            const li = document.createElement('li');
            li.className = `pp-rule ${kind === 'cpl' ? 'is-cpl' : 'is-sep'}`;
            li.insertAdjacentHTML('beforeend', icon(kind === 'cpl' ? 'link' : 'separate'));
            const text = document.createElement('span');
            text.className = 'pp-rule-text';
            text.textContent = group.join(', ');
            li.appendChild(text);
            const del = document.createElement('button');
            del.className = 'pp-iconbtn';
            del.setAttribute('aria-label', 'Regel löschen');
            del.innerHTML = icon('close');
            del.addEventListener('click', () => {
                (kind === 'cpl' ? couplingGroups : separationGroups).splice(index, 1);
                renderRules();
                changed();
            });
            li.appendChild(del);
            list.appendChild(li);
        };
        couplingGroups.forEach((g, i) => add(g, 'cpl', i));
        separationGroups.forEach((g, i) => add(g, 'sep', i));
        if (!hasRules()) {
            const li = document.createElement('li');
            li.className = 'pp-rules-empty';
            li.textContent = '„Trennen“: SuS sitzen nicht nebeneinander, hintereinander oder schräg. „Koppeln“: SuS sitzen am selben Tisch bzw. Gruppentisch.';
            list.appendChild(li);
        }
    }

    /* ==================================================
       Pläne: Speichern, Rückgängig, Verwaltung
       ================================================== */
    function readPlans() {
        try {
            const v = JSON.parse(localStorage.getItem(KEY_PLANS) || '{}');
            return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
        } catch (err) {
            console.error(err);
            return {};
        }
    }

    let storageWarned = false;
    function writePlans(plans) {
        try {
            localStorage.setItem(KEY_PLANS, JSON.stringify(plans));
            return true;
        } catch (err) {
            console.error(err);
            if (!storageWarned) {
                storageWarned = true;
                ui.alert('Speichern nicht möglich', 'Der Browserspeicher ist voll oder gesperrt (privates Fenster?). Sichere deine Klassen als Datei.');
            }
            return false;
        }
    }

    /** Übernahme der Pläne aus der alten Sitzplan-App */
    function migrateOldPlans() {
        try {
            if (localStorage.getItem(KEY_PLANS)) return;
            const old = JSON.parse(localStorage.getItem('sitzplaene') || 'null');
            if (old && typeof old === 'object' && Object.keys(old).length) {
                localStorage.setItem(KEY_PLANS, JSON.stringify(old));
            }
        } catch (err) { console.warn(err); }
    }

    let currentName = 'Meine Klasse';

    function snapshotData() {
        return {
            students: [...students],
            separationGroups: separationGroups.map(g => [...g]),
            couplingGroups: couplingGroups.map(g => [...g]),
            layout: currentLayout,
            lastNames: { ...lastNames },
            squares: squares.map(sq => ({ x: sq.offsetLeft, y: sq.offsetTop, student: sq.dataset.student || '', t: sq.dataset.tid }))
        };
    }

    /** Stellt einen Zustand her (aus Plan, Rückgängig oder Import). */
    function applyData(data) {
        if (selecting) endSelection();
        removeAllSquares();
        namesSession = null;
        const groupsFrom = v => (Array.isArray(v) ? v.filter(Array.isArray).map(g => [...g]) : []);
        separationGroups = groupsFrom(data.separationGroups);
        couplingGroups = groupsFrom(data.couplingGroups);
        currentLayout = typeof data.layout === 'string' ? data.layout : '';
        lastNames = data.lastNames && typeof data.lastNames === 'object' ? { ...data.lastNames } : {};
        readStudentInput(Array.isArray(data.students) ? data.students : []);
        const valid = new Set(students);
        const used = new Set();
        (Array.isArray(data.squares) ? data.squares : []).forEach(s => {
            let name = s.hasStudent === false ? '' : (s.student || '');
            if (!valid.has(name) || used.has(name)) name = '';
            if (name) used.add(name);
            createSquare(Number(s.x) || 0, Number(s.y) || 0, name, typeof s.t === 'string' ? s.t : '');
        });
        renderLayoutSwitch();
        renderRules();
        refreshMarks();
        renderMixButtons();
        scheduleResize();
    }

    /* ----- Sitzpläne einer Klasse ----- */

    /** Sitzpläne aus einem gespeicherten Klassen-Datensatz (ältere Daten: genau ein Sitzplan) */
    function seatingsOf(plan) {
        if (plan && Array.isArray(plan.seatings) && plan.seatings.length) {
            return plan.seatings.filter(st => st && typeof st === 'object').map((st, i) => ({
                ...JSON.parse(JSON.stringify(st)),
                id: String(st.id || `s${i + 1}`),
                name: String(st.name || `Sitzplan ${i + 1}`),
                layout: typeof st.layout === 'string' ? st.layout : '',
                squares: Array.isArray(st.squares) ? st.squares : []
            }));
        }
        return [{
            id: 's1', name: 'Sitzplan 1',
            layout: plan && typeof plan.layout === 'string' ? plan.layout : '',
            squares: plan && Array.isArray(plan.squares) ? JSON.parse(JSON.stringify(plan.squares)) : []
        }];
    }

    /** Was gerade zu sehen ist: ungesicherte Änderungen (work) oder der übernommene Stand */
    function shownOf(st) { return st.work || st; }

    function currentSeating() {
        return seatings.find(st => st.id === currentSeatingId) || seatings[0] || null;
    }

    /** Klasse laden (ein Sitzplan wird angezeigt) */
    function loadClass(plan, seatingId = null) {
        seatings = seatingsOf(plan || {});
        const want = seatingId || (plan && plan.seatingId);
        currentSeatingId = (seatings.find(st => st.id === want) || seatings[0]).id;
        const st = currentSeating();
        observ = normObs(plan && plan.observ);
        absences = normAbsences(plan && plan.absences);
        absDayView = null;
        votes = normVotes(plan && plan.votes);
        classCats = catsOfPlan(plan);
        applyData({ ...(plan || {}), layout: shownOf(st).layout, squares: shownOf(st).squares });
        renderSeatingPicker();
        showWholePlan();
    }

    const seatingTabs = $('seating-tabs');

    /** Sitzpläne der Klasse als Reiter in der Kopfzeile */
    function renderSeatingPicker() {
        // Zustand merken, den die Reiter jetzt zeigen (sonst bleibt nach „Übernehmen“ oder
        // einem Klassenwechsel das Schloss bei der nächsten Änderung aus)
        const cur = currentSeating();
        lastDirty = cur ? `${currentPlanId}:${cur.id}:${isDirty(cur)}` : null;
        app.classList.toggle('has-seatings', seatings.length > 1);
        if (!seatingTabs) return;
        seatingTabs.textContent = '';
        seatings.forEach(st => {
            const b = document.createElement('button');
            const active = st.id === currentSeatingId;
            const dirty = isDirty(st);
            b.className = 'pp-seating-tab' + (dirty ? ' is-dirty' : '');
            b.setAttribute('role', 'tab');
            b.setAttribute('aria-selected', String(active));
            b.dataset.seating = st.id;
            b.title = dirty ? `„${st.name}“ wurde verändert – antippen: Änderungen übernehmen oder verwerfen`
                : active ? `„${st.name}“ – antippen zum Umbenennen oder Löschen` : `Sitzplan „${st.name}“ öffnen`;
            const t = document.createElement('span');
            t.textContent = st.name;
            b.appendChild(t);
            if (active || dirty) b.insertAdjacentHTML('beforeend', icon(dirty ? 'lockOpen' : 'edit'));
            b.addEventListener('click', () => {
                if (st.id === currentSeatingId) seatingOptions(st.id);
                else switchSeating(st.id);
            });
            seatingTabs.appendChild(b);
        });
        renderSeatingSelect();
    }

    /* iPhone: Auswahl als Dropdown, daneben Stift bzw. offenes Schloss */
    const seatingSelect = $('seating-select');
    function renderSeatingSelect() {
        if (!seatingSelect) return;
        seatingSelect.textContent = '';
        seatings.forEach(st => {
            const o = document.createElement('option');
            o.value = st.id;
            o.textContent = st.name + (isDirty(st) && st.id !== currentSeatingId ? ' (geändert)' : '');
            o.selected = st.id === currentSeatingId;
            seatingSelect.appendChild(o);
        });
        const act = $('seating-action');
        if (act) {
            const dirty = isDirty(currentSeating());
            act.innerHTML = icon(dirty ? 'lockOpen' : 'edit');
            act.classList.toggle('is-dirty', dirty);
            const label = dirty ? 'Änderungen übernehmen oder verwerfen' : 'Sitzplan umbenennen oder löschen';
            act.title = label;
            act.setAttribute('aria-label', label);
        }
        seatingSelect.closest('.pp-seating-mobile')?.classList.toggle('is-dirty', isDirty(currentSeating()));
    }
    on('seating-select', 'change', () => {
        const id = seatingSelect.value;
        if (id !== currentSeatingId) switchSeating(id);
    });
    on('seating-action', 'click', () => seatingOptions(currentSeatingId));

    /** Aktiven Reiter antippen: umbenennen oder löschen */
    async function seatingOptions(id) {
        const st = seatings.find(x => x.id === id);
        if (!st) return;
        syncSeating();
        if (isDirty(st)) {
            const v = await sheet({
                title: 'Änderungen übernehmen?',
                text: `Tische oder Sitzordnung von „${st.name}“ wurden verändert. Sollen die Änderungen in den Sitzplan übernommen werden?`,
                lines: ['Übernehmen: Der jetzige Stand wird zum neuen Sitzplan.', 'Verwerfen: Alles wird wie zuletzt übernommen.'],
                buttons: [
                    { label: 'Später', value: null },
                    { label: 'Verwerfen', value: 'discard', kind: 'danger' },
                    { label: 'Übernehmen', value: 'commit', kind: 'primary' }
                ]
            });
            if (v === 'commit') commitSeating();
            else if (v === 'discard') discardSeating();
            return;
        }
        const buttons = [{ label: 'Abbrechen', value: null }];
        if (seatings.length > 1) buttons.push({ label: 'Löschen …', value: 'delete', kind: 'danger' });
        buttons.push({ label: 'Umbenennen …', value: 'rename', kind: 'primary' });
        const v = await sheet({
            title: `Sitzplan „${st.name}“`,
            text: `${countText(squares.length, 'Tisch', 'Tische')}. Namen, Regeln, Notizen und Fotos gelten für alle Sitzpläne von „${currentName}“.`,
            buttons
        });
        if (v === 'rename') renameSeating(id);
        else if (v === 'delete') deleteSeating(id);
    }
    function closeSeatingMenu() { /* Reiter brauchen kein Menü */ }
    on('add-seating-btn', 'click', () => addSeating());

    function uniqueSeatingName(base) {
        const taken = new Set(seatings.map(st => st.name));
        if (!taken.has(base)) return base;
        let i = 2;
        while (taken.has(`${base} ${i}`)) i++;
        return `${base} ${i}`;
    }

    /** Zu einem anderen Sitzplan derselben Klasse wechseln – Notizansicht bleibt bei der Person */
    async function switchSeating(id) {
        if (id === currentSeatingId) return;
        await commitNames(true);
        setActiveTable(null);
        saveCurrentPlan(true);
        const st = seatings.find(x => x.id === id);
        if (!st) return;
        await switchSeatingDirect(id, noteStudent);
        showToast(`Sitzplan „${st.name}“`, 'info', 1500);
    }

    async function addSeating() {
        await commitNames(true);
        syncSeating();
        const cur = currentSeating();
        let start = 'copy';
        const content = document.createElement('div');
        const row = document.createElement('div');
        row.className = 'pp-setting-row';
        row.style.margin = '10px 0 4px';
        row.innerHTML = '<span>Beginnen mit</span>';
        const seg = document.createElement('div');
        seg.className = 'pp-segmented pp-segmented-small';
        const mk = (label, val) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = label;
            b.dataset.start = val;
            b.setAttribute('aria-pressed', String(start === val));
            b.addEventListener('click', () => {
                start = val;
                seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
            });
            return b;
        };
        seg.append(mk('Kopie', 'copy'), mk('Leer', 'empty'));
        row.appendChild(seg);
        const hint = document.createElement('p');
        hint.className = 'pp-hint';
        hint.textContent = `„Kopie“ übernimmt Tische und Plätze von „${cur ? cur.name : 'Sitzplan 1'}“. „Leer“ beginnt ohne Tische – dann ein Layout wählen und „Mix“.`;
        content.append(row, hint);
        const raw = await sheet({
            title: 'Sitzplan ergänzen',
            text: `Ein weiterer Sitzplan für „${currentName}“, z. B. für Gruppenarbeit oder Prüfungen. Namen, Regeln, Notizen und Fotos bleiben dieselben.`,
            input: { label: 'Name des Sitzplans', value: uniqueSeatingName(seatings.length === 1 ? 'Gruppenarbeit' : `Sitzplan ${seatings.length + 1}`) },
            content,
            buttons: [{ label: 'Abbrechen', value: null }, { label: 'Anlegen', value: true, kind: 'primary' }]
        });
        const name = typeof raw === 'string' && raw ? raw : null;
        if (!name) return;
        if (seatings.some(st => st.name === name)) { await ui.alert('Name vergeben', `Einen Sitzplan „${name}“ gibt es in dieser Klasse schon.`); return; }
        const st = { id: newId(), name, layout: '', squares: [] };
        if (start === 'copy' && cur) {
            st.layout = shownOf(cur).layout;
            st.squares = (shownOf(cur).squares || []).map(q => ({ ...q, t: tableId() }));
        }
        setActiveTable(null);
        seatings.push(st);
        saveCurrentPlan(true);
        await switchSeatingDirect(st.id, noteStudent);
        if (start === 'empty') showToast('Leerer Sitzplan – oben ein Layout wählen, dann „Mix“.', 'info', 4000);
        else showToast(`Sitzplan „${name}“ angelegt.`, 'ok', 2500);
    }

    /** Wechsel ohne erneutes Speichern des alten Sitzplans (nach dem Anlegen) */
    async function switchSeatingDirect(id, keepNote) {
        const st = seatings.find(x => x.id === id);
        currentSeatingId = id;
        applyData({ students: [...students], separationGroups, couplingGroups, lastNames, layout: shownOf(st).layout, squares: shownOf(st).squares });
        const keep = keepNote && students.includes(keepNote) ? keepNote : null;
        if (keep !== noteStudent) { noteStudent = keep; renderNotes(); }
        refreshMarks();
        resetHistory();
        saveCurrentPlan(true);
        renderSeatingPicker();
        showWholePlan();
    }

    async function renameSeating(id) {
        const st = seatings.find(x => x.id === id);
        if (!st) return;
        closeSeatingMenu();
        const name = await ui.prompt('Sitzplan umbenennen', 'Neuer Name', st.name, 'Umbenennen');
        if (!name || name === st.name) return;
        if (seatings.some(x => x.name === name)) { await ui.alert('Name vergeben', `Einen Sitzplan „${name}“ gibt es in dieser Klasse schon.`); return; }
        st.name = name;
        saveCurrentPlan(true);
        renderSeatingPicker();
    }

    async function deleteSeating(id) {
        const st = seatings.find(x => x.id === id);
        if (!st || seatings.length < 2) return;
        closeSeatingMenu();
        if (!await ui.confirm('Sitzplan löschen?', `Der Sitzplan „${st.name}“ (Tische und Plätze) wird gelöscht. Namen, Notizen und Fotos der Klasse bleiben erhalten.`, 'Löschen', true)) return;
        syncSeating();
        const wasCurrent = id === currentSeatingId;
        seatings = seatings.filter(x => x.id !== id);
        if (wasCurrent) await switchSeatingDirect(seatings[0].id, noteStudent);
        else { saveCurrentPlan(true); renderSeatingPicker(); }
        showToast(`Sitzplan „${st.name}“ gelöscht.`, 'ok', 2500);
    }

    /** aktuellen Sitzplan aus dem Raum in die Liste übernehmen */
    /**
     * Schutz vor versehentlichem Zerstören: Änderungen an Tischen oder Sitzordnung landen
     * zuerst als „work“ im Sitzplan (offenes Schloss). Erst „Übernehmen“ macht sie zum neuen Stand.
     */
    function seatingKey(layout, sqs) {
        const valid = new Set(students);
        return JSON.stringify([layout || '', (sqs || []).map(q => [Math.round(Number(q.x) || 0), Math.round(Number(q.y) || 0), valid.has(q.student) ? q.student : ''])
            .sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]) || String(a[2]).localeCompare(String(b[2])))]);
    }
    function syncSeating() {
        const st = currentSeating();
        if (!st) return;
        const data = snapshotData();
        const base = st.squares || [];
        if (!base.some(q => q.student)) {          // noch niemand hat einen Platz: nichts zu schützen, direkt übernehmen
            st.layout = data.layout;
            st.squares = data.squares;
            delete st.work;
        } else if (seatingKey(data.layout, data.squares) === seatingKey(st.layout, base)) {
            delete st.work;                        // wieder wie der übernommene Stand
        } else {
            st.work = { layout: data.layout, squares: data.squares };
        }
    }
    function isDirty(st) { return Boolean(st && st.work); }

    function commitSeating() {
        const st = currentSeating();
        if (!st) return;
        syncSeating();
        if (st.work) { st.layout = st.work.layout; st.squares = st.work.squares; delete st.work; }
        saveCurrentPlan(true);
        renderSeatingPicker();
        showToast(`Änderungen in „${st.name}“ übernommen.`, 'ok', 2500);
    }

    function discardSeating() {
        const st = currentSeating();
        if (!st) return;
        delete st.work;
        setActiveTable(null);
        applyData({ students: [...students], separationGroups, couplingGroups, lastNames, layout: st.layout, squares: st.squares });
        changed();
        saveCurrentPlan(true);
        renderSeatingPicker();
        showWholePlan();
        showToast(`„${st.name}“ ist wieder wie zuletzt übernommen.`, 'ok', 2500);
    }

    /* ----- Rückgängig / Wiederholen ----- */
    let past = [];
    let future = [];
    let currentSnap = null;

    function resetHistory() {
        past = [];
        future = [];
        currentSnap = JSON.stringify(snapshotData());
        renderHistoryButtons();
    }

    function renderHistoryButtons() {
        const u = $('undo-btn');
        const r = $('redo-btn');
        if (u) u.disabled = !past.length;
        if (r) r.disabled = !future.length;
    }

    /** Nach jeder Änderung aufrufen: Verlauf + automatisches Speichern */
    function changed() {
        renderMixButtons();
        const snap = JSON.stringify(snapshotData());
        if (snap === currentSnap) return;
        if (currentSnap !== null) past.push(currentSnap);
        if (past.length > 100) past.shift();
        future = [];
        currentSnap = snap;
        renderHistoryButtons();
        scheduleAutosave();
        updateDirty();
    }

    function updateDirty() {
        const st = currentSeating();
        if (!st) return;
        syncSeating();
        const key = `${currentPlanId}:${st.id}:${isDirty(st)}`;
        if (key !== lastDirty) { lastDirty = key; renderSeatingPicker(); }
    }

    let changeTimer = null;
    function changedSoon() {
        clearTimeout(changeTimer);
        changeTimer = setTimeout(changed, 600);
    }

    function undo() {
        if (!past.length) return;
        future.push(currentSnap);
        currentSnap = past.pop();
        applyData(JSON.parse(currentSnap));
        renderHistoryButtons();
        scheduleAutosave();
        updateDirty();
    }

    function redo() {
        if (!future.length) return;
        past.push(currentSnap);
        currentSnap = future.pop();
        applyData(JSON.parse(currentSnap));
        renderHistoryButtons();
        scheduleAutosave();
        updateDirty();
    }

    on('undo-btn', 'click', undo);
    on('redo-btn', 'click', redo);
    document.addEventListener('keydown', e => {
        if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
        if (document.activeElement === studentInput || document.querySelector('.pp-sheet-layer')) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
    });

    /* ----- Automatisch speichern ----- */
    let autosaveTimer = null;
    function scheduleAutosave() {
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(saveCurrentPlan, 400);
        renderPlanHeader();
    }

    /** force: auch einen noch leeren Plan anlegen */
    function saveCurrentPlan(force = false) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
        const plans = readPlans();
        const data = snapshotData();
        if (!plans[currentName] && !force && isPlanEmpty(data)) { renderPlanHeader(); return; }
        const old = plans[currentName] || {};
        if (!currentPlanId) selectPlan(null);
        if (!seatings.length) { seatings = seatingsOf({}); currentSeatingId = seatings[0].id; }
        syncSeating();
        plans[currentName] = {
            ...data,                       // layout/squares: aktueller Sitzplan (für ältere Versionen)
            version: 4,
            id: currentPlanId,
            name: currentName,
            seatings: JSON.parse(JSON.stringify(seatings)),
            seatingId: currentSeatingId,
            observ: JSON.parse(JSON.stringify(observ)),
            votes: JSON.parse(JSON.stringify(votes)),
            absences: absences.map(a => ({ ...a })),
            ratingCats: classCats.map(c => ({ ...c })),
            catsV2: true,
            timestamp: new Date().toISOString(),
            exportedAt: old.exportedAt || null
        };
        writePlans(plans);
        try { localStorage.setItem(KEY_CURRENT, currentName); } catch { /* egal */ }
        renderPlanHeader();
        renderPlanList();
    }

    function isPlanEmpty(data) {
        return !(data.students && data.students.length) && !(data.squares && data.squares.length);
    }

    function renderPlanHeader() {
        $('plan-name').textContent = currentName;
        const plan = readPlans()[currentName];
        const pending = autosaveTimer !== null;
        const exported = plan && plan.exportedAt && plan.exportedAt >= plan.timestamp;
        const unsaved = Boolean(plan) && !exported && !isPlanEmpty(plan);
        app.classList.toggle('is-unsaved', unsaved);
        let state = 'Noch leer';
        if (plan && !isPlanEmpty(plan)) {
            const t = new Date(plan.timestamp);
            state = exported ? 'Als Datei gesichert' : isNaN(t) ? 'Gespeichert' : `Gespeichert · ${t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (pending) {
            state = 'Wird gespeichert …';
        }
        $('plan-state').textContent = state;
        const st = currentSeating();
        document.title = `${currentName}${st && seatings.length > 1 ? ` · ${st.name}` : ''} – PlanPad`;
    }

    function formatDate(ts) {
        const d = new Date(ts);
        return isNaN(d) ? 'ohne Datum' : d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function renderPlanList() {
        const list = $('plan-list');
        if (!list) return;
        const plans = readPlans();
        const names = Object.keys(plans).sort((a, b) =>
            String(plans[b].timestamp || '').localeCompare(String(plans[a].timestamp || '')));
        list.textContent = '';
        names.forEach(name => {
            const p = plans[name];
            const li = document.createElement('li');
            li.className = 'pp-planitem' + (name === currentName ? ' is-current' : '');
            const open = document.createElement('button');
            open.className = 'pp-planitem-open';
            const count = Array.isArray(p.students) ? p.students.length : 0;
            const nSeat = seatingsOf(p).length;
            open.innerHTML = icon(name === currentName ? 'check' : 'users')
                + `<span><span class="pp-planitem-name">${escapeHtml(name)}</span>`
                + `<span class="pp-planitem-date">${count} SuS · ${countText(nSeat, 'Sitzplan', 'Sitzpläne')} · ${escapeHtml(formatDate(p.timestamp))}</span></span>`;
            open.addEventListener('click', async () => { closeDrawer(); await openPlan(name); });
            const del = document.createElement('button');
            del.className = 'pp-iconbtn pp-planitem-del';
            del.setAttribute('aria-label', `Klasse „${name}“ löschen`);
            del.innerHTML = icon('trash');
            del.addEventListener('click', () => deletePlan(name));
            li.append(open, del);
            list.appendChild(li);
        });
    }

    async function openPlan(name) {
        if (name === currentName) return;
        await commitNames(true);
        if (autosaveTimer) saveCurrentPlan();
        const plan = readPlans()[name];
        if (!plan) return;
        saveDraft();
        currentName = name;
        selectPlan(plan.id);
        noteStudent = null;
        loadClass(plan);
        // Klassenwechsel (Dropdown oder Menü): immer die Notizen-Ansicht – die Standardansicht
        if (students.length && !notesMode) setNotesMode(true);
        renderNotes();
        app.classList.toggle('is-editing-names', !students.length);
        observationCheck().catch(console.error);
        resetHistory();
        try { localStorage.setItem(KEY_CURRENT, name); } catch { /* egal */ }
        renderPlanHeader();
        renderPlanList();
        showToast(`„${name}“ geöffnet.`, 'info', 1800);
    }

    function uniqueName(base) {
        const plans = readPlans();
        if (!plans[base]) return base;
        let i = 2;
        while (plans[`${base} ${i}`]) i++;
        return `${base} ${i}`;
    }

    async function newPlan() {
        await commitNames(true);
        const name = await ui.prompt('Klasse anlegen', 'Name, z. B. „9c Informatik“', uniqueName('Neue Klasse'), 'Anlegen');
        if (!name) return;
        if (readPlans()[name]) { await ui.alert('Name vergeben', `Eine Klasse „${name}“ gibt es schon.`); return; }
        if (autosaveTimer) saveCurrentPlan();
        saveDraft();
        noteStudent = null;
        currentName = name;
        selectPlan(null);
        notesMode = false;               // neue Klasse: Gruppenansicht
        loadClass({});
        resetHistory();
        app.classList.add('is-editing-names');
        saveCurrentPlan(true);
        closeDrawer();
        studentInput.focus();
    }

    async function duplicatePlan() {
        await commitNames(true);
        const name = await ui.prompt('Klasse duplizieren', 'Name der Kopie (mit allen Sitzplänen, Fotos und Notizen)', uniqueName(`${currentName} (Kopie)`), 'Duplizieren');
        if (!name) return;
        if (readPlans()[name]) { await ui.alert('Name vergeben', `Eine Klasse „${name}“ gibt es schon.`); return; }
        saveCurrentPlan();
        saveDraft();
        const oldId = currentPlanId;
        currentName = name;
        selectPlan(null);
        copyFaces(oldId, currentPlanId);
        copyPlanNotes(oldId, currentPlanId);
        resetHistory();
        setNotesMode(false);
        saveCurrentPlan(true);
        closeDrawer();
        showToast(`Kopie „${name}“ angelegt – du arbeitest jetzt in der Kopie.`, 'ok');
    }

    async function renamePlan() {
        const name = await ui.prompt('Klasse umbenennen', 'Neuer Name, z. B. „9c Informatik“', currentName, 'Umbenennen');
        if (!name || name === currentName) return;
        const plans = readPlans();
        if (plans[name]) { await ui.alert('Name vergeben', `Eine Klasse „${name}“ gibt es schon.`); return; }
        const data = plans[currentName];
        delete plans[currentName];
        if (data) plans[name] = { ...data, name };
        writePlans(plans);
        currentName = name;
        saveCurrentPlan();
    }

    async function deletePlan(name) {
        const nSeat = seatingsOf(readPlans()[name]).length;
        if (!await ui.confirm('Klasse löschen?', `„${name}“ wird mit ${countText(nSeat, 'Sitzplan', 'Sitzplänen')}, allen Notizen und Fotos von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.`, 'Löschen', true)) return;
        const plans = readPlans();
        const goneId = plans[name] && plans[name].id;
        delete plans[name];
        writePlans(plans);
        if (goneId) {
            facesByPlan.delete(goneId);
            faceStore.removePlan(goneId).catch(console.error);
            removePlanNotes(goneId);
            try { const l = readLearn(); delete l[goneId]; localStorage.setItem(KEY_LEARN, JSON.stringify(l)); } catch { /* egal */ }
        }
        if (name === currentName) {
            const rest = Object.keys(plans).sort((a, b) => String(plans[b].timestamp || '').localeCompare(String(plans[a].timestamp || '')));
            clearTimeout(autosaveTimer);
            autosaveTimer = null;
            noteStudent = null;
            if (rest.length) {
                currentName = rest[0];
                selectPlan(plans[rest[0]].id);
                loadClass(plans[rest[0]]);
            } else {
                currentName = 'Meine Klasse';
                selectPlan(null);
                loadClass({});
                app.classList.add('is-editing-names');
            }
            renderNotes();
            resetHistory();
        }
        renderPlanHeader();
        renderPlanList();
    }

    on('plan-btn', 'click', toggleClassMenu);

    /** Klassenname oben links = Auswahlliste aller Klassen */
    let classMenu = null;
    function closeClassMenu() {
        if (!classMenu) return;
        classMenu.remove();
        classMenu = null;
        $('plan-btn').setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', onClassMenuOutside, true);
        document.removeEventListener('keydown', onClassMenuKey, true);
    }
    function onClassMenuOutside(e) {
        if (classMenu && !classMenu.contains(e.target) && !$('plan-btn').contains(e.target)) closeClassMenu();
    }
    function onClassMenuKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closeClassMenu(); } }
    function toggleClassMenu() {
        if (classMenu) { closeClassMenu(); return; }
        saveCurrentPlan();
        const btn = $('plan-btn');
        const plans = readPlans();
        const names = Object.keys(plans).sort((a, b) => a.localeCompare(b, 'de', { numeric: true, sensitivity: 'base' }));
        const menu = document.createElement('div');
        menu.className = 'pp-classmenu';
        menu.id = 'class-menu';
        const list = document.createElement('div');
        list.className = 'pp-classmenu-list';
        list.setAttribute('role', 'listbox');
        list.setAttribute('aria-label', 'Klasse wählen');
        if (!names.length) {
            const p = document.createElement('p');
            p.className = 'pp-hint';
            p.textContent = 'Noch keine gespeicherte Klasse.';
            list.appendChild(p);
        }
        names.forEach(name => {
            const it = document.createElement('button');
            it.type = 'button';
            it.className = 'pp-classmenu-item';
            it.setAttribute('role', 'option');
            const sel = name === currentName;
            it.setAttribute('aria-selected', String(sel));
            const n = (plans[name].students || []).length;
            it.innerHTML = `<span class="pp-classmenu-check">${sel ? icon('check') : ''}</span><span class="pp-classmenu-name">${escapeHtml(name)}</span><small>${n} SuS</small>`;
            it.addEventListener('click', () => { closeClassMenu(); if (!sel) openPlan(name); });
            list.appendChild(it);
        });
        menu.appendChild(list);
        const foot = document.createElement('div');
        foot.className = 'pp-classmenu-foot';
        const act = (ic, label, fn) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.innerHTML = `${icon(ic)}<span>${label}</span>`;
            b.addEventListener('click', () => { closeClassMenu(); fn(); });
            foot.appendChild(b);
        };
        act('edit', 'Umbenennen', renamePlan);
        act('plus', 'Klasse anlegen', newPlan);
        menu.appendChild(foot);
        document.body.appendChild(menu);
        const r = btn.getBoundingClientRect();
        menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8))}px`;
        menu.style.top = `${r.bottom + 6}px`;
        classMenu = menu;
        btn.setAttribute('aria-expanded', 'true');
        list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
        document.addEventListener('pointerdown', onClassMenuOutside, true);
        document.addEventListener('keydown', onClassMenuKey, true);
    }
    window.addEventListener('resize', closeClassMenu);
    on('new-plan-btn', 'click', newPlan);
    on('new-plan-csv-btn', 'click', newPlanFromList);

    /* ----- Plan aus einer Namensliste (CSV) ----- */

    /** Datei als Text lesen: UTF-8, sonst Windows-Kodierung (typisch für Excel-CSV) */
    function readTextFile(file) {
        return file.arrayBuffer().then(buf => {
            let text;
            try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
            catch { text = new TextDecoder('windows-1252').decode(buf); }
            return text.replace(/^\uFEFF/, '');
        });
    }

    /** Einfacher CSV-Leser mit Anführungszeichen; Trennzeichen wird erkannt (; , Tab) */
    function parseCSV(text) {
        const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim());
        if (!lines.length) return [];
        const sample = lines.slice(0, 5).join('\n');
        const count = ch => sample.split(ch).length - 1;
        const delim = [';', '\t', ','].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ';');
        return lines.map(line => {
            const cells = [];
            let cur = '';
            let quoted = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (quoted) {
                    if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
                    else if (ch === '"') quoted = false;
                    else cur += ch;
                } else if (ch === '"') quoted = true;
                else if (ch === delim) { cells.push(cur.trim()); cur = ''; }
                else cur += ch;
            }
            cells.push(cur.trim());
            return cells;
        });
    }

    /**
     * Vornamen eindeutig machen: Bei gleichen Vornamen so viele Buchstaben des
     * Nachnamens anhängen, bis sich die Kinder unterscheiden („Max Kra.“, „Max Krü.“).
     */
    function displayNames(people) {
        const unique = displayNamesOrdered(people);
        const result = unique.slice().sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
        result.lastNames = Object.fromEntries(unique.map((n, i) => [n, people[i].last]).filter(e => e[1]));   // für „In Reihenfolge“
        return result;
    }
    /** Anzeigenamen in der Reihenfolge der Personen */
    function displayNamesOrdered(people) {
        const key = s => s.toLocaleLowerCase('de');
        const groups = new Map();
        people.forEach(p => {
            const k = key(p.first);
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(p);
        });
        const shown = new Map();
        groups.forEach(group => {
            if (group.length === 1) { shown.set(group[0], group[0].first); return; }
            group.forEach(p => {
                const others = group.filter(o => o !== p).map(o => key(o.last));
                const last = p.last;
                let name = null;
                for (let n = 1; n <= last.length; n++) {
                    const prefix = key(last.slice(0, n));
                    if (!others.some(o => o.startsWith(prefix))) {
                        name = n === last.length ? `${p.first} ${last}` : `${p.first} ${last.slice(0, n)}.`;
                        break;
                    }
                }
                shown.set(p, name || `${p.first} ${last}`.trim());
            });
        });
        const names = people.map(p => shown.get(p));
        // gleiche Vor- und Nachnamen: durchnummerieren
        const seen = new Map();
        const unique = names.map(n => {
            const c = (seen.get(n) || 0) + 1;
            seen.set(n, c);
            return c === 1 ? n : `${n} (${c})`;
        });
        return unique;
    }

    /* ----- Excel (.xlsx) direkt lesen – ohne Bibliothek, nur im Browser ----- */
    async function inflateRaw(bytes) {
        if (!window.DecompressionStream) throw new Error('Entpacken wird von diesem Browser nicht unterstützt');
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    /** Dateien aus einem ZIP-Archiv (xlsx ist ein ZIP) → { Pfad: Uint8Array } */
    async function unzip(buf, wanted) {
        const u8 = new Uint8Array(buf);
        const dv = new DataView(buf);
        let eocd = -1;
        for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) {
            if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error('keine ZIP-Datei');
        const count = dv.getUint16(eocd + 10, true);
        let p = dv.getUint32(eocd + 16, true);
        const out = {};
        const dec = new TextDecoder();
        for (let n = 0; n < count; n++) {
            if (dv.getUint32(p, true) !== 0x02014b50) break;
            const method = dv.getUint16(p + 10, true);
            const csize = dv.getUint32(p + 20, true);
            const nameLen = dv.getUint16(p + 28, true);
            const extraLen = dv.getUint16(p + 30, true);
            const comLen = dv.getUint16(p + 32, true);
            const local = dv.getUint32(p + 42, true);
            const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
            p += 46 + nameLen + extraLen + comLen;
            if (!wanted(name)) continue;
            const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
            const data = u8.subarray(start, start + csize);
            out[name] = method === 0 ? data : await inflateRaw(data);
        }
        return out;
    }
    /** Erstes Tabellenblatt einer .xlsx-Datei als Zeilen mit Zellen (Text) */
    async function parseXLSX(buf) {
        const files = await unzip(buf, n => /^xl\/(sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml)$/.test(n));
        const dec = new TextDecoder();
        const xml = name => (files[name] ? new DOMParser().parseFromString(dec.decode(files[name]), 'application/xml') : null);
        const shared = [];
        const ss = xml('xl/sharedStrings.xml');
        if (ss) [...ss.getElementsByTagName('si')].forEach(si => shared.push([...si.getElementsByTagName('t')].map(t => t.textContent).join('')));
        // erstes Blatt laut Arbeitsmappe (sonst sheet1.xml)
        let sheetPath = 'xl/worksheets/sheet1.xml';
        const wb = xml('xl/workbook.xml');
        const rels = xml('xl/_rels/workbook.xml.rels');
        const first = wb && wb.getElementsByTagName('sheet')[0];
        if (first && rels) {
            const rid = first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
            const rel = [...rels.getElementsByTagName('Relationship')].find(r => r.getAttribute('Id') === rid);
            if (rel) {
                const t = rel.getAttribute('Target').replace(/^\/?(xl\/)?/, '');
                if (files[`xl/${t}`]) sheetPath = `xl/${t}`;
            }
        }
        if (!files[sheetPath]) sheetPath = Object.keys(files).find(k => k.startsWith('xl/worksheets/')) || sheetPath;
        const sheetDoc = xml(sheetPath);
        if (!sheetDoc) throw new Error('kein Tabellenblatt');
        const colIndex = ref => {
            const letters = (ref.match(/^[A-Z]+/) || ['A'])[0];
            return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
        };
        return [...sheetDoc.getElementsByTagName('row')].map(row => {
            const cells = [];
            [...row.getElementsByTagName('c')].forEach((c, i) => {
                const ref = c.getAttribute('r');
                const col = ref ? colIndex(ref) : i;
                const type = c.getAttribute('t');
                const v = c.getElementsByTagName('v')[0];
                let text = '';
                if (type === 's' && v) text = shared[Number(v.textContent)] || '';
                else if (type === 'inlineStr') text = [...c.getElementsByTagName('t')].map(t => t.textContent).join('');
                else if (v) text = v.textContent;
                cells[col] = String(text).trim();
            });
            return Array.from(cells, x => x || '');
        }).filter(r => r.some(Boolean));
    }

    /** Spalten für Nach- und Vorname finden – über eine Kopfzeile (auch unter Titelzeilen), sonst Spalte 1 und 2 */
    function peopleFromRows(rows) {
        const isLast = t => /^(nach|familien|schüler)?name$|^nachname|^familienname/i.test(t.trim());
        const isFirst = t => /^(vorname|rufname)/i.test(t.trim());
        let last = 0;
        let first = 1;
        let start = 0;
        for (let i = 0; i < Math.min(rows.length, 15); i++) {
            const r = rows[i].map(x => String(x || ''));
            const fi = r.findIndex(isFirst);
            const li = r.findIndex((t, k) => k !== fi && isLast(t));
            if (fi >= 0 && li >= 0) { first = fi; last = li; start = i + 1; break; }
        }
        return rows.slice(start)
            .map(r => ({ last: String(r[last] || '').replace(/\s+/g, ' ').trim(), first: String(r[first] || '').replace(/\s+/g, ' ').trim() }))
            .filter(p => p.first && !isFirst(p.first));
    }

    async function newPlanFromList() {
        closeDrawer();
        await commitNames(true);
        const go = await sheet({
            title: 'Klasse als Liste importieren',
            text: 'Wähle eine Excel-Liste (.xlsx) oder CSV-Datei mit den Namen der Klasse – z. B. die Klassenliste, die Du im Infoportal bzw. in der Schulverwaltung herunterlädst. Die Datei wird nur hier im Browser gelesen.',
            lines: [
                'Spalten „Nachname“ und „Vorname“ (bzw. „Rufname“) werden automatisch erkannt.',
                'Ohne Kopfzeile: 1. Spalte Nachname, 2. Spalte Vorname.',
                'Alle weiteren Spalten werden ignoriert.'
            ],
            buttons: [{ label: 'Abbrechen', value: false }, { label: 'Liste auswählen', value: true, kind: 'primary' }]
        });
        if (!go) return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.csv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            let rows;
            if (/\.xls$/i.test(file.name)) {
                ui.alert('Altes Excel-Format', 'Dateien im alten Format .xls kann PlanPad nicht lesen. Bitte in Excel oder Numbers als .xlsx oder .csv speichern.');
                return;
            }
            try {
                const buf = await file.arrayBuffer();
                const head = new Uint8Array(buf.slice(0, 2));
                rows = (head[0] === 0x50 && head[1] === 0x4b) ? await parseXLSX(buf) : parseCSV(await readTextFile(file));
            } catch (err) {
                console.error(err);
                ui.alert('Datei nicht lesbar', 'Die Datei konnte nicht gelesen werden. Bitte als .xlsx oder .csv speichern und erneut versuchen.');
                return;
            }
            const people = peopleFromRows(rows);
            if (!people.length) {
                ui.alert('Keine Namen gefunden', 'In der Datei wurden keine Vornamen gefunden. Bitte prüfe: Spalten „Nachname“ und „Vorname“ – oder ohne Kopfzeile 1. Spalte Nachname, 2. Spalte Vorname.');
                return;
            }
            const names = displayNames(people);

            const base = file.name.replace(/\.[^.]+$/, '').trim() || 'Neue Klasse';
            const name = await ui.prompt('Klasse anlegen', `${names.length} Namen gefunden. Name der Klasse:`, uniqueName(base), 'Anlegen');
            if (!name) return;
            if (readPlans()[name]) { await ui.alert('Name vergeben', `Eine Klasse „${name}“ gibt es schon.`); return; }

            await commitNames(true);
            if (autosaveTimer) saveCurrentPlan();
            saveDraft();
            noteStudent = null;
            currentName = name;
            selectPlan(null);
            notesMode = false;           // neue Klasse: Gruppenansicht
            loadClass({ students: [...names], lastNames: names.lastNames });
            app.classList.remove('is-editing-names');
            // gleich startklar: Tische anlegen, Zweiertische, einmal mischen
            applyLayout('pairs');
            shuffleSeats();
            renderNotes();
            resetHistory();
            saveCurrentPlan(true);
            const firstKey = p => p.first.toLocaleLowerCase('de');
            const shortened = people.filter(p => people.filter(o => firstKey(o) === firstKey(p)).length > 1).length;
            showToast(`${names.length} Namen übernommen und gemischt` + (shortened ? ` – ${shortened} mit Nachnamen-Kürzel, weil Vornamen doppelt waren.` : '.'), 'ok', 5000);
        });
        openFilePicker(input);
    }
    on('duplicate-plan-btn', 'click', duplicatePlan);

    /* ----- Datei: sichern & öffnen ----- */
    on('save-btn', 'click', () => exportPlans([currentName]));
    on('export-current', 'click', () => { exportPlans([currentName]); closeDrawer(); });
    on('export', 'click', () => { exportPlans(null); closeDrawer(); });
    on('import', 'click', () => { closeDrawer(); importPlans(); });

    function fileSafe(s) {
        return String(s).replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'plan';
    }

    function dateStamp() {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }

    /* ----- Verschlüsselung (Web Crypto, läuft vollständig im Browser) ----- */
    const CRYPTO_ITER = 250000;
    const canEncrypt = Boolean(window.crypto && crypto.subtle && window.TextEncoder);
    const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
    const unb64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));

    async function deriveKey(password, salt, iter) {
        const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
            base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    }

    async function encryptPayload(obj, password) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(password, salt, CRYPTO_ITER);
        // in Stücken kodieren, damit große Dateien btoa nicht sprengen
        const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
        let bin = '';
        for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
        return { alg: 'AES-GCM-256', kdf: 'PBKDF2-SHA256', iter: CRYPTO_ITER, salt: b64(salt), iv: b64(iv), data: btoa(bin) };
    }

    async function decryptPayload(enc, password) {
        const key = await deriveKey(password, unb64(enc.salt), Number(enc.iter) || CRYPTO_ITER);
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(enc.iv) }, key, unb64(enc.data));
        return JSON.parse(new TextDecoder().decode(plain));
    }

    const PHOTO_WARNING = 'Die Datei enthält dann Schülerfotos – das sind personenbezogene Daten. Bitte nicht in Clouds, Messengern oder Lernplattformen ablegen und die Datei spätestens am Ende des Schuljahres löschen.';

    /** names = null → alle Pläne */
    async function exportPlans(names) {
        saveCurrentPlan();
        const plans = readPlans();
        const keys = names ? names.filter(n => plans[n]) : Object.keys(plans);
        if (!keys.length) {
            ui.alert('Nichts zu sichern', 'Es gibt noch keine gespeicherte Klasse.');
            return;
        }
        await facesReady.catch(() => {});
        // nur Fotos, die zu den gesicherten Plänen gehören
        const photosByPlan = {};
        let photoTotal = 0;
        keys.forEach(k => {
            const m = facesByPlan.get(plans[k].id);
            if (!m) return;
            const kids = new Set(plans[k].students || []);
            const own = [...m].filter(([n]) => kids.has(n));
            if (own.length) { photosByPlan[k] = Object.fromEntries(own); photoTotal += own.length; }
        });
        const photoNames = { length: photoTotal };
        const notesByPlan = {};
        let noteTotal = 0;
        keys.forEach(k => {
            const own = notesOfPlan(plans[k].id);
            const kids = new Set(plans[k].students || []);
            const keep = Object.fromEntries(Object.entries(own).filter(([n, arr]) => (kids.has(n) || n === CLASS_KEY) && arr && arr.length));
            const c = Object.values(keep).reduce((t, a) => t + a.length, 0);
            if (c) { notesByPlan[k] = keep; noteTotal += c; }
        });

        // Dialog: Fotos ja/nein, Passwort optional
        let withPhotos = false;
        const content = document.createElement('div');
        if (photoNames.length) {
            const row = document.createElement('div');
            row.className = 'pp-setting-row';
            row.style.margin = '6px 0 10px';
            row.innerHTML = `<span>Fotos einschließen (${photoNames.length})</span>`;
            const seg = document.createElement('div');
            seg.className = 'pp-segmented pp-segmented-small';
            const warn = document.createElement('p');
            warn.className = 'pp-warnbox';
            warn.textContent = PHOTO_WARNING;
            warn.hidden = true;
            const mk = (label, val) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = label;
                btn.setAttribute('aria-pressed', String(val === withPhotos));
                btn.addEventListener('click', () => {
                    withPhotos = val;
                    seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === btn)));
                    warn.hidden = !val;
                    pwHint.textContent = (val || withNotes) ? 'Bei Fotos oder Notizen dringend empfohlen.' : 'Optional.';
                });
                return btn;
            };
            seg.append(mk('Nein', false), mk('Ja', true));
            row.appendChild(seg);
            content.append(row, warn);
        }
        let withNotes = false;
        // Sterne und Beobachtungen sind ebenso persönliche Daten: nur zusammen mit den Notizen sichern
        const extraTotal = keys.reduce((t, k) => {
            const pl = plans[k];
            const v = pl.votes && typeof pl.votes === 'object' ? Object.values(pl.votes) : [];
            return t + ((pl.observ && Array.isArray(pl.observ.periods)) ? pl.observ.periods.length : 0)
                + (Array.isArray(pl.absences) ? pl.absences.length : 0)
                + v.reduce((a, r) => a + Object.values(r || {}).reduce((b, x) => b + (Array.isArray(x) ? x.length : 0), 0), 0);
        }, 0);
        if (noteTotal || extraTotal) {
            const row = document.createElement('div');
            row.className = 'pp-setting-row';
            row.style.margin = '6px 0 10px';
            row.innerHTML = extraTotal
                ? `<span>Notizen, Sterne, Beobachtungen und Fehlzeiten einschließen (${noteTotal + extraTotal})</span>`
                : `<span>Notizen einschließen (${noteTotal})</span>`;
            const seg = document.createElement('div');
            seg.className = 'pp-segmented pp-segmented-small';
            const warn = document.createElement('p');
            warn.className = 'pp-warnbox';
            warn.textContent = 'Die Datei enthält dann Notizen und Noten zu einzelnen SuS – besonders schützenswerte Daten. Bitte nur verschlüsselt sichern, nicht in Clouds, Messengern oder Lernplattformen ablegen und spätestens am Ende des Schuljahres löschen.';
            warn.hidden = true;
            const mk = (label, val) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = label;
                btn.setAttribute('aria-pressed', String(val === withNotes));
                btn.addEventListener('click', () => {
                    withNotes = val;
                    seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === btn)));
                    warn.hidden = !val;
                    pwHint.textContent = (val || withPhotos) ? 'Bei Fotos oder Notizen dringend empfohlen.' : 'Optional.';
                });
                return btn;
            };
            seg.append(mk('Nein', false), mk('Ja', true));
            row.appendChild(seg);
            content.append(row, warn);
        }
        const pwLabel = document.createElement('label');
        pwLabel.className = 'pp-field';
        pwLabel.style.marginTop = '8px';
        pwLabel.textContent = 'Passwort für die Datei';
        const pw = document.createElement('input');
        pw.type = 'password';
        pw.autocomplete = 'new-password';
        pw.placeholder = canEncrypt ? 'leer lassen = ohne Passwort' : 'in diesem Browser nicht verfügbar';
        pw.disabled = !canEncrypt;
        pwLabel.appendChild(pw);
        const pwHint = document.createElement('p');
        pwHint.className = 'pp-hint';
        pwHint.textContent = 'Optional.';
        content.append(pwLabel, pwHint);

        const go = await sheet({
            title: keys.length === 1 ? `„${keys[0]}“ als Datei sichern` : `${keys.length} Klassen als Datei sichern`,
            text: 'Mit Passwort wird die Datei verschlüsselt (AES, direkt auf diesem Gerät). Ohne das Passwort lässt sie sich nicht öffnen – es gibt keine Wiederherstellung.',
            content,
            buttons: [{ label: 'Abbrechen', value: false }, { label: 'Sichern', value: true, kind: 'primary' }]
        });
        if (!go) return;
        const password = pw.value;

        const out = {};
        keys.forEach(k => {
            out[k] = plans[k];
            if (!withNotes) { const { observ: _o, votes: _v, absences: _a, ...rest } = plans[k]; out[k] = rest; }
        });
        const payload = { plans: out };
        const tpls = readTemplates();
        if (tpls.length) payload.templates = tpls;          // nur Tischpositionen
        payload.catTemplate = catTemplate();                // Vorlage der Sterne-Kategorien (nur Namen/Einstellungen)
        if (noteKinds().length > NOTE_KINDS_BASE.length) payload.noteKinds = noteKinds().slice(NOTE_KINDS_BASE.length);
        if (withPhotos) payload.facesByPlan = photosByPlan;
        if (withNotes) payload.notesByPlan = notesByPlan;
        const base = names && keys.length === 1 ? `planpad_${fileSafe(keys[0])}` : 'planpad_alle-klassen';
        const filename = `${base}${withPhotos ? '_mit-fotos' : ''}${withNotes ? '_mit-notizen' : ''}${password ? '_verschluesselt' : ''}_${dateStamp()}.json`;

        let file;
        try {
            file = password
                ? { app: 'PlanPad', version: 4, exportDate: new Date().toISOString(), encrypted: await encryptPayload(payload, password) }
                : { app: 'PlanPad', version: 4, exportDate: new Date().toISOString(), ...payload };
        } catch (err) {
            console.error(err);
            ui.alert('Verschlüsseln fehlgeschlagen', 'Die Datei konnte nicht verschlüsselt werden.');
            return;
        }
        downloadJSON(file, filename);

        const now = new Date().toISOString();
        keys.forEach(k => { plans[k].exportedAt = now; });
        writePlans(plans);
        renderPlanHeader();
        const what = keys.length === 1 ? `„${keys[0]}“` : `${keys.length} Klassen`;
        showToast(`${what} als Datei gesichert – ${withPhotos ? `mit ${photoNames.length} Fotos` : 'ohne Fotos'}, ${withNotes ? `mit ${noteTotal} Notizen` : 'ohne Notizen'}${password ? ', verschlüsselt' : ''}.`, 'ok', 4000);
    }

    function downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    /** Liest PlanPad-Dateien und Exporte der alten Sitzplan-App. */
    function extractPlans(data) {
        const result = {};
        if (!data || typeof data !== 'object' || !data.plans || typeof data.plans !== 'object') return result;
        const isPlan = p => p && typeof p === 'object' && (Array.isArray(p.squares) || Array.isArray(p.seatings));
        for (let [key, value] of Object.entries(data.plans)) {
            if (typeof value === 'string') {
                try { value = JSON.parse(value); } catch { continue; }
            }
            if (isPlan(value)) result[key] = value;
            else if (value && typeof value === 'object') {
                for (const [name, plan] of Object.entries(value)) if (isPlan(plan)) result[name] = plan;
            }
        }
        return result;
    }

    /** Inhalt einer Sicherungsdatei übernehmen (auch für die Demoklasse) */
    async function importBackupText(text, { demo = false } = {}) {
        let reader = { result: text };
        let data;
        try { data = JSON.parse(reader.result); } catch {
            ui.alert('Datei nicht lesbar', 'Das ist keine PlanPad-Datei.');
            return;
        }
        if (data && data.encrypted) {
            if (!canEncrypt) {
                ui.alert('Verschlüsselte Datei', 'Dieser Browser kann verschlüsselte Dateien nicht öffnen.');
                return;
            }
            for (;;) {
                const password = await ui.prompt('Verschlüsselte Datei', 'Passwort', '', 'Öffnen', 'password');
                if (password === null) return;
                try {
                    data = await decryptPayload(data.encrypted, password);
                    break;
                } catch {
                    await ui.alert('Falsches Passwort', 'Mit diesem Passwort lässt sich die Datei nicht öffnen.');
                }
            }
        }
        const incoming = extractPlans(data);
        const names = Object.keys(incoming);
        if (!names.length) {
            ui.alert('Keine Klassen gefunden', 'In dieser Datei sind keine Klassen oder Sitzpläne enthalten.');
            return;
        }
        saveCurrentPlan();
        const plans = readPlans();
        const clashes = names.filter(n => plans[n]);
        let mode = 'copy';
        if (clashes.length) {
            mode = await sheet({
                title: 'Klassen gibt es schon',
                text: 'Diese Klassen sind bereits auf dem Gerät:',
                lines: clashes,
                buttons: [
                    { label: 'Abbrechen', value: null },
                    { label: 'Als Kopie behalten', value: 'copy' },
                    { label: 'Überschreiben', value: 'overwrite', kind: 'danger' }
                ]
            });
            if (!mode) return;
        }
        const importedNames = [];
        const targetOf = {};          // Name in der Datei → Ziel-Plan auf dem Gerät
        const now = new Date().toISOString();
        names.forEach(name => {
            let target = name;
            if (plans[name] && mode === 'copy') {
                target = `${name} (Import)`;
                let i = 2;
                while (plans[target]) target = `${name} (Import ${i++})`;
            }
            // überschriebener Plan behält seine ID (und damit seine Fotos), sonst neue ID
            const id = (plans[target] && plans[target].id) || newId();
            plans[target] = { ...incoming[name], id, name: target, version: 4, seatings: seatingsOf(incoming[name]), timestamp: incoming[name].timestamp || now, exportedAt: now };
            importedNames.push(target);
            targetOf[name] = plans[target];
        });
        writePlans(plans);
        renderPlanList();
        if (importedNames.includes(currentName)) {
            // der geöffnete Plan wurde ersetzt: auch seine ID (Fotos, Notizen) übernehmen
            selectPlan(plans[currentName].id);
            noteStudent = null;
            loadClass(plans[currentName]);
            app.classList.toggle('is-editing-names', !students.length);
            resetHistory();
        }
        // Fotos aus der Datei übernehmen
        let photoCount = 0;
        const isImg = url => typeof url === 'string' && url.startsWith('data:image/');
        // [Ziel-Plan-ID, Name, Foto]
        const incomingFaces = [];
        if (data.facesByPlan && typeof data.facesByPlan === 'object') {
            Object.entries(data.facesByPlan).forEach(([planName, map]) => {
                const t = targetOf[planName];
                if (!t || !map || typeof map !== 'object') return;
                Object.entries(map).forEach(([n, url]) => { if (isImg(url)) incomingFaces.push([t.id, n, url]); });
            });
        } else if (data.faces && typeof data.faces === 'object') {
            // Dateien aus PlanPad 1.3.0: Fotos nur nach Namen – den importierten Plänen zuordnen
            Object.entries(data.faces).forEach(([n, url]) => {
                if (!isImg(url)) return;
                Object.values(targetOf).forEach(t => { if ((t.students || []).includes(n)) incomingFaces.push([t.id, n, url]); });
            });
        }
        if (incomingFaces.length) {
            await facesReady.catch(() => {});
            const existing = (id, n) => facesByPlan.get(id) && facesByPlan.get(id).get(n);
            const conflicts = incomingFaces.filter(([id, n, url]) => existing(id, n) && existing(id, n) !== url);
            let replace = true;
            if (conflicts.length) {
                replace = await sheet({
                    title: 'Fotos gibt es schon',
                    text: `Für ${conflicts.length} SuS ist in dieser Klasse bereits ein anderes Foto gespeichert:`,
                    lines: conflicts.map(([, n]) => n),
                    buttons: [{ label: 'Vorhandene behalten', value: false }, { label: 'Ersetzen', value: true, kind: 'primary' }]
                }) === true;
            }
            incomingFaces.forEach(([id, n, url]) => {
                const old = existing(id, n);
                if (old === url || (old && !replace)) return;
                setFace(n, url, id);
                photoCount++;
            });
            renderStudentList();
            squares.forEach(applyFace);
        }
        // Sterne-Kategorien und Notiz-Arten ergänzen (vorhandene bleiben)
        const tplIn = Array.isArray(data.catTemplate) ? data.catTemplate : Array.isArray(data.ratingCats) ? data.ratingCats : null;
        if (tplIn) {
            const mine = catTemplate();
            const add = tplIn.map(normCat).filter(c => c && !['soz'].includes(c.id) && !mine.some(m => m.id === c.id || m.name === c.name));
            if (add.length) writeCatTemplate([...mine, ...add]);
        }
        if (Array.isArray(data.noteKinds)) data.noteKinds.forEach(k => { if (typeof k === 'string' && k.trim()) addNoteKind(k.trim().slice(0, 30)); });
        // eigene Vorlagen übernehmen (ohne doppelte)
        if (Array.isArray(data.templates)) {
            const mine = readTemplates();
            const known = new Set(mine.map(t => t.id));
            const add = data.templates.filter(t => t && t.id && !known.has(t.id) && Array.isArray(t.positions) && t.positions.length)
                .map(t => ({ id: String(t.id), name: String(t.name || 'Vorlage'), positions: t.positions.map(p => ({ x: snap(Number(p.x) || 0), y: snap(Number(p.y) || 0) })), created: t.created }));
            if (add.length) writeTemplates([...mine, ...add]);
        }
        // Notizen aus der Datei übernehmen (ohne doppelte)
        let noteCount = 0;
        if (data.notesByPlan && typeof data.notesByPlan === 'object') {
            const all = readAllNotes();
            Object.entries(data.notesByPlan).forEach(([planName, byStudent]) => {
                const t = targetOf[planName];
                if (!t || !byStudent || typeof byStudent !== 'object') return;
                const pl = all[t.id] || (all[t.id] = {});
                Object.entries(byStudent).forEach(([n, arr]) => {
                    if (!Array.isArray(arr)) return;
                    const mine = pl[n] || (pl[n] = []);
                    arr.forEach(note => {
                        if (!note || !note.id || mine.some(x => x.id === note.id)) return;
                        const copy = { id: String(note.id), ts: note.ts, lesson: String(note.lesson || ''), grade: String(note.grade || ''), remark: String(note.remark || '') };
                        if (note.text) copy.text = String(note.text);
                        if (note.kind) copy.kind = String(note.kind).slice(0, 30);
                        if (note.unread) copy.unread = true;
                        mine.push(copy);
                        noteCount++;
                    });
                });
            });
            writeAllNotes(all);
        }
        if (importedNames.length === 1) await openPlan(importedNames[0]);
        renderNotes();
        refreshMarks();
        if (demo) return;
        showToast(`${countText(importedNames.length, 'Klasse', 'Klassen')} geöffnet` + (photoCount ? ` – ${photoCount} Fotos` : '') + (noteCount ? ` – ${noteCount} Notizen` : '') + ' übernommen. Zu finden im Menü unter „Klassen“.', 'ok', 4000);
        renderPlanHeader();
    }
    /**
     * Datei-Auswahl öffnen. Das Feld hängt dabei unsichtbar in der Seite: Auf iPad/iPhone
     * (v. a. als Home-Bildschirm-App) kommt die Auswahl sonst manchmal nicht an – „es passiert nichts“.
     */
    function openFilePicker(input) {
        input.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
        input.setAttribute('aria-hidden', 'true');
        input.tabIndex = -1;
        document.body.appendChild(input);
        const done = () => setTimeout(() => input.remove(), 1000);
        input.addEventListener('change', done, { once: true });
        input.addEventListener('cancel', done, { once: true });
        input.click();
    }

    function importPlans() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json,text/json,text/plain';
        input.addEventListener('change', () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async () => { try { await importBackupText(reader.result); } catch (err) {
                console.error(err);
                ui.alert('Datei konnte nicht geöffnet werden', `Beim Einlesen ist ein Fehler aufgetreten: ${err && err.message ? err.message : err}`);
            } };
            reader.onerror = () => ui.alert('Datei nicht lesbar', 'Die Datei konnte nicht gelesen werden. Liegt sie in iCloud und ist noch nicht geladen? Bitte in der Dateien-App einmal öffnen und erneut versuchen.');
            reader.readAsText(file);
        });
        openFilePicker(input);
    }

    /* ==================================================
       Menü (Schublade)
       ================================================== */
    const drawer = $('drawer');
    function openDrawer() {
        if (selecting) endSelection();
        renderPlanList();
        app.classList.add('drawer-open');
        drawer.removeAttribute('inert');
        $('drawer-close').focus({ preventScroll: true });
    }
    function closeDrawer() {
        app.classList.remove('drawer-open');
        drawer.setAttribute('inert', '');
    }
    on('menu-btn', 'click', openDrawer);
    on('drawer-close', 'click', closeDrawer);
    on('drawer-backdrop', 'click', closeDrawer);
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape' || document.querySelector('.pp-sheet-layer')) return;
        if (app.classList.contains('presenting')) exitPresent();
        else if (app.classList.contains('drawer-open')) closeDrawer();
        else if (selecting) endSelection();
        else setActiveTable(null);
    });

    /* ----- Darstellung: Hell / Dunkel / System ----- */
    function getThemeChoice() {
        try { return localStorage.getItem(KEY_THEME) || 'auto'; } catch { return 'auto'; }
    }
    function applyTheme() {
        const c = getThemeChoice();
        const eff = c === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : c;
        document.documentElement.dataset.theme = c;
        document.documentElement.dataset.effective = eff;
        document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', eff === 'dark' ? '#151922' : '#F3F5F9'));
        document.querySelectorAll('#theme-switch [data-theme-choice]').forEach(b =>
            b.setAttribute('aria-pressed', String(b.dataset.themeChoice === c)));
    }
    /* Farbthema (Akzentfarbe): Blau (Standard) + 4 Pastell-Varianten */
    const KEY_ACCENT = 'planpad.accent';
    const ACCENTS = [
        { id: 'blau', name: 'Blau', dark: '#3157F5', light: '#E3E9FF' },
        { id: 'mint', name: 'Mint', dark: '#1D8466', light: '#D3F2E6' },
        { id: 'rose', name: 'Rosé', dark: '#C0397A', light: '#FBDDEA' },
        { id: 'lavendel', name: 'Lavendel', dark: '#6B4BD6', light: '#E8E0FF' },
        { id: 'apricot', name: 'Apricot', dark: '#C0571B', light: '#FDE3D0' }
    ];
    function applyAccent(id) {
        const a = ACCENTS.find(x => x.id === id) ? id : 'blau';
        if (a === 'blau') document.documentElement.removeAttribute('data-accent');
        else document.documentElement.dataset.accent = a;
        document.querySelectorAll('#accent-switch [data-accent-choice]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.accentChoice === a)));
    }
    {
        const box = $('accent-switch');
        if (box) {
            ACCENTS.forEach(a => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'pp-accent-dot';
                b.dataset.accentChoice = a.id;
                b.title = `Farbe ${a.name}`;
                b.setAttribute('aria-label', `Farbthema ${a.name}`);
                b.style.setProperty('--dot-ring', a.dark);
                b.style.setProperty('--dot-fill', a.light);
                b.addEventListener('click', () => {
                    try { localStorage.setItem(KEY_ACCENT, a.id); } catch { /* egal */ }
                    applyAccent(a.id);
                });
                box.appendChild(b);
            });
        }
        let saved = 'blau';
        try { saved = localStorage.getItem(KEY_ACCENT) || 'blau'; } catch { /* egal */ }
        applyAccent(saved);
    }
    document.querySelectorAll('#theme-switch [data-theme-choice]').forEach(b => b.addEventListener('click', () => {
        try { localStorage.setItem(KEY_THEME, b.dataset.themeChoice); } catch { /* egal */ }
        applyTheme();
    }));
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
    applyTheme();

    /* ==================================================
       Klassenfoto: Gesichter zuordnen (nur lokal)
       ================================================== */
    const FACE_PX = 200;

    const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);

    /** Fotos des Plans mit dieser ID zur aktuellen Ansicht machen */
    function selectPlan(id) {
        currentPlanId = id || newId();
        if (!facesByPlan.has(currentPlanId)) facesByPlan.set(currentPlanId, new Map());
        faces = facesByPlan.get(currentPlanId);
    }

    function totalFaceCount() {
        let n = 0;
        facesByPlan.forEach(m => { n += m.size; });
        return n;
    }

    const faceStore = (() => {
        let dbPromise = null;
        function open() {
            if (!dbPromise) {
                dbPromise = new Promise((resolve, reject) => {
                    if (!window.indexedDB) { reject(new Error('IndexedDB fehlt')); return; }
                    const req = indexedDB.open('sitzplan-fotos', 1);
                    req.onupgradeneeded = () => req.result.createObjectStore('faces');
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
            }
            return dbPromise;
        }
        async function run(mode, fn) {
            const db = await open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('faces', mode);
                const req = fn(tx.objectStore('faces'));
                tx.oncomplete = () => resolve(req && req.result);
                tx.onerror = () => reject(tx.error);
            });
        }
        return {
            async loadAll() {
                const keys = await run('readonly', s => s.getAllKeys());
                const values = await run('readonly', s => s.getAll());
                return keys.map((k, i) => [k, values[i]]);
            },
            put: (key, url) => run('readwrite', s => s.put(url, key)),
            remove: key => run('readwrite', s => s.delete(key)),
            clear: () => run('readwrite', s => s.clear()),
            /** alle Fotos eines Plans löschen */
            async removePlan(id) {
                const keys = await run('readonly', s => s.getAllKeys());
                const mine = keys.filter(k => Array.isArray(k) && k[0] === id);
                if (mine.length) await run('readwrite', s => { mine.forEach(k => s.delete(k)); return null; });
            }
        };
    })();

    let faceWarned = false;
    function setFace(name, url, planId = currentPlanId) {
        if (!facesByPlan.has(planId)) facesByPlan.set(planId, new Map());
        const m = facesByPlan.get(planId);
        if (url) m.set(name, url);
        else m.delete(name);
        const key = [planId, name];
        (url ? faceStore.put(key, url) : faceStore.remove(key)).catch(err => {
            console.error(err);
            if (!faceWarned) {
                faceWarned = true;
                showToast('Fotos können in diesem Browser nicht dauerhaft gespeichert werden (privates Fenster?).', 'warn', 6000);
            }
        });
        if (planId === currentPlanId) squares.forEach(sq => { if (sq.dataset.student === name) applyFace(sq); });
    }

    /** Fotos eines Plans in einen anderen Plan kopieren */
    function copyFaces(fromId, toId, onlyNames = null) {
        const src = facesByPlan.get(fromId);
        if (!src) return;
        [...src].forEach(([n, url]) => { if (!onlyNames || onlyNames.includes(n)) setFace(n, url, toId); });
    }

    /* ----- Fotos ein/aus ----- */
    let showPhotos = true;
    try { showPhotos = localStorage.getItem(KEY_PHOTOS) !== 'off'; } catch { /* egal */ }
    function applyPhotoVisibility() {
        document.body.classList.toggle('hide-photos', !showPhotos);
        document.querySelectorAll('#photo-switch [data-photos]').forEach(b =>
            b.setAttribute('aria-pressed', String((b.dataset.photos === 'on') === showPhotos)));
    }
    document.querySelectorAll('#photo-switch [data-photos]').forEach(b => b.addEventListener('click', () => {
        showPhotos = b.dataset.photos === 'on';
        try { localStorage.setItem(KEY_PHOTOS, showPhotos ? 'on' : 'off'); } catch { /* egal */ }
        applyPhotoVisibility();
    }));
    applyPhotoVisibility();

    on('clear-faces', 'click', async () => {
        closeDrawer();
        if (!faces.size) { showToast('Diese Klasse hat keine Fotos.'); return; }
        if (!await ui.confirm('Fotos dieser Klasse löschen?', `${faces.size} Gesichtsausschnitte von „${currentName}“ werden von diesem Gerät gelöscht. Fotos anderer Klassen bleiben erhalten.`, 'Löschen', true)) return;
        faces.clear();
        faceStore.removePlan(currentPlanId).catch(console.error);
        squares.forEach(applyFace);
        renderStudentList();
        showToast('Fotos dieser Klasse gelöscht.', 'ok');
    });

    /** Foto auswählen oder aufnehmen (iPad bietet beides an) und lokal öffnen */
    function pickImage(onReady) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => onReady(img, url);
            img.onerror = () => {
                URL.revokeObjectURL(url);
                ui.alert('Bild nicht lesbar', 'Das Bild konnte nicht geöffnet werden.');
            };
            img.src = url;
        });
        openFilePicker(input);
    }

    on('class-photo', 'click', () => {
        closeDrawer();
        if (!students.length) { needStudents(); return; }
        pickImage((img, url) => openFaceMode(img, url));
    });

    /** Kärtchen antippen: Foto für einzelne SuS aufnehmen, ersetzen oder entfernen */
    async function openStudentSheet(name) {
        const has = faces.has(name);
        const content = document.createElement('div');
        if (has) {
            const img = document.createElement('img');
            img.src = faces.get(name);
            img.alt = '';
            img.style.cssText = 'width:96px;height:96px;border-radius:16px;object-fit:cover;display:block;margin:4px 0 8px';
            content.appendChild(img);
        }
        const buttons = [{ label: 'Abbrechen', value: null }];
        if (has) buttons.push({ label: 'Foto entfernen', value: 'remove', kind: 'danger' });
        buttons.push({ label: has ? 'Neues Foto' : 'Foto hinzufügen', value: 'photo', kind: 'primary' });
        const full = fullName(name);
        const choice = await sheet({
            title: full,
            text: has
                ? 'Dieses Foto ist auf diesem Gerät gespeichert.'
                : 'Noch kein Foto. Nimm ein Foto auf oder wähle eines aus der Mediathek – danach schiebst du den Rahmen auf das Gesicht.',
            content,
            buttons
        });
        if (choice === 'remove') {
            setFace(name, null);
            renderStudentList();
            refreshNoteAvatar();
            showToast(`Foto von ${name} entfernt.`, 'ok', 2000);
        } else if (choice === 'photo') {
            pickImage((img, url) => openFaceMode(img, url, name));
        }
    }

    /** onlyName: Einzelfoto für genau diese Person (Rahmen wird automatisch gesetzt) */
    function openFaceMode(img, objectUrl, onlyName = null) {
        if (selecting) endSelection();
        const natW = img.naturalWidth;
        const natH = img.naturalHeight;
        const minSide = Math.min(natW, natH);
        const markers = new Map();    // Name → { cx, cy, size } in Bildpixeln
        let sizeFrac = 0.08;
        let selected = null;
        let zoom = 1;

        const overlay = document.createElement('div');
        overlay.className = 'face-overlay';

        const bar = document.createElement('div');
        bar.className = 'face-toolbar';
        const mkIconBtn = (name, label, fn) => {
            const b = document.createElement('button');
            b.className = 'pp-iconbtn';
            b.setAttribute('aria-label', label);
            b.title = label;
            b.innerHTML = icon(name);
            b.addEventListener('click', fn);
            return b;
        };
        const title = document.createElement('span');
        title.className = 'face-title';
        title.textContent = onlyName ? `Foto für ${onlyName}` : 'Gesichter zuordnen';
        const spacer = document.createElement('div');
        spacer.className = 'pp-topbar-spacer';
        const sizeLabel = document.createElement('label');
        sizeLabel.className = 'face-size';
        sizeLabel.textContent = 'Rahmen';
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '2';
        slider.max = '40';
        slider.step = '0.5';
        slider.value = String(sizeFrac * 100);
        sizeLabel.appendChild(slider);
        const done = document.createElement('button');
        done.className = 'pp-btn pp-btn-primary pp-btn-small';
        done.textContent = 'Fertig';
        done.addEventListener('click', finish);

        bar.append(
            mkIconBtn('close', 'Abbrechen', close), title, spacer,
            mkIconBtn('minus', 'Verkleinern', () => setZoom(zoom / 1.4)),
            mkIconBtn('plus', 'Vergrößern', () => setZoom(zoom * 1.4)),
            sizeLabel, done
        );

        const hint = document.createElement('div');
        hint.className = 'face-hint';
        hint.textContent = onlyName
            ? 'Schiebe den Rahmen auf das Gesicht (oder tippe auf das Gesicht) und passe die Größe mit dem Regler an. Das Foto verlässt dieses Gerät nicht; gespeichert wird nur der kleine Ausschnitt.'
            : 'Ziehe die Namen auf die Gesichter. Rahmen antippen = auswählen (Größe mit dem Regler), verschieben = nachjustieren, doppelt tippen = entfernen. Das Foto verlässt dieses Gerät nicht und wird nicht gespeichert.';

        const pillBox = document.createElement('div');
        pillBox.className = 'face-pills';

        const stage = document.createElement('div');
        stage.className = 'face-stage';
        const canvasBox = document.createElement('div');
        canvasBox.className = 'face-canvas';
        const photo = img.cloneNode();
        photo.className = 'face-photo';
        photo.draggable = false;
        canvasBox.appendChild(photo);
        stage.appendChild(canvasBox);

        overlay.append(bar, hint, pillBox, stage);
        document.body.appendChild(overlay);

        const onKey = e => { if (e.key === 'Escape' && !document.querySelector('.pp-sheet-layer')) close(); };
        document.addEventListener('keydown', onKey);

        function setZoom(z) {
            const fit = Math.min(1, (stage.clientWidth - 2) / natW);
            zoom = Math.max(fit * 0.5, Math.min(4, z));
            photo.style.width = `${natW * zoom}px`;
            photo.style.height = `${natH * zoom}px`;
            canvasBox.style.width = `${natW * zoom}px`;
            canvasBox.style.height = `${natH * zoom}px`;
            renderMarkers();
        }

        function renderPills() {
            pillBox.textContent = '';
            (onlyName ? [onlyName] : students).forEach(name => {
                const pill = makePill(name, 'student-item face-pill');
                pill.classList.toggle('has-face', faces.has(name));
                enablePillDrag(pill, {
                    makeGhost: () => {
                        const g = document.createElement('div');
                        g.className = 'face-ghost';
                        const s = sizeFrac * minSide * zoom;
                        g.style.width = `${s}px`;
                        g.style.height = `${s}px`;
                        const l = document.createElement('span');
                        l.textContent = name;
                        g.appendChild(l);
                        return g;
                    },
                    onDrop: (x, y) => {
                        const p = toImage(x, y);
                        if (!p) return;
                        markers.set(name, clampMarker({ cx: p.x, cy: p.y, size: sizeFrac * minSide }));
                        selected = name;
                        commit(name);
                    }
                });
                pillBox.appendChild(pill);
            });
        }

        function toImage(clientX, clientY) {
            const r = photo.getBoundingClientRect();
            if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
            return { x: (clientX - r.left) / zoom, y: (clientY - r.top) / zoom };
        }

        function clampMarker(m) {
            const size = Math.min(m.size, minSide);
            return {
                size,
                cx: Math.min(natW - size / 2, Math.max(size / 2, m.cx)),
                cy: Math.min(natH - size / 2, Math.max(size / 2, m.cy))
            };
        }

        function cropFace(m) {
            const c = document.createElement('canvas');
            c.width = FACE_PX;
            c.height = FACE_PX;
            const ctx = c.getContext('2d');
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, m.cx - m.size / 2, m.cy - m.size / 2, m.size, m.size, 0, 0, FACE_PX, FACE_PX);
            return c.toDataURL('image/jpeg', 0.85);
        }

        function commit(name) {
            setFace(name, cropFace(markers.get(name)));
            renderMarkers();
            renderPills();
            slider.value = String((markers.get(name).size / minSide) * 100);
        }

        let lastMarkerTap = { name: null, time: 0 };
        function renderMarkers() {
            canvasBox.querySelectorAll('.face-marker').forEach(m => m.remove());
            markers.forEach((m, name) => {
                const el = document.createElement('div');
                el.className = 'face-marker' + (name === selected ? ' is-selected' : '');
                el.style.left = `${(m.cx - m.size / 2) * zoom}px`;
                el.style.top = `${(m.cy - m.size / 2) * zoom}px`;
                el.style.width = `${m.size * zoom}px`;
                el.style.height = `${m.size * zoom}px`;
                const label = document.createElement('span');
                label.textContent = name;
                el.appendChild(label);
                attachMarkerDrag(el, name);
                canvasBox.appendChild(el);
            });
        }

        function attachMarkerDrag(el, name) {
            el.addEventListener('pointerdown', e => {
                if (e.button !== 0) return;
                e.preventDefault();
                if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
                const start = { x: e.clientX, y: e.clientY };
                const orig = { ...markers.get(name) };
                let moved = false;
                const onMove = ev => {
                    const dx = ev.clientX - start.x;
                    const dy = ev.clientY - start.y;
                    if (!moved && Math.hypot(dx, dy) < 4) return;
                    moved = true;
                    const m = clampMarker({ ...orig, cx: orig.cx + dx / zoom, cy: orig.cy + dy / zoom });
                    markers.set(name, m);
                    el.style.left = `${(m.cx - m.size / 2) * zoom}px`;
                    el.style.top = `${(m.cy - m.size / 2) * zoom}px`;
                };
                const onEnd = ev => {
                    el.removeEventListener('pointermove', onMove);
                    el.removeEventListener('pointerup', onEnd);
                    el.removeEventListener('pointercancel', onEnd);
                    if (moved) { selected = name; commit(name); return; }
                    if (ev.type !== 'pointerup') return;
                    const now = Date.now();
                    if (lastMarkerTap.name === name && now - lastMarkerTap.time < 400) {
                        lastMarkerTap = { name: null, time: 0 };
                        markers.delete(name);
                        if (selected === name) selected = null;
                        setFace(name, null);
                        renderMarkers();
                        renderPills();
                    } else {
                        lastMarkerTap = { name, time: now };
                        selected = name;
                        slider.value = String((markers.get(name).size / minSide) * 100);
                        renderMarkers();
                    }
                };
                el.addEventListener('pointermove', onMove);
                el.addEventListener('pointerup', onEnd);
                el.addEventListener('pointercancel', onEnd);
            });
        }

        slider.addEventListener('input', () => {
            sizeFrac = Number(slider.value) / 100;
            if (selected && markers.has(selected)) {
                markers.set(selected, clampMarker({ ...markers.get(selected), size: sizeFrac * minSide }));
                renderMarkers();
            }
        });
        slider.addEventListener('change', () => { if (selected && markers.has(selected)) commit(selected); });

        async function finish() {
            const entries = [...markers]
                .filter(([name]) => students.includes(name))
                .map(([name, m]) => ({ name, ...m }));
            // Ein Ist-Sitzplan aus dem Foto lohnt sich nur, wenn (fast) die ganze Klasse markiert ist.
            // Sonst werden nur die Fotos übernommen – vorhandene Tische und Plätze bleiben unangetastet.
            const enough = entries.length >= 2 && entries.length >= Math.ceil(students.length * 0.75);
            if (enough) {
                const emptyPlan = !squares.some(sq => sq.dataset.student);
                const buttons = [{ label: 'Nur Fotos', value: 'none', kind: emptyPlan ? undefined : 'primary' }];
                if (emptyPlan) buttons.push({ label: 'In diesen Sitzplan', value: 'here', kind: 'primary' });
                buttons.push({ label: 'Als neuen Sitzplan', value: 'new' });
                const choice = await sheet({
                    title: 'Ist-Sitzplan aus dem Foto?',
                    text: `${countText(entries.length, 'Foto ist', 'Fotos sind')} gespeichert. PlanPad kann aus den Positionen auf dem Foto zusätzlich die Sitzordnung erzeugen (Reihen, Banknachbarn und Gänge werden erkannt).`
                        + (emptyPlan ? '' : ' Der aktuelle Sitzplan bleibt dabei unverändert – der Ist-Sitzplan wird als neuer Sitzplan angelegt.'),
                    buttons
                });
                if (choice === null) return;   // zurück zum Foto
                if (choice === 'here' && emptyPlan) await buildPlanFromFaces(entries, false);
                else if (choice === 'new') await buildPlanFromFaces(entries, true);
            } else if (entries.length) {
                showToast(`${countText(entries.length, 'Foto', 'Fotos')} gespeichert – Tische und Plätze bleiben, wie sie sind.`, 'ok', 3000);
            }
            close();
        }

        function close() {
            document.removeEventListener('keydown', onKey);
            overlay.remove();
            URL.revokeObjectURL(objectUrl);
            renderStudentList();
            squares.forEach(applyFace);
            refreshNoteAvatar();
        }

        // Einzelfoto: Antippen setzt den Rahmen an diese Stelle
        if (onlyName) {
            photo.addEventListener('click', e => {
                const p = toImage(e.clientX, e.clientY);
                if (!p || !markers.has(onlyName)) return;
                markers.set(onlyName, clampMarker({ ...markers.get(onlyName), cx: p.x, cy: p.y }));
                commit(onlyName);
            });
        }

        renderPills();
        requestAnimationFrame(() => {
            setZoom(Math.min(1, (stage.clientWidth - 2) / natW, (stage.clientHeight - 2) / natH));
            if (onlyName) {
                sizeFrac = 0.45;
                markers.set(onlyName, clampMarker({ cx: natW / 2, cy: natH * 0.42, size: sizeFrac * minSide }));
                selected = onlyName;
                commit(onlyName);
            }
        });
    }

    function median(arr) {
        const a = [...arr].sort((x, y) => x - y);
        return a.length ? a[Math.floor(a.length / 2)] : 0;
    }

    /**
     * Ist-Sitzplan aus Gesichterpositionen. Foto von vorne (Sicht der Lehrkraft):
     * oben im Bild = hinten im Raum, links im Bild = links im Plan.
     */
    async function buildPlanFromFaces(entries, asNewPlan) {
        const s = median(entries.map(e => e.size)) || 1;
        const sorted = [...entries].sort((a, b) => a.cy - b.cy);
        const rows = [];
        sorted.forEach(e => {
            const row = rows[rows.length - 1];
            const meanY = row ? row.reduce((t, x) => t + x.cy, 0) / row.length : 0;
            if (!row || e.cy - meanY > 0.55 * s) rows.push([e]);
            else row.push(e);
        });

        const { w, h } = tableSize();
        const placed = rows.map(row => {
            row.sort((a, b) => a.cx - b.cx);
            const gaps = row.slice(1).map((e, i) => e.cx - row[i].cx);
            const normal = Math.min(median(gaps) || s, 1.4 * s);
            let x = 0;
            const items = row.map((e, i) => {
                if (i > 0) x += w + TIGHT + (gaps[i - 1] > 1.6 * normal ? 2 * GRID : 0);
                return { name: e.name, x };
            });
            return { items, width: x + w };
        });

        if (asNewPlan) {
            const name = await ui.prompt('Neuer Sitzplan', `Name des Ist-Sitzplans (in „${currentName}“)`, uniqueSeatingName('Istzustand'), 'Anlegen');
            if (!name) return;
            if (seatings.some(st => st.name === name)) { await ui.alert('Name vergeben', `Einen Sitzplan „${name}“ gibt es in dieser Klasse schon.`); return; }
            setActiveTable(null);
            saveCurrentPlan(true);
            const st = { id: newId(), name, layout: '', squares: [] };
            seatings.push(st);
            await switchSeatingDirect(st.id, noteStudent);
        }

        const maxWidth = Math.max(...placed.map(r => r.width));
        removeAllSquares();
        const shiftX = Math.max(MARGIN, snap((layoutViewWidth() - maxWidth) / 2));
        placed.forEach((row, r) => {
            const offset = snap((maxWidth - row.width) / 2);
            row.items.forEach(it => createSquare(shiftX + offset + it.x, MARGIN + r * (h + ROW_GAP), it.name));
        });
        // Kinder, die nicht auf dem Foto sind, bekommen trotzdem einen Tisch (unten angefügt)
        const missing = students.filter(n => !entries.some(e => e.name === n));
        missing.forEach(n => { const p = findFreePosition(); createSquare(p.x, p.y, n); });
        currentLayout = '';
        renderLayoutSwitch();
        refreshMarks();
        scheduleResize();
        changed();
        saveCurrentPlan();
        showWholePlan();

        showToast(`Ist-Sitzplan erstellt (${rows.length} Reihe${rows.length === 1 ? '' : 'n'}).`
            + (missing.length ? ` Nicht auf dem Foto: ${missing.join(', ')} – an eigene Tische gesetzt, bitte von Hand verschieben.` : ''), 'ok', 6000);
    }

    // Gespeicherte Gesichter beim Start laden
    const facesReady = faceStore.loadAll().then(entries => {
        const legacy = [];
        entries.forEach(([key, url]) => {
            if (Array.isArray(key)) {
                const [id, name] = key;
                if (!facesByPlan.has(id)) facesByPlan.set(id, new Map());
                facesByPlan.get(id).set(name, url);
            } else {
                legacy.push([key, url]);
            }
        });
        // Fotos aus älteren Versionen (nur nach Namen gespeichert) genau EINEM Plan zuordnen:
        // dem geöffneten bzw. dem zuletzt benutzten Plan, in dem das Kind vorkommt.
        if (legacy.length) {
            const plans = Object.values(readPlans()).filter(pl => pl && pl.id)
                .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
            legacy.forEach(([name, url]) => {
                const target = plans.find(pl => pl.id === currentPlanId && (pl.students || []).includes(name))
                    || plans.find(pl => (pl.students || []).includes(name));
                if (target) setFace(name, url, target.id);
                faceStore.remove(name).catch(() => {});
            });
        }
        selectPlan(currentPlanId);
        squares.forEach(applyFace);
        renderStudentList();
    }).catch(err => console.warn('Keine Fotos geladen:', err));

    /* ==================================================
       Drucken / PDF
       ================================================== */
    on('print-btn', 'click', async () => {
        closeDrawer();
        if (!squares.length) { ui.alert('Nichts zu drucken', 'Dieser Sitzplan hat noch keine Tische.'); return; }
        let withPhotos = showPhotos && faces.size > 0;
        const content = document.createElement('div');
        if (faces.size) {
            const row = document.createElement('div');
            row.className = 'pp-setting-row';
            row.style.margin = '4px 0 0';
            row.innerHTML = '<span>Fotos drucken</span>';
            const seg = document.createElement('div');
            seg.className = 'pp-segmented pp-segmented-small';
            const mk = (label, val) => {
                const b = document.createElement('button');
                b.textContent = label;
                b.setAttribute('aria-pressed', String(withPhotos === val));
                b.addEventListener('click', () => {
                    withPhotos = val;
                    seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
                });
                return b;
            };
            seg.append(mk('Mit', true), mk('Ohne', false));
            row.appendChild(seg);
            content.appendChild(row);
        }
        const go = await sheet({
            title: 'Sitzplan drucken',
            text: 'Querformat, auf eine Seite verkleinert. Auf dem iPad im Druckdialog mit zwei Fingern auseinanderziehen bzw. „Als PDF sichern“ wählen, um ein PDF zu erhalten.',
            content,
            buttons: [{ label: 'Abbrechen', value: false }, { label: 'Drucken', value: true, kind: 'primary' }]
        });
        if (go) printPlan(withPhotos);
    });

    function printPlan(withPhotos) {
        document.getElementById('print-root')?.remove();
        const root = document.createElement('div');
        root.id = 'print-root';
        if (!withPhotos) root.classList.add('no-photos');

        const head = document.createElement('div');
        head.className = 'print-head';
        const h1 = document.createElement('h1');
        const stName = currentSeating() && seatings.length > 1 ? ` – ${currentSeating().name}` : '';
        h1.textContent = currentName + stName;
        const info = document.createElement('span');
        info.textContent = `${students.length} SuS · ${new Date().toLocaleDateString('de-DE')} · PlanPad`;
        head.append(h1, info);

        let minX = Infinity;
        let maxX = 0;
        let maxY = 0;
        squares.forEach(sq => {
            minX = Math.min(minX, sq.offsetLeft);
            maxX = Math.max(maxX, sq.offsetLeft + sq.offsetWidth);
            maxY = Math.max(maxY, sq.offsetTop + sq.offsetHeight);
        });
        const shift = minX - MARGIN;
        const width = Math.max(maxX - shift + MARGIN, 300);
        const height = maxY + 90;
        const scale = Math.min(1, 1020 / width, 600 / height);

        const room = document.createElement('div');
        room.className = 'print-room';
        room.style.width = `${width}px`;
        room.style.height = `${height}px`;
        room.style.transform = `scale(${scale})`;
        squares.forEach(sq => {
            const c = sq.cloneNode(true);
            c.classList.remove('selected-for-separation', 'just-moved', 'drop-highlight', 'is-dragging', 'is-active', 'is-noting');
            c.style.left = `${sq.offsetLeft - shift}px`;
            room.appendChild(c);
        });
        const teacher = document.createElement('div');
        teacher.className = 'teacher';
        teacher.innerHTML = BOARD_SVG;
        room.appendChild(teacher);

        const wrap = document.createElement('div');
        wrap.style.height = `${height * scale}px`;
        wrap.appendChild(room);
        root.append(head, wrap);
        document.body.appendChild(root);
        setTimeout(() => window.print(), 50);
    }
    window.addEventListener('afterprint', () => document.getElementById('print-root')?.remove());

    /* ==================================================
       Notizen zu einzelnen SuS (je Plan, nur lokal)
       Speicher: { planId: { Name: [ { id, ts, lesson, grade, remark } ] } }
       ================================================== */
    function readAllNotes() {
        try {
            const v = JSON.parse(localStorage.getItem(KEY_NOTES) || '{}');
            return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
        } catch { return {}; }
    }
    function writeAllNotes(all) {
        try { localStorage.setItem(KEY_NOTES, JSON.stringify(all)); return true; } catch (err) {
            console.error(err);
            ui.alert('Notiz nicht gespeichert', 'Der Browserspeicher ist voll oder gesperrt (privates Fenster?).');
            return false;
        }
    }
    function notesOf(name, planId = currentPlanId) {
        const all = readAllNotes();
        return ((all[planId] || {})[name] || []).slice().sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
    }
    function notesOfPlan(planId) { return readAllNotes()[planId] || {}; }
    function totalNoteCount() {
        let n = 0;
        Object.values(readAllNotes()).forEach(pl => Object.values(pl || {}).forEach(arr => { n += (arr || []).length; }));
        return n;
    }
    function upsertNote(name, note, planId = currentPlanId) {
        const all = readAllNotes();
        const pl = all[planId] || (all[planId] = {});
        const arr = pl[name] || (pl[name] = []);
        const i = arr.findIndex(x => x.id === note.id);
        if (i >= 0) arr[i] = note; else arr.push(note);
        return writeAllNotes(all);
    }
    function deleteNote(name, id, planId = currentPlanId) {
        const all = readAllNotes();
        const arr = ((all[planId] || {})[name]) || [];
        const i = arr.findIndex(x => x.id === id);
        if (i < 0) return;
        arr.splice(i, 1);
        if (!arr.length) delete all[planId][name];
        writeAllNotes(all);
    }
    function removePlanNotes(planId) {
        const all = readAllNotes();
        if (all[planId]) { delete all[planId]; writeAllNotes(all); }
    }
    function copyPlanNotes(fromId, toId) {
        const all = readAllNotes();
        if (!all[fromId]) return;
        all[toId] = JSON.parse(JSON.stringify(all[fromId]));
        writeAllNotes(all);
    }

    const fmtNoteDate = ts => {
        const d = new Date(ts);
        if (isNaN(d)) return '';
        const day = d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
        return `${day}, ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
    };

    /* ----- Schalter ----- */
    const paneClass = document.querySelector('.pp-pane-class');
    const notesView = $('notes-view');
    const notesBody = $('notes-body');
    let editingNote = null;          // Notiz, die gerade bearbeitet wird
    let noteForm = null;             // { lesson, grade, remark } – aktuelle Eingabefelder

    /** Notizansicht sichtbar? (nicht, solange Namen eingegeben werden oder keine Namen da sind) */
    function notesViewActive() {
        return notesMode && students.length > 0 && !app.classList.contains('is-editing-names');
    }

    let lastNotesView = null;
    function updatePaneView() {
        const pane = document.querySelector('.pp-pane-class');
        const view = $('notes-view');
        if (!pane || !view) return;
        const on = notesViewActive();
        pane.classList.toggle('is-notes', on);
        view.hidden = !on;
        document.body.classList.toggle('notes-mode', on);
        const g = $('view-groups');
        const nb = $('view-notes');
        if (g) g.setAttribute('aria-pressed', String(!on));
        if (nb) nb.setAttribute('aria-pressed', String(on));
        if (on !== lastNotesView) {
            const switched = lastNotesView !== null;
            lastNotesView = on;
            if (switched) showWholePlan();   // Gruppen ↔ Notizen: Leiste ändert die Größe des Raums
            if (on) { if (selecting) endSelection(); setActiveTable(null); }
            else { saveDraft(); editingNote = null; }
            renderNotes();
            refreshMarks();
        }
    }
    // Namenseingabe an/aus ändert die Ansicht automatisch
    new MutationObserver(updatePaneView).observe(app, { attributes: true, attributeFilter: ['class'] });
    paneViewReady = true;

    function setNotesMode(on) {
        if (!on) saveDraft();
        notesMode = on;
        updatePaneView();
    }
    // Umschalter: links Gruppen (Namen, Fotos, Regeln, Umsetzen) – rechts Notizen
    on('view-groups', 'click', () => {
        setNotesMode(false);
        if (app.classList.contains('sidebar-collapsed')) setSidebar(true);
    });
    on('view-notes', 'click', () => {
        if (!students.length) { needStudents(); return; }
        // beim Wechsel in die Notizansicht zuerst die Übersicht der neuen Notizen zeigen
        if (noteStudent) { saveDraft(); noteStudent = null; editingNote = null; renderNotes(); refreshMarks(); }
        app.classList.remove('is-editing-names');
        setNotesMode(true);
        if (app.classList.contains('sidebar-collapsed')) setSidebar(true);
    });

    function selectNoteStudent(name) {
        if (name === noteStudent) return;
        saveDraft();
        noteStudent = name;
        editingNote = null;
        renderNotes();
        refreshMarks();
    }

    /** Angefangene Notiz nicht verlieren: beim Wechsel automatisch speichern */
    /* Art einer Notiz: Beitrag (Standard), Beobachtung, Präsentation + eigene (für alle Klassen) */
    const KEY_NOTE_KINDS = 'planpad.noteKinds';
    const NOTE_KINDS_BASE = ['Beitrag', 'Beobachtung', 'Präsentation'];
    function noteKinds() {
        let extra = [];
        try { extra = JSON.parse(localStorage.getItem(KEY_NOTE_KINDS) || '[]'); } catch { /* egal */ }
        const out = [...NOTE_KINDS_BASE];
        (Array.isArray(extra) ? extra : []).forEach(k => { if (typeof k === 'string' && k.trim() && !out.includes(k.trim())) out.push(k.trim()); });
        return out;
    }
    function addNoteKind(k) {
        const extra = noteKinds().slice(NOTE_KINDS_BASE.length);
        if (noteKinds().includes(k)) return;
        try { localStorage.setItem(KEY_NOTE_KINDS, JSON.stringify([...extra, k])); } catch { /* egal */ }
    }
    function fillKindSelect(sel, value) {
        sel.textContent = '';
        const kinds = noteKinds();
        if (value && !kinds.includes(value)) kinds.push(value);
        kinds.forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = k; sel.appendChild(o); });
        const add = document.createElement('option');
        add.value = '__add';
        add.textContent = '+ Art ergänzen …';
        sel.appendChild(add);
        sel.value = value || kinds[0];
    }

    function saveDraft() {
        saveClassDraft();
        if (!noteForm || !noteStudent) return false;
        const lesson = noteForm.lesson.value.trim();
        const grade = noteForm.grade.value.trim();
        const kind = noteForm.kind.value && noteForm.kind.value !== '__add' ? noteForm.kind.value : NOTE_KINDS_BASE[0];
        if (!lesson && !grade) return false;
        const note = editingNote
            ? { ...editingNote, lesson, grade, kind, edited: new Date().toISOString() }
            : { id: newId(), ts: new Date().toISOString(), lesson, grade, kind, remark: '', unread: true };
        if (upsertNote(noteStudent, note)) {
            showToast(`Notiz für ${noteStudent} gespeichert.`, 'ok', 1800);
            noteForm = null;
            return true;
        }
        return false;
    }

    function noteAvatar(name) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pp-note-avatar';
        btn.setAttribute('aria-label', faces.has(name) ? `Foto von ${name} ändern` : `Foto für ${name} hinzufügen`);
        btn.title = faces.has(name) ? 'Foto ändern' : 'Foto hinzufügen';
        if (faces.has(name)) {
            const img = document.createElement('img');
            img.src = faces.get(name);
            img.alt = '';
            btn.appendChild(img);
        } else {
            const ini = document.createElement('span');
            ini.className = 'pp-note-initial';
            ini.textContent = name.charAt(0).toUpperCase();
            btn.appendChild(ini);
        }
        const cam = document.createElement('span');
        cam.className = 'pp-note-cam';
        cam.innerHTML = icon('camera');
        btn.appendChild(cam);
        btn.addEventListener('click', () => openStudentSheet(name));
        return btn;
    }

    /** Nur das Foto oben in der Notizansicht erneuern (angefangene Notiz bleibt stehen) */
    function refreshNoteAvatar() {
        const old = notesBody && notesBody.querySelector('.pp-note-avatar');
        if (old && noteStudent) old.replaceWith(noteAvatar(noteStudent));
    }

    async function renameFromNotes(oldName) {
        saveDraft();
        const name = await ui.prompt(`${oldName} umbenennen`, 'Neuer Name, z. B. Spitzname – Notizen, Foto, Sitzplätze und Regeln bleiben erhalten', oldName, 'Umbenennen');
        if (!name || name === oldName) { renderNotes(); return; }
        if (students.includes(name)) { await ui.alert('Name vergeben', `„${name}“ steht schon in der Klassenliste.`); renderNotes(); return; }
        renameStudent(oldName, name);
        showToast(`${oldName} heißt jetzt ${name}. Alle Notizen wurden übernommen.`, 'ok', 3000);
    }

    /** Neue (noch nicht abgehakte) Notizen der Klasse: [{ name, note }] – neueste zuerst */
    function unreadNotes() {
        const pl = notesOfPlan(currentPlanId);
        const out = [];
        students.forEach(name => (pl[name] || []).forEach(note => { if (note.unread) out.push({ name, note }); }));
        return out.sort((a, b) => String(b.note.ts).localeCompare(String(a.note.ts)));
    }
    function hasUnread(name) {
        return (notesOfPlan(currentPlanId)[name] || []).some(n => n.unread);
    }
    function markRead(name, id) {
        const all = readAllNotes();
        const n = ((all[currentPlanId] || {})[name] || []).find(x => x.id === id);
        if (!n || !n.unread) return;
        delete n.unread;
        writeAllNotes(all);
    }
    async function markAllRead() {
        const list = unreadNotes();
        if (!list.length) return;
        if (!await ui.confirm('Alle als gelesen markieren?', `${countText(list.length, 'neue Notiz wird', 'neue Notizen werden')} abgehakt. Die Notizen selbst bleiben bei den SuS gespeichert.`, 'Alle abhaken')) return;
        const all = readAllNotes();
        Object.values(all[currentPlanId] || {}).forEach(arr => (arr || []).forEach(n => { delete n.unread; }));
        writeAllNotes(all);
        renderNotes();
        refreshMarks();
        showToast('Alle Notizen als gelesen markiert.', 'ok', 2200);
    }

    /* ----- Klassennotizen (gelten für die ganze Klasse, z. B. Stoff, Hausaufgabe, Vorfall) ----- */
    let classForm = null;          // offenes Eingabefeld
    let classEditing = null;       // 'new' oder die Notiz, die bearbeitet wird
    let classDraftText = null;     // Text beim Neuzeichnen
    let classShowAll = false;      // alle Klassennotizen zeigen (sonst die 3 neuesten)
    const CLASS_SHOW = 3;
    function classNotes() {
        return ((notesOfPlan(currentPlanId)[CLASS_KEY]) || []).slice().sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
    }
    function saveClassDraft() {
        if (!classForm) return false;
        const text = classForm.value.trim();
        const editing = classEditing;
        classForm = null;
        classEditing = null;
        if (!text) return false;
        const note = editing && editing !== 'new'
            ? { ...editing, text, edited: new Date().toISOString() }
            : { id: newId(), ts: new Date().toISOString(), text };
        if (!upsertNote(CLASS_KEY, note)) return false;
        showToast('Klassennotiz gespeichert.', 'ok', 1800);
        return true;
    }

    function renderClassNotes() {
        const list = classNotes();
        const sec = document.createElement('section');
        sec.className = 'pp-classnotes';
        sec.setAttribute('aria-label', 'Klassennotizen');
        const head = document.createElement('div');
        head.className = 'pp-classnotes-head';
        head.innerHTML = `${icon('users')}<b>Klassennotizen</b>${list.length ? `<span class="pp-count">${list.length}</span>` : ''}`;
        if (!classEditing) {
            const add = document.createElement('button');
            add.type = 'button';
            add.className = 'pp-classnotes-add';
            add.id = 'class-note-add';
            add.innerHTML = `${icon('plus')}<span>Anlegen</span>`;
            add.addEventListener('click', () => { classEditing = 'new'; renderNotes(); classForm && classForm.focus(); });
            head.appendChild(add);
        }
        sec.appendChild(head);

        if (classEditing) {
            const form = document.createElement('form');
            form.className = 'pp-classnote-form';
            const ta = document.createElement('textarea');
            ta.rows = 3;
            ta.placeholder = 'z. B. Stoff der Stunde, Hausaufgabe, Termin, Vorfall in der Klasse …';
            ta.value = classDraftText !== null ? classDraftText : classEditing !== 'new' ? (classEditing.text || '') : '';
            classDraftText = null;
            ta.setAttribute('aria-label', 'Klassennotiz');
            form.appendChild(ta);
            const act = document.createElement('div');
            act.className = 'pp-note-actions';
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'pp-btn pp-btn-small';
            cancel.textContent = 'Abbrechen';
            cancel.addEventListener('click', () => { classForm = null; classEditing = null; renderNotes(); });
            const save = document.createElement('button');
            save.type = 'submit';
            save.className = 'pp-btn pp-btn-small pp-btn-primary';
            save.textContent = 'Speichern';
            act.append(cancel, save);
            form.appendChild(act);
            form.addEventListener('submit', e => { e.preventDefault(); saveClassDraft(); renderNotes(); });
            sec.appendChild(form);
            classForm = ta;
        }

        if (list.length) {
            const ul = document.createElement('ul');
            ul.className = 'pp-classnotes-list';
            list.slice(0, classShowAll ? list.length : CLASS_SHOW).forEach(n => {
                const li = document.createElement('li');
                li.className = 'pp-classnote' + (classEditing && classEditing !== 'new' && classEditing.id === n.id ? ' is-editing' : '');
                const top = document.createElement('div');
                top.className = 'pp-classnote-top';
                const d = document.createElement('small');
                d.textContent = fmtNoteDate(n.ts);
                top.appendChild(d);
                const ed = document.createElement('button');
                ed.type = 'button';
                ed.className = 'pp-iconbtn';
                ed.setAttribute('aria-label', 'Klassennotiz bearbeiten');
                ed.innerHTML = icon('edit');
                ed.addEventListener('click', () => { saveClassDraft(); classEditing = n; renderNotes(); classForm && classForm.focus(); });
                const del = document.createElement('button');
                del.type = 'button';
                del.className = 'pp-iconbtn';
                del.setAttribute('aria-label', 'Klassennotiz löschen');
                del.innerHTML = icon('trash');
                del.addEventListener('click', async () => {
                    if (!await ui.confirm('Klassennotiz löschen?', `Klassennotiz vom ${fmtNoteDate(n.ts)} löschen?`, 'Löschen', true)) return;
                    deleteNote(CLASS_KEY, n.id);
                    renderNotes();
                });
                top.append(ed, del);
                const t = document.createElement('p');
                t.className = 'pp-classnote-text';
                t.textContent = n.text || '';
                li.append(top, t);
                ul.appendChild(li);
            });
            sec.appendChild(ul);
            if (list.length > CLASS_SHOW) {
                const more = document.createElement('button');
                more.type = 'button';
                more.className = 'pp-classnotes-more';
                more.textContent = classShowAll ? 'Weniger anzeigen' : `Alle ${list.length} Klassennotizen anzeigen`;
                more.addEventListener('click', () => { classShowAll = !classShowAll; renderNotes(); });
                sec.appendChild(more);
            }
        } else if (!classEditing) {
            const e = document.createElement('p');
            e.className = 'pp-classnotes-empty';
            e.textContent = 'Notizen zur ganzen Klasse – z. B. Stoff, Hausaufgabe oder Termine.';
            sec.appendChild(e);
        }
        notesBody.appendChild(sec);
    }

    /** Notiz-Karte. withName: Name anzeigen und antippbar (Übersicht der neuen Notizen) */
    function noteCard(n, name, withName = false) {
        const li = document.createElement('li');
        li.className = 'pp-note-card' + (n.unread ? ' is-new' : '') + (editingNote && editingNote.id === n.id ? ' is-editing' : '');
        li.dataset.noteId = n.id;
        if (withName) {
            const who = document.createElement('button');
            who.type = 'button';
            who.className = 'pp-note-card-who';
            if (faces.has(name)) {
                const img = document.createElement('img');
                img.src = faces.get(name);
                img.alt = '';
                who.appendChild(img);
            }
            const t = document.createElement('span');
            t.textContent = name;
            who.appendChild(t);
            who.title = `Alle Notizen von ${name}`;
            who.addEventListener('click', () => selectNoteStudent(name));
            li.appendChild(who);
        }
        const ch = document.createElement('div');
        ch.className = 'pp-note-card-head';
        const date = document.createElement('b');
        date.textContent = fmtNoteDate(n.ts);
        ch.appendChild(date);
        if (n.unread) {
            const badge = document.createElement('span');
            badge.className = 'pp-note-new';
            badge.textContent = 'neu';
            ch.appendChild(badge);
        }
        if (n.kind) {
            const k = document.createElement('span');
            k.className = 'pp-note-kindtag';
            k.textContent = n.kind;
            ch.appendChild(k);
        }
        if (n.grade) {
            const g = document.createElement('span');
            g.className = 'pp-note-grade';
            g.textContent = n.grade;
            ch.appendChild(g);
        }
        if (n.unread) {
            const done = document.createElement('button');
            done.type = 'button';
            done.className = 'pp-iconbtn pp-note-done';
            done.title = 'Als gelesen abhaken';
            done.setAttribute('aria-label', `Notiz von ${name} als gelesen abhaken`);
            done.innerHTML = icon('check');
            done.addEventListener('click', () => {
                markRead(name, n.id);
                renderNotes();
                refreshMarks();
            });
            ch.appendChild(done);
        }
        if (!withName) {
            const ed = document.createElement('button');
            ed.type = 'button';
            ed.className = 'pp-iconbtn';
            ed.setAttribute('aria-label', 'Notiz bearbeiten');
            ed.innerHTML = icon('edit');
            ed.addEventListener('click', () => { saveDraft(); editingNote = n; renderNotes(); notesBody.scrollTop = 0; });
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'pp-iconbtn';
            del.setAttribute('aria-label', 'Notiz löschen');
            del.innerHTML = icon('trash');
            del.addEventListener('click', async () => {
                if (!await ui.confirm('Notiz löschen?', `Notiz vom ${fmtNoteDate(n.ts)} für ${name} löschen?`, 'Löschen', true)) return;
                deleteNote(name, n.id);
                if (editingNote && editingNote.id === n.id) editingNote = null;
                renderNotes();
                refreshMarks();
            });
            ch.append(ed, del);
        }
        li.appendChild(ch);
        const part = (label, text) => {
            if (!text) return;
            const p = document.createElement('p');
            p.className = 'pp-note-part';
            const l = document.createElement('span');
            l.textContent = label;
            p.append(l, document.createTextNode(text));
            li.appendChild(p);
        };
        part('Unterrichtsnotiz', n.lesson);
        part('Bemerkung', n.remark);
        return li;
    }

    function renderNotes() {
        noteForm = null;
        classDraftText = classForm ? classForm.value : null;   // angefangene Klassennotiz behalten
        classForm = null;
        if (!notesBody) return;
        notesBody.textContent = '';
        const count = $('notes-count');
        if (!notesViewActive()) return;

        const title = $('notes-title');
        if (title) title.textContent = 'Notizen';
        if (!noteStudent || !students.includes(noteStudent)) {
            noteStudent = null;
            const fresh = unreadNotes();
            if (title) title.textContent = fresh.length ? countText(fresh.length, 'neue Notiz', 'neue Notizen') : 'Notizen';
            if (count) count.textContent = fresh.length ? '' : (students.length ? `${students.length} SuS` : '');
            if (students.length) notesBody.appendChild(obsBar());
            const absDays = students.length ? renderAbsenceDays() : null;
            if (absDays) notesBody.appendChild(absDays);
            renderClassNotes();
            if (fresh.length) {
                const h = document.createElement('h3');
                h.className = 'pp-section pp-fresh-head';
                h.textContent = 'Neue Notizen zu SuS';
                notesBody.appendChild(h);
                const all = document.createElement('button');
                all.type = 'button';
                all.className = 'pp-notes-allread';
                all.id = 'mark-all-read';
                all.innerHTML = `${icon('check')}<span>Alle als gelesen markieren</span>`;
                all.addEventListener('click', markAllRead);
                notesBody.appendChild(all);
                const ul = document.createElement('ul');
                ul.className = 'pp-notes-list pp-notes-fresh';
                fresh.forEach(({ name, note }) => ul.appendChild(noteCard(note, name, true)));
                notesBody.appendChild(ul);
                const hint = document.createElement('p');
                hint.className = 'pp-notes-empty pp-hint';
                hint.textContent = 'Abhaken (✓), wenn eine Notiz erledigt ist – z. B. Note eingetragen oder Eltern informiert. Name antippen: alle Notizen dieser Person.';
                notesBody.appendChild(hint);
                return;
            }
            const p = document.createElement('p');
            p.className = 'pp-notes-empty';
            p.textContent = 'Tippe im Raum auf einen Schülertisch, um Notizen zu sehen und eine neue Notiz anzulegen.';
            const p2 = document.createElement('p');
            p2.className = 'pp-notes-empty pp-hint';
            p2.textContent = 'Namen bearbeiten, Kinder umsetzen, Klassenfoto und Regeln (Trennen/Koppeln): Männchen-Symbol oben im Raum.';
            notesBody.append(p, p2);
            return;
        }

        const list = notesOf(noteStudent);
        if (count) count.textContent = list.length ? `${list.length} gespeichert` : '';

        // Kopf: Foto + Name (Foto antippen = aufnehmen / ändern / entfernen)
        const who = document.createElement('div');
        who.className = 'pp-note-who';
        who.appendChild(noteAvatar(noteStudent));
        const nm = document.createElement('b');
        nm.textContent = fullName(noteStudent);
        who.appendChild(nm);
        if (isObserved(noteStudent)) {
            const eb = document.createElement('button');
            eb.type = 'button';
            eb.className = 'pp-note-eye';
            eb.id = 'note-eye';
            eb.setAttribute('aria-label', 'Wird beobachtet – bis wann?');
            eb.style.setProperty('--p', `${Math.round(obsProgress(noteStudent) * 360)}deg`);
            eb.innerHTML = `<span class="seat-eye-in">${icon('eye')}</span>`;
            const who2 = noteStudent;
            eb.addEventListener('click', () => showTip(eb, { title: `${fullName(who2)} wird beobachtet`, text: obsInfoText(who2) }));
            who.appendChild(eb);
        }
        const ren = document.createElement('button');
        ren.type = 'button';
        ren.className = 'pp-iconbtn pp-note-rename';
        ren.title = 'Namen ändern (Notizen bleiben erhalten)';
        ren.setAttribute('aria-label', `${noteStudent} umbenennen`);
        ren.innerHTML = icon('edit');
        ren.addEventListener('click', () => renameFromNotes(noteStudent));
        who.appendChild(ren);
        notesBody.appendChild(who);

        // Neue Notiz (bzw. Bearbeiten)
        const form = document.createElement('form');
        form.className = 'pp-note-form';
        form.addEventListener('submit', e => { e.preventDefault(); if (saveDraft()) { editingNote = null; renderNotes(); refreshMarks(); } });
        const head = document.createElement('div');
        head.className = 'pp-note-date';
        head.innerHTML = `<span>${escapeHtml(fmtNoteDate(editingNote ? editingNote.ts : new Date()))}</span>`
            + (editingNote ? '<small>Notiz bearbeiten</small>' : '<small>neue Notiz</small>');
        form.appendChild(head);
        const field = (label, el) => {
            const l = document.createElement('label');
            l.className = 'pp-note-field';
            l.textContent = label;
            l.appendChild(el);
            form.appendChild(l);
            return el;
        };
        const lesson = field('Unterrichtsnotiz', document.createElement('textarea'));
        lesson.rows = 2;
        lesson.placeholder = 'z. B. Mitarbeit, Material, Verhalten …';
        // Note (schmal) und Art nebeneinander
        const gradeRow = document.createElement('div');
        gradeRow.className = 'pp-note-row';
        const gl = document.createElement('label');
        gl.className = 'pp-note-field pp-note-gradefield';
        gl.textContent = 'Note';
        const grade = document.createElement('input');
        grade.type = 'text';
        grade.placeholder = 'z. B. 2–';
        grade.autocomplete = 'off';
        gl.appendChild(grade);
        const kl = document.createElement('label');
        kl.className = 'pp-note-field pp-note-kindfield';
        kl.textContent = 'Art';
        const kind = document.createElement('select');
        kind.className = 'pp-note-kind';
        kl.appendChild(kind);
        gradeRow.append(gl, kl);
        form.appendChild(gradeRow);
        fillKindSelect(kind, editingNote && editingNote.kind ? editingNote.kind : NOTE_KINDS_BASE[0]);
        let lastKind = kind.value;
        kind.addEventListener('change', async () => {
            if (kind.value !== '__add') { lastKind = kind.value; return; }
            const name = await ui.prompt('Art ergänzen', 'Neue Art (gilt sofort für alle Klassen)', '', 'Hinzufügen');
            const k = name && name.trim().slice(0, 30);
            if (k) addNoteKind(k);
            fillKindSelect(kind, k || lastKind);
            lastKind = kind.value;
        });
        if (editingNote) {
            lesson.value = editingNote.lesson || '';
            grade.value = editingNote.grade || '';
        }
        const actions = document.createElement('div');
        actions.className = 'pp-note-actions';
        if (editingNote) {
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'pp-btn pp-btn-small';
            cancel.textContent = 'Abbrechen';
            cancel.addEventListener('click', () => { noteForm = null; editingNote = null; renderNotes(); });
            actions.appendChild(cancel);
        }
        const save = document.createElement('button');
        save.type = 'submit';
        save.className = 'pp-btn pp-btn-small pp-btn-primary';
        save.textContent = editingNote ? 'Änderung speichern' : 'Notiz speichern';
        actions.appendChild(save);
        form.appendChild(actions);
        notesBody.appendChild(form);
        noteForm = { lesson, grade, kind };
        notesBody.appendChild(renderVotes(noteStudent));
        notesBody.appendChild(renderAbsences(noteStudent));

        // Bisherige Notizen
        const h = document.createElement('h3');
        h.className = 'pp-section';
        h.textContent = list.length ? `Bisherige Notizen (${list.length})` : 'Noch keine Notizen';
        notesBody.appendChild(h);
        const ul = document.createElement('ul');
        ul.className = 'pp-notes-list';
        list.forEach(n => ul.appendChild(noteCard(n, noteStudent)));
        notesBody.appendChild(ul);
    }

    /* ==================================================
       Unterrichtsbeobachtungen, Sterne (Verhalten, SOL, Sozial …), Statistik
       Alles gehört zur Klasse (wird mit ihr gespeichert und gesichert) – nur lokal.
       observ = { off, periods: [{ id, name, start, end, done }] }   (Datum als JJJJ-MM-TT)
       votes  = { Name: { lob: [{ ts, d }], sol: [{ ts, d }] } }      (d = +1 / −1, je ½ Stern)
       ================================================== */
    // Bayerische Schulferien (Kultusministerium) – fest in der App, kein Abruf aus dem Internet.
    // Einzelne Feiertage werden bewusst nicht abgezogen.
    const FERIEN_BY = [
        ['2026-02-14', '2026-02-22'], ['2026-03-28', '2026-04-12'], ['2026-05-23', '2026-06-07'],
        ['2026-08-01', '2026-09-14'],
        ['2026-10-31', '2026-11-08'], ['2026-11-18', '2026-11-18'], ['2026-12-24', '2027-01-10'],
        ['2027-02-06', '2027-02-14'], ['2027-03-20', '2027-04-04'], ['2027-05-15', '2027-05-30'],
        ['2027-07-31', '2027-09-13'],
        ['2027-10-30', '2027-11-07'], ['2027-11-17', '2027-11-17'], ['2027-12-24', '2028-01-09'],
        ['2028-02-26', '2028-03-05'], ['2028-04-08', '2028-04-23'], ['2028-06-03', '2028-06-18'],
        ['2028-07-29', '2028-09-11'],
        ['2028-10-28', '2028-11-05'], ['2028-11-22', '2028-11-22'], ['2028-12-23', '2029-01-07'],
        ['2029-02-10', '2029-02-18'], ['2029-03-24', '2029-04-08'], ['2029-05-19', '2029-06-03'],
        ['2029-07-28', '2029-09-10']
    ];
    const FERIEN_UNTIL = '2029-09-10';
    const OBS_DAYS = 10;            // Standard: 10 Schultage (2 Wochen)
    const OBS_COUNT = 4;            // Standard: 4 Kinder
    const KEY_OBS_SNOOZE = 'planpad.obsSnooze';
    const pad2 = n => String(n).padStart(2, '0');
    const isoDay = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const fromIso = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
    const todayIso = () => isoDay(new Date());
    const addDays = (s, n) => { const d = fromIso(s); d.setDate(d.getDate() + n); return isoDay(d); };
    const isFerien = s => FERIEN_BY.some(([a, b]) => s >= a && s <= b);
    function isSchoolDay(s) { const wd = fromIso(s).getDay(); return wd >= 1 && wd <= 5 && !isFerien(s); }
    /** n Schultage weiter: Start Mittwoch + 10 → Mittwoch zwei Wochen später (Ferien übersprungen) */
    function addSchoolDays(s, n) {
        let d = s;
        for (let k = 0, guard = 0; k < n && guard < 800; guard++) { d = addDays(d, 1); if (isSchoolDay(d)) k++; }
        return d;
    }
    /** Schultage d mit a < d ≤ b */
    function schoolDaysBetween(a, b) {
        let n = 0;
        for (let d = addDays(a, 1), guard = 0; d <= b && guard < 1200; d = addDays(d, 1), guard++) if (isSchoolDay(d)) n++;
        return n;
    }
    const fmtDay = s => fromIso(s).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const fmtDayLong = s => fromIso(s).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

    function normObs(v) {
        const o = v && typeof v === 'object' ? v : {};
        const ok = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
        const cnt = Number(o.count);
        return {
            off: Boolean(o.off),
            count: Number.isInteger(cnt) && cnt >= 0 ? cnt : OBS_COUNT,   // so viele Vorschläge (je Klasse gemerkt)
            lastActive: Number.isInteger(o.lastActive) && o.lastActive >= 0 ? o.lastActive : null,   // laufende Beobachtungen beim letzten Öffnen
            lastOpen: ok(o.lastOpen) ? o.lastOpen : null,
            periods: (Array.isArray(o.periods) ? o.periods : [])
                .filter(p => p && typeof p.name === 'string' && ok(p.start) && ok(p.end))
                .map(p => {
                    const q = { id: String(p.id || newId()), name: p.name, start: p.start, end: p.end, done: Boolean(p.done) };
                    if (ok(p.endedAt)) q.endedAt = p.endedAt;
                    if (p.expired) q.expired = true;
                    return q;
                })
        };
    }
    function normVotes(v) {
        const out = {};
        if (!v || typeof v !== 'object') return out;
        Object.entries(v).forEach(([n, r]) => {
            if (!r || typeof r !== 'object') return;
            const list = a => (Array.isArray(a) ? a.filter(x => x && (x.d === 1 || x.d === -1) && x.ts).map(x => ({ ts: String(x.ts), d: x.d })) : []);
            out[n] = Object.fromEntries(Object.entries(r).filter(([, a]) => Array.isArray(a)).map(([k, a]) => [k, list(a)]));
        });
        return out;
    }
    const activePeriods = () => observ.periods.filter(p => !p.done && students.includes(p.name));
    function isObserved(name) {
        const t = todayIso();
        return Boolean(name) && observ.periods.some(p => !p.done && p.name === name && p.start <= t);
    }
    const obsCount = name => observ.periods.filter(p => p.name === name).length;
    function currentPeriod(name) {
        const t = todayIso();
        return observ.periods.filter(p => !p.done && p.name === name && p.start <= t).sort((a, b) => b.end.localeCompare(a.end))[0] || null;
    }
    /** Anteil des Zeitraums, der noch vor dem Kind liegt (1 = gerade begonnen, 0 = endet heute) */
    function obsProgress(name) {
        const p = currentPeriod(name);
        if (!p) return 0;
        const total = Math.max(1, schoolDaysBetween(p.start, p.end));
        return Math.max(0, Math.min(1, schoolDaysBetween(todayIso(), p.end) / total));
    }
    function obsInfoText(name) {
        const p = currentPeriod(name);
        if (!p) return '';
        const left = schoolDaysBetween(todayIso(), p.end);
        return `Beobachtung bis ${fmtDayLong(p.end)} – ${left === 0 ? 'endet heute' : `noch ${left} Schultag${left === 1 ? '' : 'e'}`}.`;
    }
    /** beobachtete Schultage: start ≤ d < Ende, höchstens bis heute */
    function observedDays(p) {
        const t = todayIso();
        const stop = p.end <= t ? addDays(p.end, -1) : t;
        if (stop < p.start) return 0;
        return schoolDaysBetween(addDays(p.start, -1), stop);
    }
    function saveObs() {
        saveCurrentPlan(true);
        refreshSeatLabels();
        renderNotes();
    }
    function obsSnoozed() {
        try { return (JSON.parse(localStorage.getItem(KEY_OBS_SNOOZE) || '{}') || {})[currentPlanId] === todayIso(); } catch { return false; }
    }
    function snoozeObs() {
        try {
            const m = JSON.parse(localStorage.getItem(KEY_OBS_SNOOZE) || '{}') || {};
            m[currentPlanId] = todayIso();
            localStorage.setItem(KEY_OBS_SNOOZE, JSON.stringify(m));
        } catch { /* egal */ }
    }

    /** Zufallsvorschlag: zuerst nie Beobachtete, erst danach die mit 1, dann 2 … Beobachtungen */
    function pickObsCandidate(exclude) {
        const busy = new Set([...exclude, ...activePeriods().map(p => p.name)]);
        const free = students.filter(n => !busy.has(n));
        if (!free.length) return null;
        const min = Math.min(...free.map(obsCount));
        const tier = free.filter(n => obsCount(n) === min);
        return tier[Math.floor(Math.random() * tier.length)];
    }

    /** Beim Öffnen der Klasse: abgelaufene Zeiträume melden oder neue Beobachtung vorschlagen */
    let obsChecking = false;
    async function observationCheck() {
        if (obsChecking || !students.length || document.querySelector('.pp-sheet-layer')) return;
        try { if (localStorage.getItem('planpad.noObsPrompt')) return; } catch { /* egal */ }
        obsChecking = true;
        try {
            const t = todayIso();
            // abgelaufene Zeiträume sind beendet
            const expired = activePeriods().filter(p => p.end <= t);
            expired.forEach(p => { p.done = true; p.expired = true; p.endedAt = t; });
            const nowActive = activePeriods().length;
            // so viele Plätze sind seit dem letzten Öffnen frei geworden (abgelaufen oder von Hand beendet)
            const before = observ.lastActive !== null ? observ.lastActive : nowActive + expired.length;
            let need = Math.max(0, before - nowActive);
            if (!nowActive && !need) need = Math.min(observ.count, students.length);    // gerade niemand beobachtet
            const since = observ.lastOpen;
            const ended = observ.periods.filter(p => p.done && p.endedAt && (!since || p.endedAt >= since) && students.includes(p.name));
            let answer = null;
            if (!observ.off && need > 0) answer = await openObsStart({ auto: true, count: Math.min(need, students.length), ended });
            if (answer !== 'later') { observ.lastActive = activePeriods().length; observ.lastOpen = t; }
            saveCurrentPlan(true);
            refreshSeatLabels();
            renderNotes();
        } finally { obsChecking = false; }
    }

    function obsRow(cls) {
        const row = document.createElement('div');
        row.className = 'pp-obs-row' + (cls ? ` ${cls}` : '');
        return row;
    }

    /** Dialog: Kinder für einen neuen Beobachtungszeitraum würfeln oder auswählen */
    async function openObsStart({ auto = false, count = null, ended = [] } = {}) {
        if (!students.length) { needStudents(); return null; }
        if (count === null) count = Math.min(observ.count, students.length);
        const chosen = [];
        for (let i = 0; i < count; i++) chosen.push(pickObsCandidate(chosen.filter(Boolean)) || '');
        const content = document.createElement('div');
        content.className = 'pp-obs';
        // Kopf: wie viele werden gerade beobachtet, wer ist seit dem letzten Öffnen fertig
        const head = document.createElement('div');
        head.className = 'pp-obs-head';
        const nAct = activePeriods().length;
        head.innerHTML = `<span class="pp-obs-now">${icon('eye')}<b id="obs-now-count">${nAct}</b> ${nAct === 1 ? 'Kind wird' : 'Kinder werden'} gerade beobachtet</span>`;
        if (ended.length) {
            const p = document.createElement('p');
            p.className = 'pp-hint pp-obs-ended';
            const exp = ended.filter(e => e.expired).map(e => e.name);
            const man = ended.filter(e => !e.expired).map(e => e.name);
            p.innerHTML = `<b>${ended.length} seit dem letzten Öffnen beendet</b> – `
                + [exp.length ? `abgelaufen: ${escapeHtml(exp.join(', '))}` : '', man.length ? `von Hand: ${escapeHtml(man.join(', '))}` : ''].filter(Boolean).join(' · ');
            head.appendChild(p);
        }
        content.appendChild(head);
        const list = document.createElement('div');
        list.className = 'pp-obs-list';
        content.appendChild(list);
        const busy = new Set(activePeriods().map(p => p.name));
        const sorted = students.slice().sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
        const draw = () => {
            list.textContent = '';
            if (!chosen.length) {
                const p = document.createElement('p');
                p.className = 'pp-hint pp-obs-none';
                p.textContent = 'Aktuell keine Vorschläge. Tippe auf „Mehr anzeigen“.';
                list.appendChild(p);
            }
            chosen.forEach((name, i) => {
                const row = obsRow();
                const sel = document.createElement('select');
                sel.className = 'pp-obs-select';
                sel.setAttribute('aria-label', `Kind ${i + 1} auswählen`);
                sel.title = 'Auswählen statt würfeln';
                const none = document.createElement('option');
                none.value = '';
                none.textContent = '— niemand —';
                sel.appendChild(none);
                sorted.forEach(n => {
                    const o = document.createElement('option');
                    o.value = n;
                    const c = obsCount(n);
                    o.textContent = fullName(n) + (busy.has(n) ? ' (wird gerade beobachtet)' : c ? ` (${c}× beobachtet)` : '');
                    o.disabled = busy.has(n) || (chosen.includes(n) && n !== name);
                    sel.appendChild(o);
                });
                sel.value = name;
                sel.addEventListener('change', () => { chosen[i] = sel.value; draw(); });
                row.appendChild(sel);
                const c = name ? obsCount(name) : 0;
                if (c) {
                    const badge = document.createElement('span');
                    badge.className = 'pp-obs-badge';
                    badge.textContent = `schon ${c}× beobachtet`;
                    row.appendChild(badge);
                }
                const dice = document.createElement('button');
                dice.type = 'button';
                dice.className = 'pp-iconbtn pp-obs-dice';
                dice.title = 'Neu würfeln';
                dice.setAttribute('aria-label', `Kind ${i + 1} neu würfeln`);
                dice.innerHTML = icon('dice');
                dice.addEventListener('click', () => {
                    const next = pickObsCandidate(chosen.filter((n, k) => n && k !== i).concat(name ? [name] : []));
                    if (next) chosen[i] = next;
                    else showToast('Niemand sonst ist frei.', 'info', 2000);
                    draw();
                });
                row.appendChild(dice);
                list.appendChild(row);
            });
            less.disabled = chosen.length === 0;
            more.disabled = chosen.length >= students.length;
        };
        // weniger / mehr Vorschläge – die Anzahl gilt ab jetzt für diese Klasse
        const amount = document.createElement('div');
        amount.className = 'pp-obs-amount';
        const amountBtn = (ic, label, fn) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'pp-btn pp-btn-small';
            b.innerHTML = `${icon(ic)}<span>${label}</span>`;
            b.addEventListener('click', () => { fn(); observ.count = chosen.length; saveCurrentPlan(true); draw(); });
            amount.appendChild(b);
            return b;
        };
        const less = amountBtn('minus', 'Weniger anzeigen', () => { chosen.pop(); });
        const more = amountBtn('plus', 'Mehr anzeigen', () => { if (chosen.length < students.length) chosen.push(pickObsCandidate(chosen.filter(Boolean)) || ''); });
        content.appendChild(amount);
        draw();

        // Zeitraum
        const dates = document.createElement('div');
        dates.className = 'pp-obs-dates';
        const mk = (label, value) => {
            const l = document.createElement('label');
            l.className = 'pp-field';
            l.textContent = label;
            const inp = document.createElement('input');
            inp.type = 'date';
            inp.value = value;
            l.appendChild(inp);
            dates.appendChild(l);
            return inp;
        };
        let start = todayIso();
        const from = mk('Beginn', start);
        const to = mk('Ende', addSchoolDays(start, OBS_DAYS));
        content.appendChild(dates);
        const info = document.createElement('p');
        info.className = 'pp-hint pp-obs-info';
        content.appendChild(info);
        const showInfo = () => {
            const ok = from.value && to.value && to.value > from.value;
            const n = ok ? schoolDaysBetween(from.value, to.value) : 0;
            info.classList.toggle('is-warn', !ok);
            info.textContent = !ok ? 'Das Ende muss nach dem Beginn liegen.'
                : `${n} Schultag${n === 1 ? '' : 'e'} – Wochenenden und bayerische Ferien zählen nicht mit.`
                    + (to.value > FERIEN_UNTIL ? ' Ferien nach Sommer 2029 sind noch nicht hinterlegt.' : '');
        };
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'pp-textbtn pp-obs-reset';
        reset.textContent = 'Statistik zurücksetzen';
        reset.addEventListener('click', async () => {
            const yes = await ui.confirm('Statistik für Beobachtungen für alle Schüler:innen zurücksetzen?', 'Counter für alle auf Null setzen', 'Zurücksetzen', true);
            if (!yes) return;
            observ.periods = observ.periods.filter(p => !p.done);   // abgeschlossene Beobachtungen zählen nicht mehr
            saveCurrentPlan(true);
            draw();
            showToast('Beobachtungs-Statistik zurückgesetzt.', 'ok', 2500);
        });
        content.appendChild(reset);
        from.addEventListener('change', () => { if (from.value) to.value = addSchoolDays(from.value, OBS_DAYS); showInfo(); });
        to.addEventListener('change', showInfo);
        showInfo();

        const buttons = auto
            ? [{ label: 'Für diese Klasse aus', value: 'off' }, { label: 'Nicht jetzt', value: 'later' }, { label: 'Beobachten', value: 'go', kind: 'primary' }]
            : [{ label: 'Abbrechen', value: null }, { label: 'Beobachten', value: 'go', kind: 'primary' }];
        const v = await sheet({
            title: 'Plane Deinen Beobachtungszeitraum',
            text: auto ? (count === 1 ? 'Vorschlag für ein neues Kind:' : `Vorschläge für ${count} neue Kinder:`) : 'Diese Kinder ab jetzt beobachten:',
            content,
            className: 'pp-sheet-obs',
            buttons
        });
        if (v === 'off') {
            observ.off = true;
            saveObs();
            showToast('Keine Vorschläge mehr für diese Klasse. Wieder einschalten: Notizen → „Beobachten“.', 'info', 5000);
            return 'off';
        }
        if (v === 'later' || v === null) return 'later';     // beim nächsten Öffnen der Klasse wieder fragen
        const names = [...new Set(chosen.filter(Boolean))];
        if (!names.length || !(to.value > from.value)) return 'none';
        names.forEach(name => observ.periods.push({ id: newId(), name, start: from.value, end: to.value, done: false }));
        saveObs();
        showToast(`${names.length === 1 ? fullName(names[0]) + ' wird' : names.length + ' Kinder werden'} bis ${fmtDay(to.value)} beobachtet.`, 'ok', 3500);
        return 'go';
    }

    /** Dialog: Beobachtungszeitraum endet heute (oder ist abgelaufen) */
    async function openObsEnd(due) {
        const t = todayIso();
        const content = document.createElement('div');
        content.className = 'pp-obs';
        const picks = due.map(p => {
            const row = obsRow();
            const nm = document.createElement('div');
            nm.className = 'pp-obs-name';
            nm.innerHTML = `${icon('eye')}<b>${escapeHtml(fullName(p.name))}</b><small>${p.end === t ? 'endet heute' : `endete ${escapeHtml(fmtDay(p.end))}`}</small>`;
            const sel = document.createElement('select');
            sel.className = 'pp-obs-select';
            sel.setAttribute('aria-label', `${p.name}: wie weiter?`);
            [['reroll', 'Abschließen & neu würfeln'], ['done', 'Abschließen'], ['w1', 'Um 1 Woche verlängern'], ['w2', 'Um 2 Wochen verlängern']]
                .forEach(([val, label]) => { const o = document.createElement('option'); o.value = val; o.textContent = label; sel.appendChild(o); });
            row.append(nm, sel);
            content.appendChild(row);
            return sel;
        });
        const v = await sheet({
            title: due.length === 1 ? 'Beobachtungszeitraum zu Ende' : 'Beobachtungszeiträume zu Ende',
            text: 'Bei diesen Kindern ist der Beobachtungszeitraum vorbei:',
            content,
            className: 'pp-sheet-obs',
            buttons: [{ label: 'Später', value: null }, { label: 'Übernehmen', value: true, kind: 'primary' }]
        });
        if (v !== true) { snoozeObs(); return; }
        let reroll = 0;
        due.forEach((p, i) => {
            const c = picks[i].value;
            if (c === 'w1' || c === 'w2') p.end = addSchoolDays(p.end > t ? p.end : t, c === 'w1' ? 5 : 10);
            else { p.done = true; if (c === 'reroll') reroll++; }
        });
        saveObs();
        if (reroll) await openObsStart({ count: reroll });
    }

    /** Übersicht (jederzeit): wer wird beobachtet, wie lange noch */
    async function openObsOverview() {
        const content = document.createElement('div');
        content.className = 'pp-obs';
        const t = todayIso();
        const draw = () => {
            content.textContent = '';
            const act = activePeriods().sort((a, b) => a.end.localeCompare(b.end));
            if (!act.length) {
                const p = document.createElement('p');
                p.className = 'pp-hint';
                p.textContent = 'Gerade wird niemand beobachtet.';
                content.appendChild(p);
            }
            act.forEach(p => {
                const row = obsRow();
                const left = schoolDaysBetween(t, p.end);
                const when = p.start > t ? `beginnt ${fmtDay(p.start)} · bis ${fmtDay(p.end)}`
                    : p.end < t ? `abgelaufen seit ${fmtDay(p.end)}`
                        : left === 0 ? 'endet heute'
                            : `noch ${left} Schultag${left === 1 ? '' : 'e'} · bis ${fmtDay(p.end)}`;
                const nm = document.createElement('div');
                nm.className = 'pp-obs-name';
                nm.innerHTML = `${icon('eye')}<b>${escapeHtml(fullName(p.name))}</b><small>${escapeHtml(when)}</small>`;
                const stop = document.createElement('button');
                stop.type = 'button';
                stop.className = 'pp-btn pp-btn-small';
                stop.textContent = 'Beenden';
                stop.addEventListener('click', () => {
                    p.done = true;
                    p.endedAt = t;
                    if (p.end > t) p.end = p.start > t ? p.start : t;
                    saveObs();
                    draw();
                });
                row.append(nm, stop);
                content.appendChild(row);
            });
            const l = document.createElement('label');
            l.className = 'pp-obs-auto';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !observ.off;
            cb.addEventListener('change', () => { observ.off = !cb.checked; saveObs(); });
            l.append(cb, document.createTextNode(' Beim Öffnen der Klasse Kinder vorschlagen'));
            content.appendChild(l);
        };
        draw();
        const v = await sheet({
            title: 'Du beobachtest gerade …',
            content,
            className: 'pp-sheet-obs',
            buttons: [{ label: 'Schließen', value: null }, { label: 'Beobachtungen planen', value: 'new', kind: 'primary' }]
        });
        if (v === 'new') await openObsStart({});
    }

    /* ----- Sterne-Kategorien: jede Klasse hat ihre eigene Liste (0–10), je Daumen ½ Stern -----
       Vorlage für neue Klassen: localStorage planpad.catTemplate (Standard: Verhalten, Selbstorganisation) */
    const KEY_CAT_TPL = 'planpad.catTemplate';
    const MAX_CATS = 10;
    const DEFAULT_CATS = [
        { id: 'lob', name: 'Verhalten', max: 5, start: 3 },
        { id: 'sol', name: 'Selbstorganisation', max: 5, start: 3 }
    ];
    function normCat(c) {
        if (!c || typeof c !== 'object' || !c.id || !String(c.name || '').trim()) return null;
        const max = Math.min(10, Math.max(2, Math.round(Number(c.max) || 5)));
        const start = Math.min(max, Math.max(0, Math.round((Number(c.start) || 0) * 2) / 2));
        return { id: String(c.id), name: String(c.name).trim().slice(0, 40), max, start };
    }
    function catTemplate() {
        try {
            const v = JSON.parse(localStorage.getItem(KEY_CAT_TPL));
            if (Array.isArray(v)) return v.map(normCat).filter(Boolean).slice(0, MAX_CATS);
        } catch { /* Standard */ }
        // aus Version 1.35: eigene Kategorien „für alle Klassen“ übernehmen
        let old = [];
        try { old = JSON.parse(localStorage.getItem('planpad.ratingCats')) || []; } catch { /* egal */ }
        const extra = (Array.isArray(old) ? old : []).map(normCat).filter(c => c && !['lob', 'sol', 'soz'].includes(c.id));
        return [...DEFAULT_CATS.map(c => ({ ...c })), ...extra].slice(0, MAX_CATS);
    }
    function writeCatTemplate(list) {
        try { localStorage.setItem(KEY_CAT_TPL, JSON.stringify(list.slice(0, MAX_CATS))); } catch { /* egal */ }
    }
    /** Kategorien einer gespeicherten Klasse (ältere Klassen: Vorlage + ihre Zusatz-Kategorien) */
    function catsOfPlan(plan) {
        const own = (plan && Array.isArray(plan.ratingCats) ? plan.ratingCats : []).map(normCat).filter(Boolean);
        if (plan && plan.catsV2) return own.slice(0, MAX_CATS);
        const base = catTemplate();
        return [...base, ...own.filter(e => !base.some(b => b.id === e.id))].slice(0, MAX_CATS);
    }
    let classCats = DEFAULT_CATS.map(c => ({ ...c }));   // Kategorien der geöffneten Klasse
    function allCats() { return classCats; }
    const voteCount = id => Object.values(votes).reduce((n, r) => n + ((r && r[id]) || []).length, 0);
    /** Stift: umbenennen oder entfernen (mit allen Sternen dieser Kategorie in dieser Klasse) */
    async function editCat(cat) {
        const v = await sheet({
            title: 'Kategorie bearbeiten',
            text: 'Gilt für diese Klasse.',
            input: { label: 'Name', value: cat.name },
            buttons: [{ label: 'Entfernen', value: 'del', kind: 'danger' }, { label: 'Abbrechen', value: null }, { label: 'Speichern', value: true, kind: 'primary' }]
        });
        if (v === 'del') {
            const n = voteCount(cat.id);
            const ok = await ui.confirm(`„${cat.name}“ entfernen?`,
                n ? `Damit ${n === 1 ? 'wird auch die vergebene Stimme' : `werden auch alle ${n} vergebenen Stimmen`} dieser Kategorie in „${currentName}“ gelöscht. Das lässt sich nicht rückgängig machen.`
                    : `Die Kategorie verschwindet aus „${currentName}“. Andere Klassen bleiben unverändert.`,
                'Entfernen', true);
            if (!ok) return false;
            classCats = classCats.filter(c => c.id !== cat.id);
            Object.values(votes).forEach(r => { if (r) delete r[cat.id]; });
            saveCurrentPlan(true);
            showToast(`„${cat.name}“ entfernt.`, 'ok', 2000);
            return true;
        }
        if (typeof v !== 'string' || !v.trim() || v.trim() === cat.name) return false;
        if (classCats.some(c => c.id !== cat.id && c.name.toLocaleLowerCase('de') === v.trim().toLocaleLowerCase('de'))) { showToast(`„${v.trim()}“ gibt es schon.`, 'warn', 2500); return false; }
        classCats = classCats.map(c => (c.id === cat.id ? { ...c, name: v.trim().slice(0, 40) } : c));
        saveCurrentPlan(true);
        return true;
    }
    /** „weitere hinzufügen“: Name, Anzahl Sterne, Startwert – für diese Klasse oder alle */
    async function addCat() {
        if (classCats.length >= MAX_CATS) { showToast(`Höchstens ${MAX_CATS} Kategorien je Klasse.`, 'warn', 2500); return false; }
        const content = document.createElement('div');
        content.className = 'pp-catform';
        const nameL = document.createElement('label');
        nameL.className = 'pp-field';
        nameL.textContent = 'Name';
        const nameIn = document.createElement('input');
        nameIn.type = 'text';
        nameIn.autocomplete = 'off';
        nameIn.placeholder = 'z. B. Sozial, Hausaufgaben, Mitarbeit';
        nameL.appendChild(nameIn);
        content.appendChild(nameL);
        const row = document.createElement('div');
        row.className = 'pp-catform-row';
        content.appendChild(row);
        const sel = (label, opts, value) => {
            const l = document.createElement('label');
            l.className = 'pp-field';
            l.textContent = label;
            const s2 = document.createElement('select');
            opts.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; s2.appendChild(o); });
            s2.value = String(value);
            l.appendChild(s2);
            row.appendChild(l);
            return s2;
        };
        const maxSel = sel('Sterne', [3, 4, 5, 6, 7, 8, 9, 10].map(n => [n, `${n} Sterne`]), 5);
        let startSel = null;
        const fillStart = () => {
            const max = Number(maxSel.value);
            const keep = startSel ? Math.min(max, Number(startSel.value)) : Math.min(3, max);
            const opts = [];
            for (let v = 0; v <= max; v += 0.5) opts.push([v, fmtStars(v)]);
            if (!startSel) startSel = sel('Startwert für alle', opts, keep);
            else { startSel.textContent = ''; opts.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; startSel.appendChild(o); }); startSel.value = String(keep); }
        };
        fillStart();
        maxSel.addEventListener('change', fillStart);
        const hint = document.createElement('p');
        hint.className = 'pp-hint';
        hint.textContent = '„Für alle Klassen“ ergänzt die Kategorie in allen vorhandenen Klassen (wo noch Platz ist) und in jeder neuen Klasse.';
        content.appendChild(hint);
        setTimeout(() => nameIn.focus(), 250);
        const where = await sheet({
            title: 'Neue Kategorie hinzufügen',
            content,
            className: 'pp-sheet-cat',
            buttons: [{ label: 'Nur diese Klasse', value: 'class' }, { label: 'Für alle Klassen', value: 'all', kind: 'primary' }]
        });
        if (where !== 'class' && where !== 'all') return false;
        const name = nameIn.value.trim();
        if (!name) { showToast('Bitte einen Namen eingeben.', 'warn', 2500); return false; }
        const same = c => c.name.toLocaleLowerCase('de') === name.toLocaleLowerCase('de');
        if (classCats.some(same)) { showToast(`„${name}“ gibt es schon.`, 'warn', 2500); return false; }
        const cat = normCat({ id: `c-${newId()}`, name, max: Number(maxSel.value), start: Number(startSel.value) });
        classCats = [...classCats, cat];
        saveCurrentPlan(true);
        if (where === 'all') {
            const tpl = catTemplate();
            if (!tpl.some(same) && tpl.length < MAX_CATS) writeCatTemplate([...tpl, cat]);
            const plans = readPlans();
            let changed = false;
            Object.values(plans).forEach(pl => {
                if (!pl || pl.id === currentPlanId) return;
                const list = catsOfPlan(pl);
                if (list.length >= MAX_CATS || list.some(same)) return;
                pl.ratingCats = [...list, cat];
                pl.catsV2 = true;
                changed = true;
            });
            if (changed) writePlans(plans);
        }
        showToast(`„${name}“ hinzugefügt${where === 'class' ? ' – nur für diese Klasse' : ' – für alle Klassen'}.`, 'ok', 2500);
        return true;
    }
    function voteSeries(name, cat) {
        const arr = ((votes[name] || {})[cat.id] || []).slice().sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
        let v = cat.start;
        return arr.map(x => { v = Math.min(cat.max, Math.max(0, v + x.d * 0.5)); return { ts: x.ts, v }; });
    }
    function starsOf(name, cat) {
        const s = voteSeries(name, cat);
        return s.length ? s[s.length - 1].v : cat.start;
    }
    const fmtStars = v => String(v).replace('.', ',');
    function starsHtml(v, max = 5) {
        const row = '★'.repeat(max);
        return `<span class="pp-stars" data-s="${row}" role="img" aria-label="${fmtStars(v)} von ${max} Sternen"><i data-s="${row}" style="width:${v / max * 100}%"></i></span>`;
    }
    function addVote(name, id, d) {
        if (!votes[name]) votes[name] = {};
        if (!votes[name][id]) votes[name][id] = [];
        votes[name][id].push({ ts: new Date().toISOString(), d });
        saveCurrentPlan(true);
    }
    function undoVote(name, id) {
        const arr = (votes[name] || {})[id];
        if (!arr || !arr.length) return;
        let last = 0;
        arr.forEach((x, i) => { if (String(x.ts) >= String(arr[last].ts)) last = i; });
        arr.splice(last, 1);
        saveCurrentPlan(true);
    }
    function renderVotes(name) {
        const box = document.createElement('section');
        box.className = 'pp-votes';
        const draw = () => {
            box.textContent = '';
            allCats().forEach(cat => {
                const v = starsOf(name, cat);
                const label = cat.name;
                const row = document.createElement('div');
                row.className = 'pp-vote';
                row.dataset.kind = cat.id;
                row.innerHTML = `<span class="pp-vote-label"><span>${escapeHtml(label)}</span></span>${starsHtml(v, cat.max)}<span class="pp-vote-num">${fmtStars(v)}</span>`;
                const pen = document.createElement('button');
                pen.type = 'button';
                pen.className = 'pp-vote-edit';
                pen.title = 'Namen ändern';
                pen.setAttribute('aria-label', `${label} umbenennen`);
                pen.innerHTML = icon('edit');
                pen.addEventListener('click', async () => { if (await editCat(cat)) draw(); });
                row.querySelector('.pp-vote-label').appendChild(pen);
                const btn = (ic, d, title) => {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = `pp-vote-btn ${d > 0 ? 'is-up' : 'is-down'}`;
                    b.title = title;
                    b.setAttribute('aria-label', `${label}: ${title}`);
                    b.innerHTML = icon(ic);
                    b.addEventListener('click', () => { addVote(name, cat.id, d); draw(); });
                    return b;
                };
                row.append(btn('thumbDown', -1, 'Daumen runter (−½ Stern)'), btn('thumbUp', 1, 'Daumen hoch (+½ Stern)'));
                if (((votes[name] || {})[cat.id] || []).length) {
                    const u = document.createElement('button');
                    u.type = 'button';
                    u.className = 'pp-iconbtn pp-vote-undo';
                    u.title = 'Letzte Stimme zurücknehmen';
                    u.setAttribute('aria-label', `${label}: letzte Stimme zurücknehmen`);
                    u.innerHTML = icon('undo');
                    u.addEventListener('click', () => { undoVote(name, cat.id); draw(); });
                    row.appendChild(u);
                } else {
                    const sp = document.createElement('span');
                    sp.className = 'pp-vote-spacer';
                    row.appendChild(sp);
                }
                box.appendChild(row);
            });
            if (!allCats().length) {
                const p = document.createElement('p');
                p.className = 'pp-hint pp-vote-none';
                p.textContent = 'Keine Sterne-Kategorien in dieser Klasse.';
                box.appendChild(p);
            }
            if (allCats().length < MAX_CATS) {
                const more = document.createElement('button');
                more.type = 'button';
                more.className = 'pp-vote-more';
                more.id = 'add-cat';
                more.textContent = allCats().length ? 'weitere hinzufügen' : 'Kategorie hinzufügen';
                more.addEventListener('click', async () => { if (await addCat()) draw(); });
                box.appendChild(more);
            } else {
                const p = document.createElement('p');
                p.className = 'pp-hint pp-vote-none';
                p.textContent = `Höchstens ${MAX_CATS} Kategorien.`;
                box.appendChild(p);
            }
        };
        draw();
        return box;
    }

    /* ----- Fehlzeiten: fehlt (Kranken-Kreuz) und zu spät (Uhr), je Datum ----- */
    function normAbsences(v) {
        const okDay = s2 => typeof s2 === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s2);
        return (Array.isArray(v) ? v : []).filter(a => a && typeof a.name === 'string' && (a.from || a.to)).map(a => {
            const ts = a.from || a.to;
            const o = { id: String(a.id || newId()), name: a.name, date: okDay(a.date) ? a.date : isoDay(new Date(ts)), from: a.from || null, to: a.to || null };
            if (Number.isFinite(a.late)) o.late = a.late;
            return o;
        });
    }
    const roundUp5 = min => Math.max(5, Math.ceil(min / 5) * 5);
    function absenceToday(name) {
        const t = todayIso();
        return absences.filter(a => a.name === name && a.date === t).sort((a, b) => String(b.from || b.to).localeCompare(String(a.from || a.to)))[0] || null;
    }
    function lateText(a) {
        if (!a.to) return 'gefehlt';
        return Number.isFinite(a.late) ? `${a.late} Min. zu spät` : 'zu spät';
    }
    const fmtTime = ts => new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    /** „fehlt“ speichern: neu Gewählte eintragen, abgewählte (heute noch offene) Einträge entfernen */
    function saveAbsent(names) {
        absDayView = null;                 // Leiste springt auf den neuesten Tag
        const t = todayIso(), now = new Date().toISOString();
        const sel = new Set(names);
        let added = 0, removed = 0;
        absences = absences.filter(a => {
            if (a.date === t && !a.to && !sel.has(a.name)) { removed++; return false; }
            return true;
        });
        sel.forEach(n => {
            const a = absenceToday(n);
            if (a && !a.to) return;
            absences.push({ id: newId(), name: n, date: t, from: now, to: null });
            added++;
        });
        saveCurrentPlan(true);
        refreshSeatLabels();
        renderNotes();
        const open = absences.filter(a => a.date === t && !a.to).length;
        showToast(open ? `${countText(open, 'Kind fehlt', 'Kinder fehlen')} heute – kommt jemand später, mit dem Tür-Button eintragen.` : (removed ? 'Fehl-Einträge entfernt.' : 'Heute fehlt niemand.'), 'ok', 3500);
    }
    /** „gerade gekommen“: Verspätung = Zeit seit „fehlt“, auf 5 Minuten aufgerundet – sonst nur „zu spät“ */
    function saveArrived(names) {
        absDayView = null;                 // Leiste springt auf den neuesten Tag
        const t = todayIso(), nowD = new Date(), now = nowD.toISOString();
        const parts = [];
        names.forEach(n => {
            const a = absenceToday(n);
            if (a && !a.to) {
                a.to = now;
                a.late = roundUp5((nowD - new Date(a.from)) / 60000);
                parts.push(`${n} (${a.late} Min.)`);
            } else {
                absences.push({ id: newId(), name: n, date: t, from: null, to: now });
                parts.push(`${n} (zu spät)`);
            }
        });
        saveCurrentPlan(true);
        refreshSeatLabels();
        renderNotes();
        if (parts.length) showToast(`Eingetroffen: ${parts.join(', ')}.`, 'ok', 3500);
    }
    async function startAbsent() {
        if (!students.length) { needStudents(); return; }
        if (!squares.some(sq => sq.dataset.student)) { showToast('Erst Kinder auf Tische setzen.', 'info', 2500); return; }
        const go = await sheet({
            title: 'Wer fehlt heute?',
            text: 'Tippe auf die Tische der Kinder, die heute fehlen, und dann auf „Speichern“. Kommt jemand später, trägst Du ihn mit dem Tür-Button ein – PlanPad rechnet die Verspätung aus.',
            buttons: [{ label: 'Abbrechen', value: false }, { label: 'Kinder wählen', value: true, kind: 'primary' }]
        });
        if (go === true) startPicking('absent');
    }
    function startArrive() {
        if (!students.length) { needStudents(); return; }
        startPicking('arrive');
        showToast('Tische der Kinder antippen, die gerade gekommen sind.', 'info', 2500);
    }
    on('absent-btn', 'click', startAbsent);
    on('arrive-btn', 'click', startArrive);
    function absSummary(name) {
        const list = absences.filter(a => a.name === name);
        const missed = list.filter(a => !a.to).length;
        const late = list.filter(a => a.to);
        const mins = late.reduce((m, a) => m + (a.late || 0), 0);
        return { list, missed, late: late.length, mins };
    }
    function absLine(a) {
        return a.to ? (Number.isFinite(a.late) ? `${a.late} Min. zu spät (ab ${fmtTime(a.from)}, da ${fmtTime(a.to)})` : `zu spät (da ${fmtTime(a.to)})`) : 'gefehlt';
    }
    /** Schüleransicht: Anwesenheit kompakt, Einträge löschbar */
    function renderAbsences(name) {
        const sec = document.createElement('section');
        sec.className = 'pp-absent';
        const draw = () => {
            const s2 = absSummary(name);
            sec.innerHTML = `<div class="pp-absent-head">${icon('sick')}<b>Fehlzeiten</b><span>${s2.list.length ? `${s2.missed}× gefehlt · ${s2.late}× zu spät${s2.mins ? ` (${s2.mins} Min.)` : ''}` : 'keine'}</span></div>`;
            if (!s2.list.length) return;
            const ul = document.createElement('ul');
            ul.className = 'pp-absent-list';
            s2.list.slice().sort((a, b) => String(b.from || b.to).localeCompare(String(a.from || a.to))).slice(0, 8).forEach(a => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${escapeHtml(fmtDay(a.date))}</span><em class="${a.to ? 'pp-late-txt' : 'pp-miss-txt'}">${escapeHtml(absLine(a))}</em>`;
                const del = document.createElement('button');
                del.type = 'button';
                del.className = 'pp-iconbtn pp-absent-del';
                del.setAttribute('aria-label', 'Eintrag löschen');
                del.title = 'Eintrag löschen';
                del.innerHTML = icon('close');
                del.addEventListener('click', async () => {
                    if (!await ui.confirm('Eintrag löschen?', `${fullName(name)}, ${fmtDayLong(a.date)}: ${absLine(a)}`, 'Löschen', true)) return;
                    absences = absences.filter(x => x.id !== a.id);
                    saveCurrentPlan(true);
                    refreshSeatLabels();
                    draw();
                });
                li.appendChild(del);
                ul.appendChild(li);
            });
            sec.appendChild(ul);
        };
        draw();
        return sec;
    }
    /** ohne Auswahl: „Wer hat gefehlt?“ – Tag für Tag blättern */
    let absDayView = null;
    function renderAbsenceDays() {
        const days = [...new Set(absences.filter(a => students.includes(a.name)).map(a => a.date))].sort();
        if (!days.length) return null;
        if (!absDayView || !days.includes(absDayView)) absDayView = days[days.length - 1];
        const i = days.indexOf(absDayView);
        const sec = document.createElement('section');
        sec.className = 'pp-absdays';
        const of = absences.filter(a => a.date === absDayView && students.includes(a.name));
        const miss = of.filter(a => !a.to).map(a => a.name);
        const late = of.filter(a => a.to).map(a => `${a.name}${Number.isFinite(a.late) ? ` (${a.late} Min.)` : ''}`);
        sec.innerHTML = `<div class="pp-absdays-head">${icon('sick')}<b>Fehlzeiten</b>
            <button type="button" class="pp-iconbtn pp-absdays-prev" aria-label="Früherer Tag" ${i ? '' : 'disabled'}>‹</button>
            <span class="pp-absdays-day">${escapeHtml(absDayView === todayIso() ? 'Heute' : fmtDay(absDayView))}</span>
            <button type="button" class="pp-iconbtn pp-absdays-next" aria-label="Späterer Tag" ${i < days.length - 1 ? '' : 'disabled'}>›</button></div>
            <p>${miss.length ? `<span class="pp-miss-txt">Gefehlt:</span> ${escapeHtml(miss.join(', '))}` : ''}${miss.length && late.length ? '<br>' : ''}${late.length ? `<span class="pp-late-txt">Zu spät:</span> ${escapeHtml(late.join(', '))}` : ''}</p>`;
        sec.querySelector('.pp-absdays-prev').addEventListener('click', () => { absDayView = days[Math.max(0, i - 1)]; renderNotes(); });
        sec.querySelector('.pp-absdays-next').addEventListener('click', () => { absDayView = days[Math.min(days.length - 1, i + 1)]; renderNotes(); });
        return sec;
    }

    /* ----- Statistik ----- */
    function gradeNotes(name) {
        return (notesOfPlan(currentPlanId)[name] || []).filter(n => n && String(n.grade || '').trim())
            .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    }
    /** kleiner Verlauf (Stufenlinie) über das Schuljahr */
    function voteChart(name, cat, idx = 0) {
        const s = voteSeries(name, cat);
        const W = 300, H = 110, L = 22, R = 8, T = 8, B = 20;
        const t0 = Math.min(fromIso(schoolYearStart()).getTime(), s.length ? new Date(s[0].ts).getTime() : Infinity);
        const t1 = Math.max(Date.now(), t0 + 864e5);
        const x = ts => L + (Math.min(t1, Math.max(t0, new Date(ts).getTime())) - t0) / (t1 - t0) * (W - L - R);
        const y = v => T + (cat.max - v) / cat.max * (H - T - B);
        let grid = '';
        for (let v = 0; v <= cat.max; v++) grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="g"/><text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${v}</text>`;
        let d = `M${x(t0)},${y(cat.start)}`;
        s.forEach(p => { d += ` H${x(p.ts).toFixed(1)} V${y(p.v).toFixed(1)}`; });
        d += ` H${x(t1)}`;
        const m = t => new Date(t).toLocaleDateString('de-DE', { month: 'short' });
        const dots = s.map(p => `<circle cx="${x(p.ts).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2.6"/>`).join('');
        return `<figure class="pp-chart pp-chart-c${idx % 4}"><figcaption>${escapeHtml(cat.name)} <b>${fmtStars(starsOf(name, cat))} ★</b> · ${s.length} Stimme${s.length === 1 ? '' : 'n'}</figcaption>`
            + `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlauf ${escapeHtml(cat.name)}">${grid}<path d="${d}" class="l"/>${dots}`
            + `<text x="${L}" y="${H - 5}">${m(t0)}</text><text x="${W - R}" y="${H - 5}" text-anchor="end">heute</text></svg></figure>`;
    }
    function statsDetail(name) {
        const div = document.createElement('div');
        div.className = 'pp-stat-detail';
        const grades = gradeNotes(name);
        const per = observ.periods.filter(p => p.name === name).sort((a, b) => a.start.localeCompare(b.start));
        const t = todayIso();
        let html = `<div class="pp-chart-row">${allCats().map((c, i) => voteChart(name, c, i)).join('')}</div>`;
        html += `<h4>Noten (${grades.length})</h4>`;
        html += grades.length
            ? `<ul class="pp-stat-grades">${grades.map(n => `<li><span>${escapeHtml(new Date(n.ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }))}</span><b>${escapeHtml(n.grade)}</b><em>${n.kind ? `<small class="pp-note-kindtag">${escapeHtml(n.kind)}</small> ` : ''}${escapeHtml(n.lesson || '–')}</em></li>`).join('')}</ul>`
            : '<p class="pp-hint">Noch keine Noten eingetragen.</p>';
        const ab = absSummary(name).list.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
        html += `<h4>Fehlzeiten (${ab.length})</h4>`;
        html += ab.length
            ? `<ul class="pp-stat-grades">${ab.map(a => `<li><span>${escapeHtml(fmtDayLong(a.date))}</span><b class="${a.to ? 'pp-late-txt' : 'pp-miss-txt'}">${a.to ? 'spät' : 'fehlt'}</b><em>${escapeHtml(absLine(a))}</em></li>`).join('')}</ul>`
            : '<p class="pp-hint">Keine Fehlzeiten.</p>';
        html += `<h4>Beobachtungen (${per.length})</h4>`;
        html += per.length
            ? `<ul class="pp-stat-grades">${per.map(p => `<li><span>${escapeHtml(fmtDayLong(p.start))}</span><b>${observedDays(p)} T.</b><em>bis ${escapeHtml(fmtDayLong(p.end))}${!p.done && p.end >= t ? ' · läuft' : ''}</em></li>`).join('')}</ul>`
            : '<p class="pp-hint">Noch nicht beobachtet.</p>';
        div.innerHTML = html;
        return div;
    }
    async function openStats() {
        const rows = students.slice().sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' })).map(n => {
            const per = observ.periods.filter(p => p.name === n);
            return {
                name: n,
                phases: per.length,
                days: per.reduce((s, p) => s + observedDays(p), 0),
                grades: gradeNotes(n).length,
                stars: allCats().map(c => starsOf(n, c)),
                abs: absSummary(n),
                now: isObserved(n)
            };
        });
        const content = document.createElement('div');
        content.className = 'pp-stats';
        const seen = rows.filter(r => r.phases).length;
        const minPh = rows.length ? Math.min(...rows.map(r => r.phases)) : 0;
        content.innerHTML = `<div class="pp-stat-tiles">
            <div><b>${seen}/${rows.length}</b><span>mind. 1× beobachtet</span></div>
            <div><b>${rows.filter(r => r.now).length}</b><span>gerade beobachtet</span></div>
            <div><b>${minPh + 1}.</b><span>Beobachtungsrunde</span></div>
            <div><b>${rows.reduce((s, r) => s + r.grades, 0)}</b><span>Noten</span></div></div>`;
        const wrap = document.createElement('div');
        wrap.className = 'pp-stat-wrap';
        const table = document.createElement('table');
        table.className = 'pp-stat-table';
        table.innerHTML = '<thead><tr><th>Name</th><th title="Beobachtungsphasen">Beob.</th><th title="beobachtete Schultage">Tage</th><th>Noten</th><th title="Tage gefehlt">Gefehlt</th><th title="zu spät (Minuten)">Zu spät</th>' + allCats().map(c => `<th title="${escapeHtml(c.name)} (0–${c.max} Sterne)">${escapeHtml(c.name)}</th>`).join('') + '</tr></thead>';
        const tb = document.createElement('tbody');
        rows.forEach(r => {
            const tr = document.createElement('tr');
            tr.className = 'pp-stat-row';
            tr.tabIndex = 0;
            tr.setAttribute('aria-expanded', 'false');
            tr.innerHTML = `<td>${r.now ? icon('eye') : ''}${escapeHtml(fullName(r.name))}</td><td>${r.phases}</td><td>${r.days}</td><td>${r.grades}</td><td>${r.abs.missed}</td><td title="${r.abs.mins} Minuten">${r.abs.late}${r.abs.mins ? ` <small>(${r.abs.mins}′)</small>` : ''}</td>${r.stars.map(v => `<td>${fmtStars(v)}</td>`).join('')}`;
            let open = null;
            const toggle = () => {
                if (open) { open.remove(); open = null; tr.setAttribute('aria-expanded', 'false'); return; }
                open = document.createElement('tr');
                open.className = 'pp-stat-open';
                const td = document.createElement('td');
                td.colSpan = 6 + allCats().length;
                td.appendChild(statsDetail(r.name));
                open.appendChild(td);
                tr.after(open);
                tr.setAttribute('aria-expanded', 'true');
            };
            tr.addEventListener('click', toggle);
            tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
            tb.appendChild(tr);
        });
        table.appendChild(tb);
        wrap.appendChild(table);
        content.appendChild(wrap);
        const hint = document.createElement('p');
        hint.className = 'pp-hint';
        hint.textContent = 'Zeile antippen: Noten mit Datum und Unterrichtsnotiz, Fehlzeiten, Beobachtungszeiträume und Verlauf der Sterne.';
        content.appendChild(hint);
        await sheet({ title: `Statistik · ${currentName}`, content, className: 'pp-sheet-wide', buttons: [{ label: 'Schließen', value: null, kind: 'primary' }] });
    }

    function obsBar() {
        const bar = document.createElement('div');
        bar.className = 'pp-obs-bar';
        const n = activePeriods().length;
        const b1 = document.createElement('button');
        b1.type = 'button';
        b1.id = 'obs-btn';
        b1.className = 'pp-chipbtn pp-obs-open';
        b1.innerHTML = `${icon('eye')}<span>Beobachten</span>${n ? `<span class="pp-count">${n}</span>` : ''}`;
        b1.addEventListener('click', openObsOverview);
        const b2 = document.createElement('button');
        b2.type = 'button';
        b2.id = 'stats-btn';
        b2.className = 'pp-chipbtn pp-obs-open';
        b2.innerHTML = `${icon('chart')}<span>Statistik</span>`;
        b2.addEventListener('click', openStats);
        bar.append(b1, b2);
        return bar;
    }


    /* ----- Demoklasse: zeigt beim allerersten Start, was PlanPad kann (liegt in der App, kein Abruf von außen) ----- */
    const KEY_DEMO = 'planpad.demoDone';
    /** erster Schultag des laufenden Schuljahres (nach den Sommerferien) */
    function schoolYearStart() {
        let d = isoDay(lastAugustFirst());
        for (let guard = 0; guard < 120 && !isSchoolDay(d); guard++) d = addDays(d, 1);
        return d;
    }
    function schoolDaysAgo(n) {
        let d = todayIso();
        for (let k = 0, guard = 0; k < n && guard < 1200; guard++) { d = addDays(d, -1); if (isSchoolDay(d)) k++; }
        return d;
    }
    /**
     * Platzhalter relativ zu heute: @sd-N (Schultage zurück), @s10 (+10 Schultage), @st-N:hh:mm (Zeitpunkt).
     * Die Demo reicht bis zu 80 Schultage (ca. 4 Monate) zurück – nie vor den Schuljahresbeginn: früh im
     * Schuljahr wird der Verlauf entsprechend gestaucht.
     */
    function resolveDemoDates(v, f = null) {
        if (f === null) {
            const avail = schoolDaysBetween(schoolYearStart(), todayIso());
            f = Math.max(0, Math.min(1, (avail - 1) / 80));
        }
        if (Array.isArray(v)) return v.map(x => resolveDemoDates(x, f));
        if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveDemoDates(x, f)]));
        if (typeof v !== 'string' || v[0] !== '@') return v;
        let m = v.match(/^@sdx-(\d+)$/);            // ungestaucht (laufende Beobachtungen der Demo)
        if (m) return schoolDaysAgo(Number(m[1]));
        m = v.match(/^@sd(-?\d+)$/);
        if (m) return schoolDaysAgo(Math.round(-Number(m[1]) * f));
        m = v.match(/^@s(\d+)$/);
        if (m) return addSchoolDays(todayIso(), Number(m[1]));
        m = v.match(/^@st-(\d+):(\d+):(\d+)$/);
        if (m) {
            const n = Number(m[1]);
            const d = fromIso(schoolDaysAgo(n ? Math.max(1, Math.round(n * f)) : 0));
            d.setHours(Number(m[2]), Number(m[3]), 0, 0);
            return d.toISOString();
        }
        return v;
    }
    async function loadDemo({ auto = false } = {}) {
        try { localStorage.setItem(KEY_DEMO, '1'); } catch { /* egal */ }
        let data;
        try {
            const res = await fetch('demo/demo.json', { cache: 'no-cache' });
            if (!res.ok) throw new Error(res.status);
            data = resolveDemoDates(await res.json());
            // Beobachtungen dauern auch gestaucht 10 Schultage
            Object.values(data.plans || {}).forEach(pl => ((pl.observ || {}).periods || []).forEach(p => {
                if (p.end === '@after') p.end = addSchoolDays(p.start, OBS_DAYS);
            }));
        } catch (err) {
            console.warn('Demo:', err);
            if (!auto) ui.alert('Demoklasse nicht gefunden', 'Die Datei demo/demo.json fehlt auf dem Server.');
            return;
        }
        await importBackupText(JSON.stringify(data), { demo: true });
        app.classList.remove('is-editing-names');
        showToast('Demoklasse geladen – probier alles aus! Löschen: Menü ☰ → Papierkorb neben der Klasse.', 'ok', 6000);
    }
    on('demo-btn', 'click', () => { closeDrawer(); loadDemo(); });
    /* ==================================================
       Datenschutz: Schuljahresende
       ================================================== */
    const KEY_PRIVACY = 'planpad.privacyNotice';

    /** Letzter 1. August (Beginn des aktuellen Schuljahres) */
    function lastAugustFirst(now = new Date()) {
        const d = new Date(now.getFullYear(), 7, 1);
        return now < d ? new Date(now.getFullYear() - 1, 7, 1) : d;
    }


    async function deleteAllData(skipConfirm = false) {
        const plans = readPlans();
        const planCount = Object.keys(plans).length;
        if (!skipConfirm && !await ui.confirm('Alle Daten löschen?',
            `${countText(planCount, 'Klasse', 'Klassen')} (mit allen Sitzplänen), ${countText(totalFaceCount(), 'Foto', 'Fotos')} und ${countText(totalNoteCount(), 'Notiz', 'Notizen')} werden von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.\nTipp: Vorher bei Bedarf „Alle Klassen als Datei sichern“.`,
            'Alles löschen', true)) return false;
        noteForm = null;
        noteStudent = null;
        namesSession = null;
        try { localStorage.removeItem(KEY_PLANS); localStorage.removeItem(KEY_CURRENT); localStorage.removeItem(KEY_NOTES); localStorage.removeItem(KEY_LEARN); } catch { /* egal */ }
        facesByPlan.clear();
        faceStore.clear().catch(console.error);
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
        currentName = 'Meine Klasse';
        selectPlan(null);
        loadClass({});
        resetHistory();
        app.classList.add('is-editing-names');
        renderNotes();
        renderPlanHeader();
        renderPlanList();
        closeDrawer();
        showToast('Alle Klassen, Sitzpläne, Fotos und Notizen wurden von diesem Gerät gelöscht.', 'ok', 4000);
        return true;
    }
    on('delete-all-btn', 'click', () => deleteAllData());

    /** Beim ersten Öffnen und danach höchstens einmal pro Woche an Sicherungskopien erinnern */
    const KEY_BACKUP_NOTICE = 'planpad.backupNotice';
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    async function backupReminder() {
        let last = null;
        try { last = localStorage.getItem(KEY_BACKUP_NOTICE); } catch { /* egal */ }
        const lastTime = last ? new Date(last).getTime() : NaN;
        if (!isNaN(lastTime) && Date.now() - lastTime < WEEK_MS) return;
        try { localStorage.setItem(KEY_BACKUP_NOTICE, new Date().toISOString()); } catch { /* egal */ }
        const hasPlans = Object.keys(readPlans()).length > 0;
        const buttons = hasPlans
            ? [{ label: 'Abbrechen', value: 'ok' }, { label: 'Jetzt sichern', value: 'backup', kind: 'primary' }]
            : [{ label: 'Verstanden', value: 'ok', kind: 'primary' }];
        const choice = await sheet({
            title: 'Wichtig: Datensicherung',
            text: 'PlanPad speichert alle Daten – alle Klassen und Sitzpläne mit Notizen zu Schüler:innen – automatisch, aber ausschließlich im Speicher dieses Browsers. Werden die Browserdaten gelöscht, das Gerät gewechselt oder zurückgesetzt, sind sie verloren.',
            lines: [
                'Bitte regelmäßig Sicherungskopien anlegen:',
                'Menü ☰ → „Alle Klassen als Datei sichern“',
                'Mit Notizen oder Fotos am besten mit Passwort.'
            ],
            buttons
        });
        if (choice === 'backup') exportPlans(null);
    }

    /**
     * Allererster Schritt auf iPad/iPhone: PlanPad zum Home-Bildschirm hinzufügen.
     * Erscheint nur im Browser (nicht in der Home-Bildschirm-App) und so lange, bis „Erledigt“ getippt wurde.
     */
    const KEY_HOME_HINT = 'planpad.homeScreenDone';
    function isStandalone() {
        return window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    }
    function isAppleMobile() {
        const ua = navigator.userAgent || '';
        return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    }
    async function homeScreenHint() {
        if (isStandalone() || !isAppleMobile()) return;
        try { if (localStorage.getItem(KEY_HOME_HINT)) return; } catch { return; }
        const content = document.createElement('div');
        content.className = 'pp-homehint';
        content.innerHTML = `<img src="help/homescreen.webp" alt="Safari: Teilen → Zum Home-Bildschirm" class="pp-homehint-shot">
            <ol class="pp-homehint-steps">
                <li>In Safari auf <b>Teilen</b> tippen (Quadrat mit Pfeil nach oben – am iPad oben neben der Adresszeile, am iPhone unten).</li>
                <li>Im Menü <b>„Zum Home-Bildschirm“</b> wählen (ggf. nach unten wischen bzw. „Mehr anzeigen“).</li>
                <li><b>„Hinzufügen“</b> tippen.</li>
                <li>Safari schließen und PlanPad ab jetzt über das neue Symbol auf dem <b>Home-Bildschirm</b> starten.</li>
            </ol>
            <p class="pp-warnbox">Wichtig: Die Home-Bildschirm-App hat ihren eigenen Speicher. Was Du hier in Safari anlegst, erscheint dort nicht – lege Deine Klassen deshalb erst in der Home-Bildschirm-App an.</p>`;
        const v = await sheet({
            title: 'Erster Schritt: Zum Home-Bildschirm hinzufügen',
            text: 'Damit keine Pläne verloren gehen, füge PlanPad zuerst zu Deinem Home-Bildschirm hinzu. Safari löscht Daten von Webseiten, die länger nicht besucht wurden – als App auf dem Home-Bildschirm bleiben Deine Klassen erhalten, und PlanPad läuft auch offline.',
            content,
            buttons: [{ label: 'Erledigt', value: 'done', kind: 'primary' }]
        });
        if (v === 'done') { try { localStorage.setItem(KEY_HOME_HINT, new Date().toISOString()); } catch { /* egal */ } }
    }

    /** Einmal pro Schuljahr (erstes Öffnen nach dem 1. August) an das Löschen erinnern */
    async function privacyReminder() {
        await facesReady.catch(() => {});
        const boundary = lastAugustFirst();
        let last = null;
        try { last = localStorage.getItem(KEY_PRIVACY); } catch { /* egal */ }
        const markShown = () => { try { localStorage.setItem(KEY_PRIVACY, new Date().toISOString()); } catch { /* egal */ } };
        if (last && new Date(last) >= boundary) return;
        const planCount = Object.keys(readPlans()).length;
        if (!planCount && !totalFaceCount() && !totalNoteCount()) { markShown(); return; }   // nichts gespeichert: kein Hinweis nötig
        markShown();
        const choice = await sheet({
            title: 'Datenschutzhinweis',
            text: 'Alle Klassen und Sitzpläne müssen am Ende eines Schuljahres vom Gerät gelöscht werden!',
            lines: [`Auf diesem Gerät gespeichert: ${countText(planCount, 'Klasse', 'Klassen')}, ${countText(totalFaceCount(), 'Foto', 'Fotos')}, ${countText(totalNoteCount(), 'Notiz', 'Notizen')}.`, 'Dieser Hinweis erscheint einmal pro Schuljahr (nach dem 1. August).'],
            buttons: [
                { label: 'Alle Daten löschen …', value: 'delete', kind: 'danger' },
                { label: 'Verstanden', value: 'ok', kind: 'primary' }
            ]
        });
        if (choice === 'delete') deleteAllData();
    }

    /* ==================================================
       Start
       ================================================== */
    migrateOldPlans();
    {
        // jeder Plan bekommt eine feste ID (Fotos hängen daran, nicht am Plannamen)
        const all = readPlans();
        let changedIds = false;
        Object.values(all).forEach(pl => { if (pl && !pl.id) { pl.id = newId(); changedIds = true; } });
        if (changedIds) writePlans(all);
    }
    {
        const plans = readPlans();
        let start = null;
        try { start = localStorage.getItem(KEY_CURRENT); } catch { /* egal */ }
        if (!start || !plans[start]) {
            start = Object.keys(plans).sort((a, b) => String(plans[b].timestamp || '').localeCompare(String(plans[a].timestamp || '')))[0] || null;
        }
        if (start) {
            currentName = start;
            selectPlan(plans[start].id);
            loadClass(plans[start]);
        } else {
            selectPlan(null);
            loadClass({});
        }
        app.classList.toggle('is-editing-names', !students.length);
        resetHistory();
        autosaveTimer = null;
        renderPlanHeader();
        renderPlanList();
        renderLayoutSwitch();
    }

    updatePaneView();
    // allererster Start (noch keine Klasse, Anleitung nie gesehen): Demoklasse laden
    {
        let first = false;
        try { first = !Object.keys(readPlans()).length && !localStorage.getItem(KEY_DEMO) && !localStorage.getItem('planpad.helpSeen') && !localStorage.getItem('planpad.noDemo'); } catch { /* egal */ }
        if (first) {
            // allererster Start: kein Datenschutz-Hinweis zur Demoklasse (er käme sonst sofort) – im nächsten Schuljahr wieder
            try { localStorage.setItem(KEY_PRIVACY, new Date().toISOString()); } catch { /* egal */ }
            loadDemo({ auto: true }).catch(console.error);
        }
    }
    // Hinweise nacheinander zeigen, nie übereinander
    homeScreenHint().catch(console.error)
        .then(privacyReminder).catch(console.error)

        .then(backupReminder).catch(console.error)
        .then(observationCheck).catch(console.error);
    // angefangene Notiz sichern, wenn die App in den Hintergrund geht
    // Beim Schließen / Wechsel in den Hintergrund sofort sichern (Notiz-Entwurf und anstehende Planänderung)
    const flushAll = () => {
        if (namesSession) commitNames(false);
        clearTimeout(changeTimer);
        changed();
        if (autosaveTimer) saveCurrentPlan();
        return saveDraft();
    };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && flushAll()) renderNotes(); });
    window.addEventListener('pagehide', flushAll);

    if (missingElements.length) {
        console.warn('Fehlende Elemente:', missingElements);
        showToast('index.html und planpad.js passen nicht zusammen. Bitte alle Dateien hochladen und neu laden.', 'warn', 8000);
    }

    // Offline-Nutzung (nur über HTTPS); zwischengespeichert werden nur App-Dateien
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
        navigator.serviceWorker.register('planpad-sw.js').catch(err => console.warn('Service Worker:', err));
    }

    console.info(`PlanPad ${VERSION}`);
});
