# PlanPad – Sitzpläne am iPad

Touchfreundlicher Sitzplan-Editor für den Unterricht. Gestaltung angelehnt an JPad und QPad.

## Aufbau

- **Klasse** (z. B. „9c Informatik“): Namen, Regeln (Trennen/Koppeln), Notizen und Fotos.
- **Sitzpläne** einer Klasse (z. B. „Normal“, „Gruppenarbeit“, „Prüfung“): je eigene Tische und Plätze.
  Als Reiter oben in der Kopfzeile (bündig mit dem Raum; am iPhone als Dropdown), daneben „+ Sitzplan ergänzen“.
  Aktiven Reiter antippen: umbenennen/löschen.
- **Schutz:** Werden Tische oder Sitzordnung eines Sitzplans verändert, zeigt sein Reiter ein offenes Schloss
  und wird gelb. Antippen: „Übernehmen“ (neuer Stand) oder „Verwerfen“ (zurück zum letzten Stand).
- Namen ändern (z. B. „Veronika“ → „Vroni“) ist eine Umbenennung: Notizen, Foto, Plätze und Regeln bleiben erhalten.
- **Mix** mischt die SuS an den Tischen (Teilgruppen möglich; sitzt noch niemand: ganze Klasse, mit Regeln), **Demix** stellt die Ordnung von vor dem Mischen wieder her.
- **Import:** „Klasse als Liste importieren“ liest Excel (.xlsx) und CSV direkt im Browser, z. B. die Klassenliste
  aus dem Infoportal. Spalten „Nachname“/„Vorname“ werden erkannt, sonst 1. Spalte Nachname, 2. Spalte Vorname.
- **Erster Schritt (iPad/iPhone, nur im Browser):** Hinweis „Zum Home-Bildschirm hinzufügen“ mit Bildschirmfoto,
  bis „Erledigt“ getippt wird. Hinweis: Die Home-Bildschirm-App hat ihren eigenen Speicher.
- **Neue Notizen:** Jede neue Notiz ist „neu“ (gelb), der Tisch bekommt einen gelben Punkt. Ohne Auswahl zeigt die
  Notizleiste alle neuen Notizen der Klasse („4 neue Notizen“), einzeln abhaken (✓) oder „Alle als gelesen markieren“.
- **Klassennotizen:** ganz oben in der Notizleiste (gestrichelter Kasten), „Anlegen“ – z. B. Stoff, Hausaufgabe, Termine.
- **Hilfe:** „So verwendest Du PlanPad“ unten in beiden Leisten-Modi; erscheint auch beim allerersten Öffnen.
- **Namen lernen** (unter „Klassenfoto“): Foto + 4 Namen. Rekord = meiste Gesichter ohne Fehler hintereinander (z. B. 19/27), steht auf dem Button.
  Nur für SuS mit zugeordnetem Foto, alles lokal.
- **„Plätze anlegen oder verteilen“** (unter dem Statusfeld, wenn nicht alle sitzen): Kinder ohne Platz an freie Tische;
  fehlen Tische, werden sie im gewählten Layout ergänzt. Neue Klassen öffnen in der Gruppenansicht.
- **Pinsel / Papierkorb:** mit angewähltem Tisch nur diesen (Kind lösen bzw. Tisch löschen), sonst Auswahl
  „Alle“ oder „Einzelne …“ (mehrere Tische antippen, bestätigen). Immer mit Rückfrage; danach Gruppenansicht.
- **Klassen-Auswahl**: Klassenname oben links antippen (▾) → scrollbare Liste aller Klassen, Tippen wechselt; dazu „Umbenennen“ und „Mit Probe verbinden“ (Klasse anlegen: Menü ☰).
- **A-B-Schalter** „In Reihenfolge sortiert“: an = Layout „Reihen“ nach Nachnamen (bei CSV-Klassen,
  sonst Listen-Reihenfolge); aus = ursprüngliche Tischpositionen und Plätze exakt zurück.
  Solange der Schalter aktiv ist, zeigen die Tische zweizeilig Nachname (oben) und Vorname (unten).
- **Namensliste**: ein Kind pro Zeile als „Nachname, Vorname“ (Nachname freiwillig, auch nachträglich).
  Kärtchen und Tische zeigen weiter den Vornamen (bei Gleichheit mit Kürzel), das Kärtchen-Popup den vollen Namen.
  Ein CSV/Excel-Import erscheint ebenso kommagetrennt im Textfeld.

## Neu in 1.45.0: Noten an Probe senden (1.45.1: „Klasse anlegen“ nur noch im Menü ☰)

- Klassenmenü (Klassenname oben links ▾) → **„Mit Probe verbinden“**: Verbindungscode aus Probe einfügen
  (Probe → Klasse → „⇄ PlanPad verbinden“). Danach gehen die **Noten** der Klasse an diese Probe-Klasse –
  je Note nur Datum, Note, Art und Unterrichtsnotiz mit Vor- und Nachname. Keine anderen Notizen, Fotos,
  Sitzpläne, Beobachtungen oder Lob/SOL.
- Verschlüsselt in PlanPad mit dem öffentlichen Schlüssel der Lehrkraft in Probe (ECDH P-256 + AES-GCM, wie in
  Probe); der Server von Probe sieht nur Zeitpunkt und Größe. Nur in eine Richtung, Probe schickt nichts zurück.
- Gesendet wird immer der ganze aktuelle Stand der Klasse (so kommen auch Änderungen und Löschungen an):
  automatisch ein paar Sekunden nach jeder Notiz-Änderung, beim Öffnen der Klasse, beim Zurückkehren in die App
  und wenn das Gerät wieder online ist – nur, wenn sich etwas geändert hat. „Probe-Verbindung“: Stand, „Jetzt
  senden“, „Trennen“.
- Gespeichert (verschlüsselt wie alles andere) unter `planpad.probe` = `{ Klassen-ID: { u, t, k, c, since, last, hash } }`;
  nicht in Sicherungsdateien. Ohne Verbindung baut PlanPad nie eine Netzverbindung auf (außer zum Laden der App).

## Neu in 1.46.0

- **Stammdaten aus der Klassenliste:** Neben Nachname/Vorname werden die Spalten „Klasse“, „Geschlecht“ (W/M),
  „Geburtsjahr“ und „Geburtsdatum“ (TT.MM.JJJJ, auch Excel-Datum) erkannt und je Kind gespeichert
  (`pupils` im Plan, verschlüsselt wie alles andere; wandert beim Umbenennen mit).
  Ohne Kopfzeile (1.46.4): 1. Spalte Nachname, 2. Spalte Vorname, die übrigen Spalten werden am Inhalt erkannt
  (Datum, vierstellige Jahreszahl, W/M, Klasse wie „8c“). Nach dem Einlesen meldet PlanPad, was erkannt wurde.
- **Torte:** Wer heute Geburtstag hat, bekommt oben mittig auf dem Tisch eine Torte; lag der Geburtstag seit dem
  letzten Schultag am Wochenende oder in den (bayerischen) Ferien, erscheint sie am ersten Schultag ausgegraut.
- **A–B-Ansicht:** Alter (unten links) und Klasse (unten rechts) auf jedem Tisch; rechts neben dem Pult
  „Name | Alter | Klasse“. Bei Alter (älteste zuerst) und Klasse beginnt jede Gruppe in einer neuen Reihe, mit Abstand.
  Die Wahl wird je Sitzplan gemerkt (`orderKey`). Nicht beim Präsentieren und nicht im Druck.
- **Notizen:** Klasse, Alter und Geburtsdatum unter dem Namen (wichtig bei gemischten Kursen).
- **Namen lernen:** Antwortvorschläge nur mit gleichem Geschlecht (bei zu wenigen mit anderen aufgefüllt).
- **Klassenliste einlesen** (bei „Namen bearbeiten“): gleicher Nach- und Vorname bzw. eindeutiger Vorname wird
  automatisch zugeordnet; der Rest im Dialog: zusammenführen (Notizen, Foto, Sterne, Fehlzeiten, Platz wandern mit),
  behalten oder entfernen; neue Kinder aus der Liste kommen ohne Platz dazu.
- **PIN:** normales Ziffernfeld 1–9, Löschen, 0, OK.
- **Demo (1.46.1):** Klasse 8c mit Geschlecht und Geburtstagen (Platzhalter `@bd:N:A`, `@bdw:A`, `@by:A:MM-TT` relativ zu heute):
  Emma hat immer heute Geburtstag, Leo am letzten Wochenende (ausgegraut an Montagen); Alter 13–15.

## Neu in 1.44.0

- **Anwesenheit:** Links neben dem Pult steht „7/21 anwesend“ (alle SuS der Klasse minus heute als fehlend
  eingetragene, noch nicht gekommene). Ist links zu wenig Platz, steht die Anzeige rechts vom Pult; beim Einpassen
  wird sie mit berücksichtigt. Nicht im Druck.
- **Exporte immer verschlüsselt:** Statt der Passwort-Abfrage wird mit dem Datenschlüssel verschlüsselt; die Datei
  enthält ihn nur in der Hülle des Wiederherstellungsschlüssels (`encrypted.kdf = 'planpad-recovery'`, Format 5).
  Auf demselben Gerät öffnet sie sich ohne Eingabe, sonst nur mit dem Wiederherstellungsschlüssel (der beim Export
  gültige). Rote Meldung im Dialog; fetter Text-Button „Falls Du Deinen Schlüssel nicht mehr kennst: mit neuem
  Passwort verschlüsseln“ würfelt ein Passwort (120 Bit, 6×4 Zeichen), das vor dem Export als notiert bestätigt
  werden muss (PBKDF2 wie bisher; beim Einlesen auch klein/ohne Bindestriche). Ohne Sperre (Demo, Test-Schalter)
  wird immer ein Passwort gewürfelt. Ältere Dateien (unverschlüsselt oder mit eigenem Passwort) lassen sich weiter öffnen.
- **Erinnerungen:** Stift-Symbol zum Bearbeiten (in der Liste und im Popup); Checkbox „Globale Erinnerung“:
  gespeichert unter `planpad.globalReminders`, in jeder Klasse in der Liste (Markierung „Global“), als Popup nur
  beim Öffnen von PlanPad (nicht beim Klassenwechsel). Export mit Notizen nimmt sie mit.

## Willkommen und Demo (ab 1.43.0)

- Allererster Start (keine Klassen/Notizen gespeichert, keine Sperre): Willkommen-Bildschirm mit
  „Demo ansehen“ oder „Direkt loslegen“.
- Demo: ohne PIN/Schlüssel/Passkey, Demoklasse wird geladen, `kv` läuft nur im Arbeitsspeicher (Modus `memory`),
  Fotos werden nicht in die IndexedDB geschrieben – nach dem Neuladen ist alles weg (wieder Willkommen).
  Hinweis unten rechts „Demo – nichts wird gespeichert“ mit „Jetzt loslegen“ → Rückfrage → Neuladen direkt in
  die Einrichtung (`sessionStorage['planpad.startSetup']`).
- Direkt loslegen: Einrichtung der Sperre, danach leere App (keine Demoklasse automatisch).
- Die Glühbirne (Hilfe) pulsiert in der Demo und direkt nach der allerersten Einrichtung, bis sie angetippt wird
  (`.pp-bulb.is-pulsing`, ab 1.43.1; bei „Bewegung reduzieren“ nur hervorgehoben).
- Wer schon Daten hat (Update von älteren Versionen), sieht keinen Willkommen-Bildschirm, sondern gleich die Einrichtung.

## Sperre und Verschlüsselung (ab 1.42.0)

- Beim Start ist PlanPad gesperrt. Beim ersten Start mit 1.42.0 führt eine Einrichtung durch: PIN festlegen,
  Wiederherstellungsschlüssel sichern (Pflicht: Kontrolle der letzten 4 Zeichen + Bestätigung), optional Passkey.
- Alle Daten (Datenbank `planpad`, Store `kv`) und alle Gesichtsausschnitte (`sitzplan-fotos`) werden mit einem
  zufälligen AES-GCM-256-Datenschlüssel verschlüsselt (Web Crypto API, je Eintrag neuer IV, Eintragsname als
  Zusatzdaten). Der Datenschlüssel liegt nur „eingepackt“ vor:
  - PIN (6–12 Ziffern, triviale PINs werden abgelehnt): PBKDF2-SHA-256, 600 000 Iterationen, 128-Bit-Salt.
  - Passkey (Face ID/Touch ID): WebAuthn mit PRF-Erweiterung (iPadOS/iOS 18+), daraus HKDF-SHA-256.
    Kein Server: der Passkey dient nur als Schlüsselquelle. Ohne PRF-Unterstützung wird nur die PIN genutzt.
  - Wiederherstellungsschlüssel: 160 Bit Zufall (Crockford-Base32, 8×4 Zeichen), daraus HKDF-SHA-256.
    Nach Nutzung muss eine neue PIN festgelegt werden.
- Sperrbildschirm: Ziffern in gewohnter Anordnung (seit 1.46.0; vorher zufällig), keine Tasten-Hervorhebung,
  die Anzeige verrät die PIN-Länge nicht. Nach 5 Fehlversuchen wachsende Wartezeit (30 s … 15 min).
- Automatisch sperren nach 2/5/10/30 Minuten ohne Bedienung bzw. im Hintergrund (Standard 5). Menü →
  „Sicherheit“: „Jetzt sperren“ und „PIN, Face ID und Schlüssel …“ (Änderungen nur nach Bestätigung mit PIN/Passkey).
  Sperren = ausstehende Änderungen schreiben und neu laden, der Schlüssel verlässt damit den Arbeitsspeicher.
- „Alles vergessen?“ auf dem Sperrbildschirm löscht nach Eingabe von LÖSCHEN alle Daten (Neubeginn).
- Ohne PIN, Passkey und Wiederherstellungsschlüssel sind die Daten verloren – darauf weist PlanPad deutlich hin.
- Code: `planpad-lock.js` (`vault`, `lock`); `kv` ver-/entschlüsselt beim Laden und Schreiben.
- Test-Schalter: `localStorage['planpad.noLock'] = '1'` überspringt nur die *Einrichtung* (wirkt nicht, wenn
  bereits eine Sperre besteht); `planpad.testAutoLockMs` kann die Auto-Sperre nur verkürzen.

## Datenschutz

- Alles läuft lokal im Browser: kein Server, keine Cloud, keine automatische Gesichtserkennung. Einzige Ausnahme: Noten einer mit Probe verbundenen Klasse (verschlüsselt, siehe 1.45.0).
- Klassen, Sitzpläne, Notizen und Einstellungen liegen seit 1.41.0 in der IndexedDB des Geräts (Datenbank `planpad`,
  Store `kv`), Gesichtsausschnitte (200 × 200 px) in der IndexedDB `sitzplan-fotos` – seit 1.42.0 verschlüsselt.
- Übernahme aus älteren Versionen: Beim ersten Start werden alle `planpad.*`-Einträge aus dem `localStorage` in die
  IndexedDB kopiert und nachgelesen (bei Abweichung wird abgebrochen, nichts gelöscht). Die alten Kopien bleiben
  mindestens einen Tag als Sicherheitsnetz liegen und werden danach entfernt – außer `planpad.theme` und
  `planpad.accent`, die für das sofortige Einfärben beim Laden gespiegelt bleiben.
- Ist IndexedDB nicht nutzbar (z. B. gesperrt), arbeitet PlanPad wie bisher mit dem `localStorage`. PlanPad bittet den
  Browser um dauerhaften Speicher (`navigator.storage.persist()`).
- Die unten genannten Test-Schalter (`planpad.noDemo` usw.) werden weiterhin im `localStorage` gesetzt; sie werden beim
  Start übernommen. `localStorage['planpad.testMirror'] = '1'` hält den `localStorage` maßgeblich (nur für Tests).
- Das Klassenfoto selbst wird nie gespeichert.
- Dateien aus „Als Datei sichern“ enthalten Fotos und Notizen nur auf ausdrücklichen Wunsch (dann mit Passwort empfohlen).
- Die Schrift (Atkinson Hyperlegible, SIL OFL) liegt im Ordner `fonts/`. Es werden keine externen Dienste geladen.

## Dateien

| Datei | Aufgabe |
|---|---|
| `index.html` | Oberfläche |
| `planpad.css` | Gestaltung, Hell/Dunkel |
| `planpad.js` | Logik: Klassen, Sitzpläne, Namen, Tische, Layouts, Regeln, Notizen, Klassenfoto, Drucken |
| `planpad-sw.js` | Offline-Nutzung (speichert nur App-Dateien zwischen) |
| `planpad.webmanifest`, `planpad-icon*` | App-Icon für den Home-Bildschirm |
| `help/` | Bildschirmfotos für „So verwendest Du PlanPad“ (Demo-Klasse mit erfundenen Namen) |
| `fonts/` | Schrift inkl. Lizenz |

## Veröffentlichen

Alle Dateien auf einen Webspace mit HTTPS hochladen (z. B. plan.pandapy.de).
Die alten Dateien `script.js` und `styles-*.css` werden nicht mehr gebraucht.
Gespeicherte Daten älterer Versionen werden beim ersten Start automatisch übernommen
(ein bisheriger Plan wird zu einer Klasse mit dem Sitzplan „Sitzplan 1“).

Tipp fürs iPad: Teilen → „Zum Home-Bildschirm“. Dann läuft PlanPad offline, und Safari
löscht die lokal gespeicherten Pläne nicht nach längerer Nichtnutzung.

## Unterrichtsbeobachtung, Lob/Tadel, SOL, Statistik (ab 1.31.0)
- Beim Öffnen einer Klasse ohne laufende Beobachtung: Vorschlag von 4 Kindern (zuerst nie beobachtete,
  dann Runde für Runde die mit 1, 2 … Beobachtungen). Pro Kind „Neu würfeln“ (Würfel) oder „Auswählen“ (Liste).
  Zeitraum standardmäßig 10 Schultage, Beginn/Ende per Kalender änderbar. Bayerische Ferien (fest hinterlegt
  bis Sommer 2029, `FERIEN_BY` in planpad.js) zählen nicht; einzelne Feiertage werden nicht abgezogen.
  „Nicht jetzt“ (heute nicht mehr fragen) und „Für diese Klasse aus“.
- Auge oben links auf dem Tisch = wird beobachtet (nicht beim Präsentieren, nicht im Druck).
- Ende (nur Datum zählt): Dialog beim nächsten Öffnen – je Kind abschließen & neu würfeln, abschließen
  oder um 1/2 Wochen verlängern.
- Notizen-Leiste ohne Auswahl: „Beobachtungen“ (Übersicht, Restschultage, beenden, würfeln) und „Statistik“
  (Tabelle je Kind; Zeile antippen: Noten mit Datum + Unterrichtsnotiz, Zeiträume, Verlauf Lob/SOL).
- Lob/Tadel und SOL: Daumen hoch/runter = ±½ Stern (0–5, Start 3), jede Stimme mit Datum gespeichert.
- Gespeichert in der Klasse (`observ`, `votes`); in Sicherungsdateien nur, wenn „Notizen, Lob/SOL und
  Beobachtungen einschließen“ = Ja.
- Test-Schalter: `localStorage['planpad.noObsPrompt']` unterdrückt die automatischen Dialoge.

## Beobachtungen planen, Demoklasse (ab 1.32.0 / 1.33.0)
- „Du beobachtest gerade …“ → „Beobachtungen planen“: Anzahl der Vorschläge mit „Weniger/Mehr anzeigen“
  (0 bis Klassengröße, je Klasse gemerkt). „Durchlauf neu beginnen“ (Text-Button, ab 1.41.1) beginnt eine
  neue Durchlaufserie: abgeschlossene Beobachtungen werden mit `reset: true` markiert und zählen nicht mehr für die
  Vorschläge; in der Statistik (Phasen, beobachtete Tage) bleiben sie erhalten, ebenso Notizen und laufende Beobachtungen.
- Demoklasse `demo/demo.json` (Format einer Sicherungsdatei, Daten relativ zum Öffnungstag): wird beim
  allerersten Start geladen und jederzeit über Menü ☰ → „Demoklasse laden“. 15 Pixel-Gesichter
  (`demo/klassenfoto.png` = Klassenfoto zum Ausprobieren von „Gesichter zuordnen“), 3 Sitzpläne, Regeln,
  Notizen mit Noten, Klassennotizen, Beobachtungsrunden, Lob/SOL-Verlauf (bis 4 Monate, nie vor Schuljahresbeginn).
- Test-Schalter: `localStorage['planpad.noDemo']`.

## Sterne-Kategorien und Notiz-Art (ab 1.35.0)
- Sterne unter der Notiz: „Verhalten“ (vorher Lob/Tadel), „SOL“, „Sozial“. Stift neben dem Namen = umbenennen
  (eigene Kategorien auch entfernen). „weitere hinzufügen“: Name, Anzahl Sterne (3–10), Startwert; „Nur diese
  Klasse“ (in der Klasse gespeichert) oder „Für alle Klassen“ (`localStorage['planpad.ratingCats']`, auch in
  Sicherungsdateien). Statistik zeigt alle Kategorien als Spalten und Verläufe.
- Neue Notiz: Unterrichtsnotiz 2 Zeilen, „Bemerkung“ entfällt (alte Bemerkungen bleiben sichtbar). Neben der
  schmalen „Note“ das Dropdown „Art“: Beitrag (Standard), Beobachtung, Präsentation, „+ Art ergänzen …“ (eigene
  Arten gelten sofort für alle Klassen, `localStorage['planpad.noteKinds']`).

## Hilfe (ab 1.36.0)
- Gelbe Glühbirne oben (links neben Rückgängig): Hinweis „Finger länger als 1 Sekunde auf einen Button legen“
  und „Handbuch öffnen“. Die großen Handbuch-Buttons in der Seitenleiste entfallen.
- Langes Drücken (≥ 1 s) auf Buttons und Auswahlmenüs zeigt eine Erklärung (Texte in `TIPS`, sonst title/aria-label);
  der Button wird dabei nicht ausgelöst. Schließen mit ×.

## Kategorien je Klasse, Tafel, Farbthemen (ab 1.37.0)
- Jede Klasse hat ihre eigenen Sterne-Kategorien (0–10). Neue Klassen: „Verhalten“ und „Selbstorganisation“
  (Vorlage `localStorage['planpad.catTemplate']`). Stift: umbenennen (nur diese Klasse) oder entfernen – mit
  Warnung, die Stimmen dieser Kategorie in der Klasse werden gelöscht. „Für alle Klassen“ ergänzt in allen
  Klassen (wo Platz ist) und in der Vorlage.
- Vorne im Raum: Lehrerpult von oben mit Buch, iPad und Stift (SVG, Grautöne, ohne Text) statt der Box „Lehrkraft“.
- Menü → Darstellung: Farbkreise für das Akzent-Thema (Blau, Mint, Rosé, Lavendel, Apricot), hell und dunkel,
  gespeichert in `localStorage['planpad.accent']`.

## Fehlzeiten (ab 1.39.0)
- Raumleiste rechts neben dem Papierkorb: „rotes Kreuz“ (wer fehlt heute? – Tische antippen, Speichern;
  erneut öffnen = vorausgewählt, abwählen korrigiert) und „grüne Tür“ (gerade gekommen: Verspätung = Zeit seit „fehlt“,
  auf 5 Min. aufgerundet; ohne vorheriges „fehlt“ nur „zu spät“).
- Tische: fehlend grau mit Kreuz, verspätet mit Uhr (nur am selben Tag; nicht beim Präsentieren/Drucken).
- Anzeigen: Notizen-Leiste ohne Auswahl „Fehlzeiten“ mit Tagesblättern ‹ ›; Schüleransicht mit Zusammenfassung und
  löschbaren Einträgen; Statistik-Spalten „Gefehlt“ und „Zu spät“ plus Liste im Detail.
- Gespeichert in der Klasse (`absences`); in Sicherungsdateien nur mit „Notizen, Sterne, Beobachtungen und Fehlzeiten“ = Ja.

## Erinnerungen (ab 1.40.0)
- Glocke in der Raumleiste (links neben dem Sortier-Button, Trennstrich): Liste der Erinnerungen dieser Klasse
  (Text + Fälligkeit, „Erledigt“, erledigte aufklappbar und löschbar) und neue Erinnerung: „Beim nächsten Öffnen“
  oder „Ab Datum“. Zahl an der Glocke = offene Erinnerungen (gelb = fällig).
- Fällige Erinnerungen erscheinen bei jedem Öffnen der Klasse (Start, Wechsel), bis sie mit „Erledigt“ quittiert sind.
- Gespeichert in der Klasse (`reminders`); in Sicherungsdateien nur mit dem Notizen-Schalter = Ja.
