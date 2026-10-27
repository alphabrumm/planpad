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
- **Klassen-Auswahl**: Klassenname oben links antippen (▾) → scrollbare Liste aller Klassen, Tippen wechselt; dazu „Umbenennen“ und „Klasse anlegen“.
- **A-B-Schalter** „In Reihenfolge sortiert“: an = Layout „Reihen“ nach Nachnamen (bei CSV-Klassen,
  sonst Listen-Reihenfolge); aus = ursprüngliche Tischpositionen und Plätze exakt zurück.
  Solange der Schalter aktiv ist, zeigen die Tische zweizeilig Nachname (oben) und Vorname (unten).
- **Namensliste**: ein Kind pro Zeile als „Nachname, Vorname“ (Nachname freiwillig, auch nachträglich).
  Kärtchen und Tische zeigen weiter den Vornamen (bei Gleichheit mit Kürzel), das Kärtchen-Popup den vollen Namen.
  Ein CSV/Excel-Import erscheint ebenso kommagetrennt im Textfeld.

## Datenschutz

- Alles läuft lokal im Browser: kein Server, keine Cloud, keine automatische Gesichtserkennung.
- Klassen, Sitzpläne und Notizen liegen im `localStorage`, Gesichtsausschnitte (200 × 200 px) in der IndexedDB des Geräts.
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
  (0 bis Klassengröße, je Klasse gemerkt). „Statistik zurücksetzen“ (Text-Button) setzt die Zähler aller
  abgeschlossenen Beobachtungen auf 0; laufende Beobachtungen bleiben.
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
- Vorne im Raum: Tafel mit Ablage und Pult (SVG, ohne Text) statt der Box „Lehrkraft“.
- Menü → Darstellung: Farbkreise für das Akzent-Thema (Blau, Mint, Rosé, Lavendel, Apricot), hell und dunkel,
  gespeichert in `localStorage['planpad.accent']`.
