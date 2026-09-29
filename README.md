# Tübel GmbH — Website-Relaunch

Neuer Webauftritt für die Tübel GmbH, Dachdeckerei und Zimmerei in Rammenau
(bisher: bedachung-holzbau.de).

Aufbau wie bei THATSITE!: reines HTML, CSS und JavaScript, kein Build-Schritt,
Kontaktformular als Serverless-Funktion auf Vercel.

## Eckdaten

- Tübel GmbH, Dachdecker- und Zimmermeister Markus Tübel
- Niederdorfstraße 60, 01877 Rammenau
- Tel. 03594 / 702207 · kontakt@bedachung-holzbau.de
- Amtsgericht Dresden, HRB 32965

## Leistungen

Dacharbeiten, Zimmererarbeiten, Dachklempnerarbeiten, Blitzschutz,
Fassadenverkleidung, Gerüstbau, Dämmung, Schornsteinbau, Kranarbeiten.

## Entwurf (Stand: erster Wurf, noch ohne Texte)

Texte sind als graue Platzhalterbalken angelegt; Navigation, Leistungsnamen
und Kontaktdaten stehen schon drin.

```
index.html        Startseite (Entwurf)
css/style.css     Gesamtes Design, Farben als Variablen oben
css/fonts.css     Archivo, selbst gehostet (variable Schrift)
js/dach.js        Hero-Animation: Dach setzt sich aus Biberschwanzziegeln zusammen
js/main.js        Mobiles Menü, Einblenden beim Scrollen
bilder/           Zuschnitte aus dem Foto des Firmensitzes
fonts/            Schriftdateien (woff2)
```

**Hero-Animation.** Canvas-Zeichnung statt Videodatei: gestochen scharf auf
jedem Bildschirm, wenige KB, Farben und Zeitplan `T` sowie `TEMPO` in
`js/dach.js` einstellbar. Ablauf wie auf der Baustelle: Haus → Gerüst mit
Banner → Dachstuhl (Fußpfette, Sparren, Grat, First) →
Unterspannbahn, Konterlatten, Dachlatten → Biberschwanz Reihe für Reihe →
Grat- und Firstziegel → Rinne, Fallrohr, Verwahrung, Schneefang → Gerüst
abbauen → Lichtkante (ca. 25 s, ruhiges Tempo, läuft einmal). Doppelklick auf den Hero spielt sie erneut ab. Bei
„Bewegung reduzieren" im Betriebssystem steht sofort das fertige Dach da.

**Offen:** Originallogo als Vektordatei (das Logo ist nachgebaut),
hochauflösende Fotos für Referenzen, echte Texte, Impressum und Datenschutz.

## Anfrageformular

`kontakt.html` und das Kurzformular der Startseite schicken an `/api/kontakt`
(`api/kontakt.mjs`, Vercel-Funktion, Versand über Resend). Ohne JavaScript
leitet die Funktion auf `danke.html` bzw. mit `?fehler=…` zurück, mit
JavaScript bleibt man auf der Seite. Pflicht: Name, Telefon **oder** E-Mail,
Nachricht, Datenschutz-Häkchen. Spamschutz über unsichtbares Feld und
Mindestzeit, höchstens fünf Anfragen je Absender und Stunde.

Damit etwas ankommt, bei Vercel (Production und Preview) setzen:

- `RESEND_API_KEY` — Schlüssel aus dem Resend-Dashboard
- `MAIL_TO` — z. B. `kontakt@bedachung-holzbau.de`
- `MAIL_FROM` — Absender auf der bei Resend verifizierten Domain,
  z. B. `formular@bedachung-holzbau.de` (Domain dafür per DNS bei Resend verifizieren)
