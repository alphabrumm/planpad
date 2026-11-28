/* ==========================================================================
   PlanPad – Sperre und Verschlüsselung
   Alles läuft lokal im Browser über die eingebaute Web Crypto API.

   Schlüsselaufbau (Umschlag-Verschlüsselung, „envelope encryption“):
   - Datenschlüssel (DEK): zufälliger AES-GCM-256-Schlüssel. Er verschlüsselt jeden
     gespeicherten Eintrag einzeln (neuer 96-Bit-IV pro Eintrag, Name des Eintrags
     als „additional data“, damit Einträge nicht vertauscht werden können).
   - Der DEK wird nie im Klartext gespeichert, sondern nur „eingepackt“ (AES-GCM
     Key Wrap) mit einem der Schlüssel:
       · PIN:      PBKDF2-SHA-256, 600 000 Iterationen, 128-Bit-Salt (OWASP-Empfehlung)
       · Passkey:  WebAuthn-PRF-Erweiterung (Face ID / Touch ID), daraus HKDF-SHA-256
       · Wiederherstellungsschlüssel: 160 Bit Zufall, daraus HKDF-SHA-256
   - Eine falsche PIN fällt dadurch auf, dass das Auspacken scheitert (GCM-Prüfung);
     es gibt keinen gespeicherten PIN-Hash.
   Kein Server, keine Cloud: der Passkey dient nur als Schlüsselquelle auf dem Gerät.
   ========================================================================== */
'use strict';

const vault = (() => {
    const te = new TextEncoder();
    const td = new TextDecoder();
    let dek = null;
    const rnd = n => crypto.getRandomValues(new Uint8Array(n));
    const ad = s => te.encode('planpad:' + s);
    async function seal(str, aad) {
        const iv = rnd(12);
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: ad(aad) }, dek, te.encode(str));
        return { v: 1, iv, ct: new Uint8Array(ct) };
    }
    async function open(rec, aad) {
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv, additionalData: ad(aad) }, dek, rec.ct);
        return td.decode(pt);
    }
    return {
        active: () => Boolean(dek),
        setKey: k => { dek = k; },
        isSealed: v => Boolean(v && typeof v === 'object' && v.v === 1 && v.iv && v.ct),
        seal,
        open,
        rnd
    };
})();

const lock = (() => {
    const te = new TextEncoder();
    const PBKDF2_ITER = 600000;
    const PIN_MIN = 6;
    const PIN_MAX = 12;
    const AUTO_CHOICES = [2, 5, 10, 30];
    const AUTO_DEFAULT = 5;
    const rnd = vault.rnd;
    let meta = null;            // gespeicherte Schlüssel-Hüllen (ohne Geheimnisse im Klartext)
    let root = null;
    let keyHandler = null;

    /* ---------- Hilfen ---------- */
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const sameBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    function shuffled(list) {
        const a = list.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const r = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
            [a[i], a[r]] = [a[r], a[i]];
        }
        return a;
    }
    const testFlag = k => { try { return localStorage.getItem(k); } catch { return null; } };
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    /* ---------- Schlüssel ---------- */
    async function kekFromPin(pin, salt, iter) {
        const base = await crypto.subtle.importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
            base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
    }
    async function kekFromSecret(bytes, salt, info) {
        const base = await crypto.subtle.importKey('raw', bytes, 'HKDF', false, ['deriveKey']);
        return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: te.encode(info) },
            base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
    }
    async function wrap(dek, kek, slot) {
        const iv = rnd(12);
        const w = await crypto.subtle.wrapKey('raw', dek, kek, { name: 'AES-GCM', iv, additionalData: te.encode('planpad-dek:' + slot) });
        return { iv, w: new Uint8Array(w) };
    }
    function unwrap(h, kek, slot, extractable) {
        return crypto.subtle.unwrapKey('raw', h.w, kek, { name: 'AES-GCM', iv: h.iv, additionalData: te.encode('planpad-dek:' + slot) },
            { name: 'AES-GCM', length: 256 }, extractable, ['encrypt', 'decrypt']);
    }
    async function pinSlot(dek, pin) {
        const salt = rnd(16);
        return { salt, iter: PBKDF2_ITER, ...await wrap(dek, await kekFromPin(pin, salt, PBKDF2_ITER), 'pin') };
    }
    async function openPin(pin, extractable) {
        const s = meta.pin;
        return unwrap(s, await kekFromPin(pin, s.salt, s.iter), 'pin', extractable);
    }

    /* Wiederherstellungsschlüssel: 160 Bit, Crockford-Base32 (ohne I, L, O, U), 8 Vierergruppen */
    const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    function toB32(bytes) {
        let bits = 0, val = 0, out = '';
        bytes.forEach(b => { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } });
        if (bits) out += B32[(val << (5 - bits)) & 31];
        return out.match(/.{1,4}/g).join('-');
    }
    function fromB32(text) {
        const s = String(text).toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
        if (s.length !== 32) return null;
        let bits = 0, val = 0;
        const out = [];
        for (const c of s) {
            const i = B32.indexOf(c);
            if (i < 0) return null;
            val = ((val << 5) | i) & 0xffff; bits += 5;
            if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
        }
        return new Uint8Array(out);
    }
    async function recoverySlot(dek) {
        const secret = rnd(20);
        const salt = rnd(16);
        const slot = { salt, ...await wrap(dek, await kekFromSecret(secret, salt, 'planpad-recovery'), 'recovery') };
        return { slot, code: toB32(secret) };
    }
    async function openRecovery(code, extractable) {
        const secret = fromB32(code);
        if (!secret) throw new Error('format');
        const s = meta.recovery;
        return unwrap(s, await kekFromSecret(secret, s.salt, 'planpad-recovery'), 'recovery', extractable);
    }

    /* Passkeys (WebAuthn, nur auf dem Gerät; PRF liefert das Geheimnis für den Schlüssel) */
    const pkAvailable = () => Boolean(window.PublicKeyCredential && navigator.credentials && window.isSecureContext);
    async function pkGet(list) {
        const evalByCredential = {};
        list.forEach(p => { evalByCredential[b64u(p.id)] = { first: p.prfSalt }; });
        const a = await navigator.credentials.get({ publicKey: {
            challenge: rnd(32), rpId: location.hostname, timeout: 120000, userVerification: 'required',
            allowCredentials: list.map(p => ({ type: 'public-key', id: p.id })),
            extensions: { prf: { evalByCredential } }
        } });
        const r = a.getClientExtensionResults().prf;
        if (!r || !r.results || !r.results.first) throw new Error('noprf');
        return { id: new Uint8Array(a.rawId), out: new Uint8Array(r.results.first) };
    }
    async function pkCreate(dek) {
        const prfSalt = rnd(32);
        const day = new Date().toLocaleDateString('de-DE');
        const cred = await navigator.credentials.create({ publicKey: {
            rp: { name: 'PlanPad', id: location.hostname },
            user: { id: rnd(16), name: `PlanPad (${day})`, displayName: 'PlanPad' },
            challenge: rnd(32),
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
            authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
            attestation: 'none',
            timeout: 120000,
            extensions: { prf: { eval: { first: prfSalt } } }
        } });
        const id = new Uint8Array(cred.rawId);
        const ext = cred.getClientExtensionResults().prf;
        let out = ext && ext.results && ext.results.first ? new Uint8Array(ext.results.first) : null;
        try {
            if (!ext || ext.enabled === false) throw new Error('noprf');
            if (!out) out = (await pkGet([{ id, prfSalt }])).out;     // manche Geräte liefern PRF erst beim Anmelden
        } catch (err) {
            // Passkey ohne PRF ist für die Entschlüsselung nutzlos – dem Gerät melden, dass er entfernt werden kann
            try { if (PublicKeyCredential.signalUnknownCredential) await PublicKeyCredential.signalUnknownCredential({ rpId: location.hostname, credentialId: b64u(id) }); } catch { /* egal */ }
            throw err;
        }
        return { id, prfSalt, created: new Date().toISOString(), ...await wrap(dek, await kekFromSecret(out, prfSalt, 'planpad-passkey'), 'passkey') };
    }
    async function openPasskey(extractable) {
        const got = await pkGet(meta.passkeys);
        const slot = meta.passkeys.find(p => sameBytes(p.id, got.id));
        if (!slot) throw new Error('unknown');
        return unwrap(slot, await kekFromSecret(got.out, slot.prfSalt, 'planpad-passkey'), 'passkey', extractable);
    }
    function pkErrorText(err) {
        if (err && err.message === 'noprf') return 'Dieses Gerät kann mit einem Passkey keine Daten entschlüsseln (nötig: iPadOS/iOS 18 oder neuer, Safari). Bitte die PIN verwenden.';
        if (err && (err.name === 'NotAllowedError' || err.name === 'AbortError')) return 'Abgebrochen oder nicht bestätigt.';
        return 'Das hat nicht geklappt. Bitte die PIN verwenden.';
    }

    /* ---------- Fehlversuche bremsen ---------- */
    function waitLeft() { return Math.max(0, (meta.waitUntil || 0) - Date.now()); }
    async function noteFail() {
        meta.fails = (meta.fails || 0) + 1;
        if (meta.fails >= 5) meta.waitUntil = Date.now() + Math.min(15 * 60e3, 30e3 * 2 ** (meta.fails - 5));
        await kv.saveMeta(meta).catch(() => {});
    }
    async function noteSuccess() {
        if (meta.fails || meta.waitUntil) { meta.fails = 0; meta.waitUntil = 0; await kv.saveMeta(meta).catch(() => {}); }
    }

    /* ---------- Oberfläche ---------- */
    const LOGO = '<img class="pp-lock-logo" src="planpad-icon.svg" alt="">';
    const WARN = '<div class="pp-lock-warn"><b>Wichtig – unbedingt lesen:</b> PlanPad verschlüsselt alle Klassen, Notizen und Fotos auf diesem Gerät. '
        + 'Es gibt keinen Server und keine Hintertür. <b>Wenn PIN, Passkey und Wiederherstellungsschlüssel verloren gehen, sind alle Daten unwiederbringlich verloren</b> – '
        + 'niemand kann sie dann wiederherstellen, auch der Entwickler nicht.</div>';
    function overlay() {
        if (!root) {
            root = document.createElement('div');
            root.id = 'pp-lock';
            root.className = 'pp-lock';
            root.setAttribute('role', 'dialog');
            root.setAttribute('aria-modal', 'true');
            root.setAttribute('aria-label', 'PlanPad-Sperre');
            document.body.appendChild(root);
        }
        document.documentElement.classList.add('pp-locked');
        return root;
    }
    function closeOverlay() {
        setKeys(null);
        if (root) { root.remove(); root = null; }
        document.documentElement.classList.remove('pp-locked');
    }
    function screen(html) {
        setKeys(null);
        const r = overlay();
        r.innerHTML = `<div class="pp-lock-card">${html}</div>`;
        r.scrollTop = 0;
        return r.querySelector('.pp-lock-card');
    }
    function setKeys(fn) {
        if (keyHandler) document.removeEventListener('keydown', keyHandler, true);
        keyHandler = fn;
        if (fn) document.addEventListener('keydown', fn, true);
    }
    const $ = (card, sel) => card.querySelector(sel);
    function message(card, text, kind = 'error') {
        const m = $(card, '.pp-lock-msg');
        if (!m) return;
        m.textContent = text || '';
        m.className = 'pp-lock-msg' + (text ? ' is-' + kind : '');
    }

    /** Ziffernfeld: gewohnte Anordnung, keine Hervorhebung beim Tippen, verrät die Länge nicht */
    function pinPad(card, onSubmit, okLabel = 'OK') {
        const host = $(card, '.pp-pin');
        let val = '';
        let busy = false;
        const field = document.createElement('div');
        field.className = 'pp-pin-field';
        field.setAttribute('aria-label', 'PIN-Eingabe');
        const grid = document.createElement('div');
        grid.className = 'pp-pin-grid';
        host.replaceChildren(field, grid);
        const show = () => {
            field.classList.toggle('has-input', val.length > 0);
            field.textContent = val.length ? '● ● ● ●' : 'PIN eingeben';
        };
        const pulse = () => { field.classList.remove('is-pulse'); void field.offsetWidth; field.classList.add('is-pulse'); };
        function layout() {
            // gewohnte Anordnung wie am Telefon: 1 2 3 / 4 5 6 / 7 8 9 / Löschen 0 OK
            const keys = [...'123456789', 'clear', '0', 'ok'];
            grid.replaceChildren(...keys.map(k => {
                const b = document.createElement('button');
                b.type = 'button';
                if (k === 'clear') { b.className = 'pp-pin-key is-fn'; b.textContent = 'Löschen'; b.dataset.fn = 'clear'; }
                else if (k === 'ok') { b.className = 'pp-pin-key is-ok'; b.textContent = okLabel; b.dataset.fn = 'ok'; }
                else { b.className = 'pp-pin-key'; b.textContent = k; b.dataset.d = k; }
                return b;
            }));
        }
        async function submit() {
            if (busy || !val) return;
            busy = true;
            grid.classList.add('is-busy');
            const pin = val;
            val = '';
            show();
            let err = null;
            try { err = await onSubmit(pin); } catch (e) { err = 'Unerwarteter Fehler.'; console.error(e); }
            busy = false;
            grid.classList.remove('is-busy');
            if (err) { message(card, err); layout(); }
        }
        const press = k => {
            if (busy) return;
            if (k === 'clear') { val = ''; show(); return; }
            if (k === 'ok') { submit(); return; }
            if (val.length < PIN_MAX) { val += k; show(); pulse(); message(card, ''); }
        };
        grid.addEventListener('click', e => {
            const b = e.target.closest('button');
            if (b) press(b.dataset.fn || b.dataset.d);
        });
        setKeys(e => {
            if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
            if (/^[0-9]$/.test(e.key)) { press(e.key); e.preventDefault(); }
            else if (e.key === 'Backspace' || e.key === 'Escape') { press('clear'); e.preventDefault(); }
            else if (e.key === 'Enter') { press('ok'); e.preventDefault(); }
        });
        layout();
        show();
        return { relayout: layout };
    }

    function pinProblem(pin) {
        if (pin.length < PIN_MIN) return `Die PIN braucht mindestens ${PIN_MIN} Ziffern (empfohlen: 8 oder mehr).`;
        if (/^(\d)\1+$/.test(pin)) return 'Bitte keine PIN aus lauter gleichen Ziffern.';
        const up = '01234567890123456789', down = '98765432109876543210';
        if (up.includes(pin) || down.includes(pin)) return 'Bitte keine Ziffernfolge wie 123456.';
        if (/^(\d\d?)\1+$/.test(pin)) return 'Bitte kein einfaches Muster wie 121212.';
        return null;
    }

    /** neue PIN zweimal eingeben */
    function choosePin(title, intro) {
        return new Promise(resolve => {
            let first = null;
            const card = screen(`${LOGO}<h1>${esc(title)}</h1>
                <p class="pp-lock-text">${intro}</p>
                <p class="pp-lock-step">Neue PIN eingeben (${PIN_MIN}–${PIN_MAX} Ziffern, empfohlen 8 oder mehr)</p>
                <div class="pp-pin"></div><p class="pp-lock-msg" role="alert"></p>`);
            pinPad(card, async pin => {
                if (first === null) {
                    const p = pinProblem(pin);
                    if (p) return p;
                    first = pin;
                    $(card, '.pp-lock-step').textContent = 'PIN zur Bestätigung noch einmal eingeben';
                    message(card, '');
                    return null;
                }
                if (pin !== first) {
                    first = null;
                    $(card, '.pp-lock-step').textContent = `Neue PIN eingeben (${PIN_MIN}–${PIN_MAX} Ziffern, empfohlen 8 oder mehr)`;
                    return 'Die beiden Eingaben stimmen nicht überein. Bitte noch einmal von vorn.';
                }
                resolve(pin);
                return null;
            }, 'Weiter');
        });
    }

    function downloadCode(code) {
        const text = 'PlanPad – Wiederherstellungsschlüssel\n'
            + `Erstellt am ${new Date().toLocaleString('de-DE')} für ${location.host}\n\n${code}\n\n`
            + 'Damit lässt sich PlanPad entsperren, wenn PIN und Passkey nicht mehr verfügbar sind.\n'
            + 'Sicher und getrennt vom iPad aufbewahren (ausdrucken oder in einem Passwortmanager speichern).\n'
            + 'Wer diesen Schlüssel und das Gerät hat, kann die Daten lesen.\n';
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'PlanPad-Wiederherstellungsschluessel.txt';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    /** Wiederherstellungsschlüssel zeigen und bestätigen lassen */
    function showRecovery(code, isNew = true) {
        return new Promise(resolve => {
            const last = code.slice(-4);
            const card = screen(`${LOGO}<h1>Wiederherstellungsschlüssel</h1>
                ${WARN}
                <p class="pp-lock-text">Mit diesem Schlüssel kommst du an deine Daten, falls du die PIN vergisst und Face ID/Passkey nicht mehr geht.
                ${isNew ? '' : '<b>Ein früherer Wiederherstellungsschlüssel gilt ab jetzt nicht mehr.</b>'}</p>
                <p class="pp-lock-hint">Achte darauf, dass der Bildschirm gerade <b>nicht</b> auf einen Beamer übertragen wird.</p>
                <div class="pp-lock-code" aria-live="polite"><button type="button" class="pp-btn pp-btn-small" data-act="show">Schlüssel anzeigen</button></div>
                <div class="pp-lock-row">
                    <button type="button" class="pp-btn pp-btn-small" data-act="file">Als Datei speichern</button>
                    <button type="button" class="pp-btn pp-btn-small" data-act="copy">Kopieren</button>
                </div>
                <p class="pp-lock-text">Bewahre ihn <b>getrennt vom iPad</b> auf: ausdrucken und sicher ablegen oder in einem Passwortmanager speichern.</p>
                <label class="pp-lock-field"><span>Zur Kontrolle: die <b>letzten 4 Zeichen</b> des Schlüssels</span>
                    <input type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="4" data-act="last"></label>
                <label class="pp-lock-check"><input type="checkbox" data-act="ok"> Ich habe den Wiederherstellungsschlüssel sicher aufbewahrt. Mir ist klar, dass ohne PIN, Passkey und diesen Schlüssel alle Daten verloren sind.</label>
                <p class="pp-lock-msg" role="alert"></p>
                <div class="pp-lock-actions"><button type="button" class="pp-btn pp-btn-primary" data-act="done">Weiter</button></div>`);
            card.addEventListener('click', async e => {
                const act = e.target.closest('[data-act]') && e.target.closest('[data-act]').dataset.act;
                if (act === 'show') $(card, '.pp-lock-code').innerHTML = `<code>${esc(code)}</code>`;
                if (act === 'file') downloadCode(code);
                if (act === 'copy') {
                    try { await navigator.clipboard.writeText(code); message(card, 'Kopiert – jetzt sicher ablegen (z. B. im Passwortmanager).', 'ok'); }
                    catch { message(card, 'Kopieren ist hier nicht möglich – bitte als Datei speichern oder abschreiben.'); }
                }
                if (act === 'done') {
                    const typed = $(card, '[data-act=last]').value.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
                    if (typed !== last) { message(card, 'Die letzten 4 Zeichen stimmen nicht – bitte den Schlüssel prüfen.'); return; }
                    if (!$(card, '[data-act=ok]').checked) { message(card, 'Bitte bestätige, dass du den Schlüssel sicher aufbewahrt hast.'); return; }
                    resolve();
                }
            });
        });
    }

    /** Passkey anbieten; gibt den neuen Slot oder null zurück */
    function offerPasskey(dek, setup) {
        return new Promise(resolve => {
            if (!pkAvailable()) { resolve(null); return; }
            const card = screen(`${LOGO}<h1>Mit Face ID entsperren</h1>
                <p class="pp-lock-text">Empfohlen: Lege einen <b>Passkey</b> an. Dann entsperrst du PlanPad mit Face ID oder Touch ID – auf dem Beamer ist dabei nichts zu erkennen.</p>
                <p class="pp-lock-hint">Die Gesichtsprüfung macht das Gerät selbst; PlanPad bekommt weder dein Gesicht noch ein Foto. Der Passkey liegt im Schlüsselbund des Geräts (bei Apple ggf. im iCloud-Schlüsselbund) – deine Klassendaten bleiben verschlüsselt auf diesem Gerät.</p>
                <p class="pp-lock-msg" role="alert"></p>
                <div class="pp-lock-actions">
                    <button type="button" class="pp-btn" data-act="skip">${setup ? 'Nur PIN verwenden' : 'Abbrechen'}</button>
                    <button type="button" class="pp-btn pp-btn-primary" data-act="add">Passkey anlegen</button>
                </div>`);
            card.addEventListener('click', async e => {
                const b = e.target.closest('[data-act]');
                if (!b) return;
                if (b.dataset.act === 'skip') { resolve(null); return; }
                b.disabled = true;
                try { resolve(await pkCreate(dek)); }
                catch (err) { console.warn(err); message(card, pkErrorText(err)); b.disabled = false; }
            });
        });
    }

    /* ---------- Ersteinrichtung ---------- */
    async function setup() {
        const first = await new Promise(resolve => {
            const card = screen(`${LOGO}<h1>PlanPad schützen</h1>
                <p class="pp-lock-text">Ab jetzt ist PlanPad beim Start gesperrt und alle Daten (Klassen, Sitzpläne, Notizen, Sterne, Fehlzeiten und Fotos) werden <b>auf diesem Gerät verschlüsselt</b> gespeichert (AES-256).</p>
                <ul class="pp-lock-list">
                    <li><b>PIN</b> – Tasten leuchten beim Tippen nicht auf, die Länge bleibt verborgen</li>
                    <li><b>Face ID / Passkey</b> zum schnellen Entsperren (empfohlen)</li>
                    <li><b>Wiederherstellungsschlüssel</b> für den Notfall</li>
                </ul>
                ${WARN}
                <div class="pp-lock-actions"><button type="button" class="pp-btn pp-btn-primary" data-act="go">Einrichten</button></div>
                <div class="pp-welcome-choices pp-setup-demo">
                    <button type="button" class="pp-welcome-choice" data-act="demo">
                        <b>PlanPad Demo ansehen</b><span>Erst in Ruhe ausprobieren – ohne PIN, es wird nichts gespeichert. Vorhandene Klassen bleiben unverändert.</span></button>
                </div>`);
            $(card, '[data-act=go]').addEventListener('click', () => resolve('go'));
            $(card, '[data-act=demo]').addEventListener('click', () => resolve('demo'));
        });
        if (first === 'demo') return 'demo';
        const pin = await choosePin('PIN festlegen', 'Die PIN brauchst du, wenn Face ID nicht verfügbar ist. Wähle keine Zahl, die man leicht errät (Geburtsdatum, Raumnummer …).');
        const busy = screen(`${LOGO}<h1>Einen Moment …</h1><p class="pp-lock-text">Schlüssel werden erzeugt.</p>`);
        void busy;
        const dek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
        const rec = await recoverySlot(dek);
        const m = { v: 1, created: new Date().toISOString(), pin: await pinSlot(dek, pin), recovery: rec.slot, passkeys: [], autoLock: AUTO_DEFAULT, fails: 0, waitUntil: 0 };
        await showRecovery(rec.code);
        const pk = await offerPasskey(dek, true);
        if (pk) m.passkeys.push(pk);
        screen(`${LOGO}<h1>Daten werden verschlüsselt …</h1><p class="pp-lock-text">Bitte PlanPad nicht schließen.</p>`);
        meta = m;
        // erst die Schlüssel-Hüllen speichern, dann verschlüsseln: so bleibt jeder Zwischenstand lesbar
        await kv.saveMeta(meta);
        vault.setKey(await openPin(pin, false));    // im Betrieb nur ein nicht exportierbarer Schlüssel
        await kv.sealAll();
        await sealFaces();
        fresh = true;
        closeOverlay();
    }

    /** vorhandene Gesichtsausschnitte verschlüsseln */
    function sealFaces() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('sitzplan-fotos', 1);
            req.onupgradeneeded = () => req.result.createObjectStore('faces');
            req.onerror = () => reject(req.error);
            req.onsuccess = async () => {
                const d = req.result;
                try {
                    const pairs = await new Promise((res, rej) => {
                        const out = [];
                        const c = d.transaction('faces', 'readonly').objectStore('faces').openCursor();
                        c.onsuccess = () => { const cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } else res(out); };
                        c.onerror = () => rej(c.error);
                    });
                    const todo = [];
                    for (const [k, v] of pairs) if (typeof v === 'string') todo.push([k, await vault.seal(v, lock.faceAad(k))]);
                    if (todo.length) {
                        await new Promise((res, rej) => {
                            const tx = d.transaction('faces', 'readwrite');
                            todo.forEach(([k, v]) => tx.objectStore('faces').put(v, k));
                            tx.oncomplete = res;
                            tx.onerror = () => rej(tx.error);
                        });
                    }
                    d.close();
                    resolve();
                } catch (err) { d.close(); reject(err); }
            };
        });
    }

    /* ---------- Entsperren ---------- */
    function unlockScreen() {
        return new Promise(resolve => {
            const hasPk = meta.passkeys && meta.passkeys.length && pkAvailable();
            const card = screen(`${LOGO}<h1>PlanPad ist gesperrt</h1>
                ${hasPk ? '<div class="pp-lock-actions is-center"><button type="button" class="pp-btn pp-btn-primary pp-lock-pk" data-act="pk">Mit Face ID / Passkey entsperren</button></div><p class="pp-lock-or">oder mit PIN</p>' : ''}
                <div class="pp-pin"></div>
                <p class="pp-lock-msg" role="alert"></p>
                <div class="pp-lock-links">
                    <button type="button" class="pp-textlink" data-act="rec">Wiederherstellungsschlüssel verwenden</button>
                    <button type="button" class="pp-textlink" data-act="reset">Alles vergessen?</button>
                </div>`);
            const waitMsg = () => {
                const s = Math.ceil(waitLeft() / 1000);
                return s ? `Zu viele Fehlversuche. Bitte ${s > 90 ? Math.ceil(s / 60) + ' Minuten' : s + ' Sekunden'} warten.` : '';
            };
            if (waitLeft()) message(card, waitMsg());
            pinPad(card, async pin => {
                if (waitLeft()) return waitMsg();
                try {
                    const dek = await openPin(pin, false);
                    await noteSuccess();
                    resolve(dek);
                    return null;
                } catch {
                    await noteFail();
                    return waitLeft() ? waitMsg() : 'Falsche PIN.';
                }
            }, 'Öffnen');
            card.addEventListener('click', async e => {
                const b = e.target.closest('[data-act]');
                if (!b) return;
                if (b.dataset.act === 'pk') {
                    b.disabled = true;
                    try { const dek = await openPasskey(false); await noteSuccess(); resolve(dek); }
                    catch (err) { console.warn(err); message(card, pkErrorText(err)); b.disabled = false; }
                }
                if (b.dataset.act === 'rec') resolve(await recoveryScreen());
                if (b.dataset.act === 'reset') await resetScreen();
            });
        });
    }

    function recoveryScreen() {
        return new Promise(resolve => {
            const card = screen(`${LOGO}<h1>Mit Wiederherstellungsschlüssel öffnen</h1>
                <label class="pp-lock-field">Wiederherstellungsschlüssel (8 Gruppen à 4 Zeichen)
                    <input type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" data-act="code" placeholder="XXXX-XXXX-…"></label>
                <p class="pp-lock-msg" role="alert"></p>
                <div class="pp-lock-actions">
                    <button type="button" class="pp-btn" data-act="back">Zurück</button>
                    <button type="button" class="pp-btn pp-btn-primary" data-act="open">Öffnen</button>
                </div>`);
            $(card, '[data-act=code]').focus();
            card.addEventListener('click', async e => {
                const b = e.target.closest('button[data-act]');
                if (!b) return;
                if (b.dataset.act === 'back') { resolve(await unlockScreen()); return; }
                if (b.dataset.act !== 'open') return;
                if (waitLeft()) { message(card, 'Zu viele Fehlversuche – bitte kurz warten.'); return; }
                let dek;
                try { dek = await openRecovery($(card, '[data-act=code]').value, true); }
                catch (err) {
                    if (!err || err.message !== 'format') await noteFail();
                    message(card, err && err.message === 'format' ? 'Der Schlüssel hat 32 Zeichen (Buchstaben und Ziffern).' : 'Dieser Schlüssel passt nicht.');
                    return;
                }
                await noteSuccess();
                // PIN neu festlegen – die alte ist offenbar vergessen
                const pin = await choosePin('Neue PIN festlegen', 'Der Wiederherstellungsschlüssel hat gepasst. Lege jetzt eine neue PIN fest.');
                meta.pin = await pinSlot(dek, pin);
                await kv.saveMeta(meta);
                resolve(dek);
            });
        });
    }

    function resetScreen() {
        return new Promise(resolve => {
            const card = screen(`${LOGO}<h1>Alles vergessen?</h1>
                <p class="pp-lock-text">Ohne PIN, Passkey oder Wiederherstellungsschlüssel lassen sich die verschlüsselten Daten <b>nicht</b> mehr öffnen – von niemandem.</p>
                <p class="pp-lock-text">Du kannst PlanPad hier zurücksetzen: <b>Alle Klassen, Notizen und Fotos auf diesem Gerät werden endgültig gelöscht.</b> Danach kannst du Klassen aus einer Sicherungsdatei wieder öffnen.</p>
                <label class="pp-lock-field"><span>Zum Bestätigen <b>LÖSCHEN</b> eingeben</span>
                    <input type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" data-act="word"></label>
                <p class="pp-lock-msg" role="alert"></p>
                <div class="pp-lock-actions">
                    <button type="button" class="pp-btn" data-act="back">Zurück</button>
                    <button type="button" class="pp-btn pp-btn-danger" data-act="wipe">Alles löschen</button>
                </div>`);
            card.addEventListener('click', async e => {
                const b = e.target.closest('button[data-act]');
                if (!b) return;
                if (b.dataset.act === 'back') { location.reload(); resolve(); return; }
                if (b.dataset.act !== 'wipe') return;
                if ($(card, '[data-act=word]').value.trim().toUpperCase() !== 'LÖSCHEN') { message(card, 'Bitte genau LÖSCHEN eingeben.'); return; }
                b.disabled = true;
                await wipeEverything();
                location.reload();
            });
        });
    }
    async function wipeEverything() {
        kv.close();
        const del = name => new Promise(res => { const r = indexedDB.deleteDatabase(name); r.onsuccess = r.onerror = r.onblocked = () => res(); });
        await del('planpad');
        await del('sitzplan-fotos');
        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('planpad.') && k !== 'planpad.theme' && k !== 'planpad.accent') keys.push(k); }
            keys.forEach(k => localStorage.removeItem(k));
        } catch { /* egal */ }
    }

    /* ---------- Sperren im Betrieb ---------- */
    let autoMs = AUTO_DEFAULT * 60e3;
    let lastUse = Date.now();
    let hiddenAt = 0;
    let locking = false;
    async function lockNow() {
        if (locking || !meta) return;
        locking = true;
        // sofort alles verdecken, dann ausstehende Änderungen schreiben und neu laden (Schlüssel verlässt den Speicher)
        screen(`${LOGO}<h1>PlanPad wird gesperrt …</h1>`);
        try { await Promise.race([kv.flush(), sleep(3000)]); } catch { /* egal */ }
        try { if (lock.beforeLock) await Promise.race([lock.beforeLock(), sleep(2000)]); } catch { /* egal */ }
        location.reload();
    }
    function startAutoLock() {
        const t = Number(testFlag('planpad.testAutoLockMs'));
        autoMs = (meta.autoLock || AUTO_DEFAULT) * 60e3;
        if (t > 0) autoMs = Math.min(autoMs, t);     // nur für Tests: kann die Zeit verkürzen, nie verlängern
        const touch = () => { lastUse = Date.now(); };
        ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => document.addEventListener(ev, touch, { capture: true, passive: true }));
        setInterval(() => { if (!document.hidden && Date.now() - lastUse > autoMs) lockNow(); }, Math.min(5000, Math.max(250, autoMs / 4)));
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) hiddenAt = Date.now();
            else if (hiddenAt && (Date.now() - hiddenAt > Math.min(autoMs, 60e3) || Date.now() - lastUse > autoMs)) lockNow();
        });
    }

    /* ---------- Bestätigen für Änderungen (PIN oder Passkey) ---------- */
    function reauth(title) {
        return new Promise(resolve => {
            const hasPk = meta.passkeys.length && pkAvailable();
            const card = screen(`${LOGO}<h1>${esc(title)}</h1>
                <p class="pp-lock-text">Zur Sicherheit bitte bestätigen.</p>
                ${hasPk ? '<div class="pp-lock-actions is-center"><button type="button" class="pp-btn pp-btn-primary" data-act="pk">Mit Face ID / Passkey bestätigen</button></div><p class="pp-lock-or">oder mit der aktuellen PIN</p>' : '<p class="pp-lock-step">Aktuelle PIN eingeben</p>'}
                <div class="pp-pin"></div>
                <p class="pp-lock-msg" role="alert"></p>
                <div class="pp-lock-actions"><button type="button" class="pp-btn" data-act="cancel">Abbrechen</button></div>`);
            pinPad(card, async pin => {
                if (waitLeft()) return 'Zu viele Fehlversuche – bitte kurz warten.';
                try { const dek = await openPin(pin, true); await noteSuccess(); resolve(dek); return null; }
                catch { await noteFail(); return 'Falsche PIN.'; }
            }, 'OK');
            card.addEventListener('click', async e => {
                const b = e.target.closest('button[data-act]');
                if (!b) return;
                if (b.dataset.act === 'cancel') resolve(null);
                if (b.dataset.act === 'pk') {
                    b.disabled = true;
                    try { resolve(await openPasskey(true)); }
                    catch (err) { message(card, pkErrorText(err)); b.disabled = false; }
                }
            });
        });
    }

    /* ---------- Einstellungen „Sicherheit“ ---------- */
    async function settings() {
        if (!meta) return;
        for (;;) {
            const choice = await new Promise(resolve => {
                const n = meta.passkeys.length;
                const card = screen(`${LOGO}<h1>Sicherheit</h1>
                    <p class="pp-lock-text">Alle Daten sind auf diesem Gerät verschlüsselt (AES-256). Entsperren mit PIN${n ? ' oder Face ID/Passkey' : ''}.</p>
                    <h2>Automatisch sperren nach</h2>
                    <div class="pp-segmented pp-segmented-small pp-lock-auto">${AUTO_CHOICES.map(m => `<button type="button" data-auto="${m}" aria-pressed="${(meta.autoLock || AUTO_DEFAULT) === m}">${m} Min.</button>`).join('')}</div>
                    <p class="pp-lock-hint">Ohne Bedienung oder wenn PlanPad länger im Hintergrund war. Sofort sperren: Menü → „Jetzt sperren“.</p>
                    <h2>Face ID / Passkey</h2>
                    <p class="pp-lock-text">${n ? `${n === 1 ? 'Ein Passkey ist' : n + ' Passkeys sind'} eingerichtet.` : 'Kein Passkey eingerichtet.'}</p>
                    <div class="pp-lock-row">
                        ${pkAvailable() ? '<button type="button" class="pp-btn pp-btn-small" data-act="pk-add">Passkey hinzufügen</button>' : ''}
                        ${n ? '<button type="button" class="pp-btn pp-btn-small" data-act="pk-del">Passkeys entfernen</button>' : ''}
                    </div>
                    <h2>PIN und Notfall</h2>
                    <div class="pp-lock-row">
                        <button type="button" class="pp-btn pp-btn-small" data-act="pin">PIN ändern</button>
                        <button type="button" class="pp-btn pp-btn-small" data-act="rec">Neuen Wiederherstellungsschlüssel erstellen</button>
                    </div>
                    ${WARN}
                    <p class="pp-lock-msg" role="alert"></p>
                    <div class="pp-lock-actions"><button type="button" class="pp-btn pp-btn-primary" data-act="close">Fertig</button></div>`);
                card.addEventListener('click', e => {
                    const a = e.target.closest('[data-auto]');
                    if (a) { resolve('auto:' + a.dataset.auto); return; }
                    const b = e.target.closest('button[data-act]');
                    if (b) resolve(b.dataset.act);
                });
                setKeys(e => { if (e.key === 'Escape') resolve('close'); });
            });
            if (choice === 'close') break;
            if (choice.startsWith('auto:')) {
                meta.autoLock = Number(choice.slice(5));
                autoMs = meta.autoLock * 60e3;
                const t = Number(testFlag('planpad.testAutoLockMs'));
                if (t > 0) autoMs = Math.min(autoMs, t);
                await kv.saveMeta(meta);
                continue;
            }
            if (choice === 'pk-del') {
                const ok = await confirmScreen('Passkeys entfernen?', 'PlanPad lässt sich danach nur noch mit PIN (oder Wiederherstellungsschlüssel) entsperren. Den Passkey selbst kannst du zusätzlich in den Einstellungen des Geräts unter „Passwörter“ löschen.', 'Entfernen');
                if (ok) {
                    for (const p of meta.passkeys) {
                        try { if (window.PublicKeyCredential && PublicKeyCredential.signalUnknownCredential) await PublicKeyCredential.signalUnknownCredential({ rpId: location.hostname, credentialId: b64u(p.id) }); } catch { /* egal */ }
                    }
                    meta.passkeys = [];
                    await kv.saveMeta(meta);
                }
                continue;
            }
            const dek = await reauth({ 'pk-add': 'Passkey hinzufügen', pin: 'PIN ändern', rec: 'Neuer Wiederherstellungsschlüssel' }[choice] || 'Bestätigen');
            if (!dek) continue;
            if (choice === 'pk-add') {
                const pk = await offerPasskey(dek, false);
                if (pk) { meta.passkeys.push(pk); await kv.saveMeta(meta); }
            }
            if (choice === 'pin') {
                const pin = await choosePin('Neue PIN', 'Die alte PIN gilt danach nicht mehr.');
                meta.pin = await pinSlot(dek, pin);
                await kv.saveMeta(meta);
            }
            if (choice === 'rec') {
                const rec = await recoverySlot(dek);
                await showRecovery(rec.code, false);
                meta.recovery = rec.slot;
                await kv.saveMeta(meta);
            }
        }
        closeOverlay();
    }
    function confirmScreen(title, text, okLabel) {
        return new Promise(resolve => {
            const card = screen(`${LOGO}<h1>${esc(title)}</h1><p class="pp-lock-text">${esc(text)}</p>
                <div class="pp-lock-actions"><button type="button" class="pp-btn" data-act="no">Abbrechen</button>
                <button type="button" class="pp-btn pp-btn-danger" data-act="yes">${esc(okLabel)}</button></div>`);
            card.addEventListener('click', e => {
                const b = e.target.closest('button[data-act]');
                if (b) resolve(b.dataset.act === 'yes');
            });
        });
    }

    /* ---------- Willkommen (allererster Start) ---------- */
    let demo = false;
    let fresh = false;          // Sperre wurde gerade zum ersten Mal eingerichtet
    function welcome() {
        return new Promise(resolve => {
            const card = screen(`${LOGO}<h1>Willkommen bei PlanPad!</h1>
                <p class="pp-lock-text pp-lock-center">Sitzpläne mischen, Notizen, Beobachtungen und Fehlzeiten – alles direkt auf diesem Gerät, ohne Cloud.</p>
                <div class="pp-welcome-choices">
                    <button type="button" class="pp-welcome-choice" data-act="demo">
                        <b>Demo ansehen</b><span>Mit einer Beispielklasse ausprobieren. Ohne PIN – es wird nichts gespeichert.</span></button>
                    <button type="button" class="pp-welcome-choice is-primary" data-act="start">
                        <b>Direkt loslegen</b><span>PlanPad mit PIN und Face ID schützen und eigene Klassen anlegen.</span></button>
                </div>`);
            card.addEventListener('click', e => {
                const b = e.target.closest('button[data-act]');
                if (b) resolve(b.dataset.act);
            });
        });
    }
    /** Demo: nichts auf dem Gerät speichern, keine Sperre (vorhandene Daten bleiben unangetastet) */
    function startDemo() {
        kv.useMemory();
        demo = true;
        closeOverlay();
    }
    /** Demo beenden: neu laden und direkt die Einrichtung zeigen */
    function leaveDemo() {
        try { sessionStorage.setItem('planpad.startSetup', '1'); } catch { /* egal */ }
        location.reload();
    }

    /* ---------- Exporte: verschlüsselt mit dem Datenschlüssel, öffnen mit dem Wiederherstellungsschlüssel ----------
       Die Datei enthält den Datenschlüssel nur in der Hülle des Wiederherstellungsschlüssels (wie auf dem Gerät).
       Auf diesem Gerät öffnet sie sich ohne Eingabe, anderswo nur mit dem Wiederherstellungsschlüssel. */
    const b64e = bytes => { let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
    const b64d = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
    async function sealExport(obj) {
        if (!meta || !vault.active()) throw new Error('nolock');
        const rec = await vault.seal(JSON.stringify(obj), 'export');
        const r = meta.recovery;
        return { alg: 'AES-GCM-256', kdf: 'planpad-recovery', slot: { salt: b64e(r.salt), iv: b64e(r.iv), w: b64e(r.w) }, iv: b64e(rec.iv), data: b64e(rec.ct) };
    }
    /** ohne code: Versuch mit dem Schlüssel dieses Geräts; wirft 'needkey', 'format' oder einen Fehler bei falschem Schlüssel */
    async function openExport(enc, code) {
        const rec = { v: 1, iv: b64d(enc.iv), ct: b64d(enc.data) };
        if (!code) {
            if (!vault.active()) throw new Error('needkey');
            try { return JSON.parse(await vault.open(rec, 'export')); } catch { throw new Error('needkey'); }
        }
        const secret = fromB32(code);
        if (!secret) throw new Error('format');
        const sl = { salt: b64d(enc.slot.salt), iv: b64d(enc.slot.iv), w: b64d(enc.slot.w) };
        const dek = await unwrap(sl, await kekFromSecret(secret, sl.salt, 'planpad-recovery'), 'recovery', false);
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv, additionalData: te.encode('planpad:export') }, dek, rec.ct);
        return JSON.parse(new TextDecoder().decode(pt));
    }
    /** zufälliges Passwort für Exporte (120 Bit, 6 Vierergruppen ohne verwechselbare Zeichen) */
    const newPassword = () => toB32(rnd(15));

    /* ---------- Start ---------- */
    async function gate() {
        const noLock = testFlag('planpad.noLock') === '1';     // vor kv.init lesen (räumt den localStorage auf)
        meta = await kv.readMeta();
        if (meta) {
            const dek = await unlockScreen();
            screen(`${LOGO}<h1>Wird geöffnet …</h1>`);
            vault.setKey(dek);
            await kv.init();
            closeOverlay();
            startAutoLock();
            return;
        }
        await kv.init();
        // nur ohne bestehende Sperre: automatische Tests dürfen die Einrichtung überspringen
        if (kv.mode() !== 'idb' || noLock) return;
        if (!window.crypto || !crypto.subtle) return;
        let skipWelcome = false;
        try { skipWelcome = sessionStorage.getItem('planpad.startSetup') === '1'; sessionStorage.removeItem('planpad.startSetup'); } catch { /* egal */ }
        if (!kv.hasData() && !skipWelcome) {
            if (await welcome() === 'demo') { startDemo(); return; }
        }
        if (!kv.hasData()) kv.set('planpad.demoDone', '1');     // eigener Start: keine Demoklasse automatisch laden
        if (await setup() === 'demo') { startDemo(); return; }
        startAutoLock();
    }

    return {
        gate,
        lockNow,
        settings,
        enabled: () => Boolean(meta),
        isDemo: () => demo,
        isFresh: () => fresh,
        sealExport,
        openExport,
        newPassword,
        leaveDemo,
        faceAad: key => 'face:' + JSON.stringify(key),
        beforeLock: null
    };
})();
