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
abbauen → Lichtkante (ca. 29 s, ruhiges Tempo, läuft einmal). Ein Mitarbeiter
in Tübel-Kleidung begleitet jeden Schritt, ein Schrägaufzug bringt die Ziegel,
am Gerüst hängt das Firmenbanner mit Telefonnummer. Doppelklick auf den Hero spielt sie erneut ab. Bei
„Bewegung reduzieren" im Betriebssystem steht sofort das fertige Dach da.

**Logo:** aus dem Original (Jubiläumsgrafik) als Vektor nachgezeichnet: rotes Dach
mit Schornstein, TübeL mit weißer Kontur, ohne den gelben Hausumriss. Schriftfarbe
über `--logo-schrift` (in der Fußzeile hell). Liegt als Symbol `#logo`
in jeder Seite, als Datei `bilder/logo.svg` und als Pfade in `js/dach.js`.

**Offen:**
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

## VELUX Dachfenster-Konfigurator

Banner auf der Startseite, Hinweis bei „Dachdeckung“ und eigene Seite
`velux-konfigurator.html`. Der Konfigurator wird erst nach Klick geladen
(Zwei-Klick-Lösung, keine Datenübertragung an VELUX vorher).

**Einrichten:** In `velux-konfigurator.html` die VELUX-Partner-ID der Tübel GmbH in
`data-velux-id=""` eintragen (steht im iFrame der bisherigen Website bzw. im VELUX
Partnerportal). Dann wird eingebunden:
`https://dachfensterkonfigurator.velux.de/konfigurator?embed=true&id=<ID>` –
Anfragen gehen so direkt an Tübel. Ohne ID öffnet der Knopf den allgemeinen
VELUX-Konfigurator in einem neuen Fenster.

Für die Datenschutzerklärung: Abschnitt zur Einbindung des VELUX-Konfigurators
(VELUX Deutschland GmbH) ergänzen.
