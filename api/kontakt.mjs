/**
 * Tübel GmbH — Anfrageformular
 *
 * Vercel-Funktion unter /api/kontakt. Nimmt die Daten aus kontakt.html
 * (und dem Kurzformular der Startseite) entgegen, prüft sie und verschickt
 * sie über Resend als E-Mail. Übernommen aus dem THATSITE!-Projekt.
 *
 * Läuft ausschließlich auf dem Server. Der API-Schlüssel wird nur hier
 * gelesen und nie in eine Antwort oder Fehlermeldung geschrieben.
 *
 * ---------------------------------------------------------------------
 * Nötige Umgebungsvariablen (Vercel → Project Settings →
 * Environment Variables, für Production UND Preview):
 *
 *   RESEND_API_KEY   Schlüssel aus dem Resend-Dashboard (beginnt mit re_)
 *   MAIL_TO          Empfänger, z. B. kontakt@bedachung-holzbau.de
 *   MAIL_FROM        Absender auf der bei Resend verifizierten Domain,
 *                    z. B. formular@bedachung-holzbau.de
 * ---------------------------------------------------------------------
 */

import { createHash, randomBytes } from 'node:crypto';

const umgebung = (name) => process.env[name];

const RESEND_ENDPUNKT = 'https://api.resend.com/emails';
const ZEITLIMIT_MS = 10000;
const KONTAKT_NOTFALL = 'Bitte rufen Sie uns direkt an: 03594 702207, '
                      + 'oder schreiben Sie an kontakt@bedachung-holzbau.de.';

/* Missbrauchsbremse: höchstens fünf versendete Anfragen je Absender und
 * Stunde. Zähler nur im Arbeitsspeicher, IP gesalzen gehasht, nie gespeichert. */
const FENSTER_MS     = 60 * 60 * 1000;
const MAX_JE_FENSTER = 5;
const MAX_EINTRAEGE  = 5000;

const salz    = randomBytes(16);
const zaehler = new Map();

const sauber   = (wert) => String(wert ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 300);
const istEmail = (wert) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(wert);
const istTelefon = (wert) => (wert.match(/\d/g) || []).length >= 6;

function kennung(req) {
  const weitergeleitet = String(req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const ip = weitergeleitet || req.headers.get('x-real-ip') || 'unbekannt';
  return createHash('sha256').update(salz).update(String(ip)).digest('hex').slice(0, 32);
}

function aufraeumen(jetzt) {
  for (const [schluessel, zeiten] of zaehler) {
    const frisch = zeiten.filter((t) => jetzt - t < FENSTER_MS);
    if (frisch.length) zaehler.set(schluessel, frisch);
    else zaehler.delete(schluessel);
  }
}

function grenzeErreicht(schluessel, jetzt) {
  aufraeumen(jetzt);
  return (zaehler.get(schluessel) || []).length >= MAX_JE_FENSTER;
}

function vermerken(schluessel, jetzt) {
  if (zaehler.size >= MAX_EINTRAEGE && !zaehler.has(schluessel)) return;
  zaehler.set(schluessel, [...(zaehler.get(schluessel) || []), jetzt]);
}

/** Antwort je nachdem, ob per fetch (JSON) oder als klassisches Formular gesendet wurde. */
function antwort(willJson, { status, ok, fehler, ziel, kopf }) {
  if (willJson) {
    return new Response(JSON.stringify(ok ? { ok: true } : { ok: false, fehler }), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...(kopf || {}) },
    });
  }
  return new Response(null, { status: 303, headers: { Location: ziel, ...(kopf || {}) } });
}

const zurueck = (fehler) => '/kontakt.html?fehler=' + encodeURIComponent(fehler.join(' ')) + '#anfrage';

const erfolg = (willJson) => antwort(willJson, { status: 200, ok: true, ziel: '/danke.html' });

const technischerFehler = (willJson) => {
  const m = ['Die Nachricht konnte technisch nicht versendet werden. ' + KONTAKT_NOTFALL];
  return antwort(willJson, { status: 500, ok: false, fehler: m, ziel: zurueck(m) });
};

const zuVieleAnfragen = (willJson) => {
  const m = ['Es sind bereits mehrere Anfragen von hier eingegangen. ' + KONTAKT_NOTFALL];
  return antwort(willJson, { status: 429, ok: false, fehler: m, ziel: zurueck(m),
                             kopf: { 'Retry-After': String(Math.ceil(FENSTER_MS / 1000)) } });
};

async function formularLesen(req) {
  const typ = req.headers.get('content-type') || '';
  try {
    if (typ.includes('application/json')) {
      const json = await req.json();
      const anliegen = Array.isArray(json.anliegen) ? json.anliegen : [json.anliegen].filter(Boolean);
      return { ...json, anliegen };
    }
    const params = new URLSearchParams(await req.text());
    return { ...Object.fromEntries(params), anliegen: params.getAll('anliegen') };
  } catch {
    return { anliegen: [] };
  }
}

export async function POST(req) {
  const willJson = (req.headers.get('accept') || '').includes('application/json');
  const body = await formularLesen(req);

  const daten = {
    name:      sauber(body.name),
    email:     sauber(body.email),
    telefon:   sauber(body.telefon),
    ort:       sauber(body.ort),
    alter:     sauber(body.alter).slice(0, 20),
    anliegen:  body.anliegen.map(sauber).filter(Boolean).slice(0, 12),
    rueckruf:  Boolean(body.rueckruf),
    nachricht: String(body.nachricht ?? '').trim(),
    datenschutz: Boolean(body.datenschutz),
  };

  // Spamfalle 1: unsichtbares Feld
  if (sauber(body.website) !== '') return erfolg(willJson);

  // Spamfalle 2: in unter drei Sekunden abgeschickt
  const ts = Number(body.ts);
  if (Number.isFinite(ts) && ts > 0 && Date.now() - ts < 3000) return erfolg(willJson);

  // Pflichtangaben: Name, ein Rückweg (Telefon oder E-Mail), Nachricht, Datenschutz
  const fehler = [];
  if (!daten.name) fehler.push('Bitte geben Sie Ihren Namen an.');
  if (!istEmail(daten.email) && !istTelefon(daten.telefon)) {
    fehler.push('Bitte geben Sie eine Telefonnummer oder eine gültige E-Mail-Adresse an.');
  }
  if (daten.email && !istEmail(daten.email)) fehler.push('Die E-Mail-Adresse scheint nicht zu stimmen.');
  if (daten.nachricht.length < 10)   fehler.push('Bitte beschreiben Sie Ihr Anliegen in ein paar Worten.');
  if (daten.nachricht.length > 5000) fehler.push('Die Nachricht ist zu lang (maximal 5000 Zeichen).');
  if (!daten.datenschutz)            fehler.push('Bitte bestätigen Sie die Datenschutzhinweise.');

  if (fehler.length) {
    return antwort(willJson, { status: 400, ok: false, fehler, ziel: zurueck(fehler) });
  }

  const RESEND_API_KEY = umgebung('RESEND_API_KEY');
  const MAIL_TO        = umgebung('MAIL_TO');
  const MAIL_FROM      = umgebung('MAIL_FROM');
  if (!RESEND_API_KEY || !MAIL_TO || !MAIL_FROM) {
    const fehlend = [!RESEND_API_KEY && 'RESEND_API_KEY', !MAIL_TO && 'MAIL_TO',
                     !MAIL_FROM && 'MAIL_FROM'].filter(Boolean).join(', ');
    console.error('Formular nicht eingerichtet — Umgebungsvariablen fehlen:', fehlend);
    return technischerFehler(willJson);
  }

  const jetzt = Date.now();
  const absender = kennung(req);
  if (grenzeErreicht(absender, jetzt)) {
    console.warn('Kontingent ausgeschöpft für einen Absender.');
    return zuVieleAnfragen(willJson);
  }

  const bewerbung = daten.anliegen.some((a) => /Ausbildung|Praktikum|Bewerbung/i.test(a));
  const text = [
    bewerbung ? 'Neue Bewerbung über die Website' : 'Neue Anfrage über die Website',
    '='.repeat(46), '',
    `Name:            ${daten.name}`,
    `Telefon:         ${daten.telefon || '—'}`,
    `E-Mail:          ${daten.email || '—'}`,
    ...(daten.alter ? [`Alter:           ${daten.alter}`] : []),
    `Ort:             ${daten.ort || '—'}`,
    `Anliegen:        ${daten.anliegen.join(', ') || '—'}`,
    `Rückruf:         ${daten.rueckruf ? 'ja, bitte zurückrufen' : 'nein'}`,
    '', 'Nachricht:', '-'.repeat(46),
    daten.nachricht, '',
    '='.repeat(46),
    `Gesendet: ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} Uhr`,
  ].join('\n');

  // Anzeigename entschärfen, damit die Adresse dahinter nicht zu ersetzen ist.
  const anzeigename = daten.name.replace(/["<>]/g, '');

  const abbruch = new AbortController();
  const wecker = setTimeout(() => abbruch.abort(), ZEITLIMIT_MS);

  try {
    const res = await fetch(RESEND_ENDPUNKT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `"Website Tübel" <${MAIL_FROM}>`,
        to: [MAIL_TO],
        ...(istEmail(daten.email) ? { reply_to: `"${anzeigename}" <${daten.email}>` } : {}),
        subject: `${bewerbung ? 'Bewerbung' : 'Anfrage'} über die Website — ${daten.name}${daten.rueckruf ? ' (Rückruf)' : ''}`,
        text,
      }),
      signal: abbruch.signal,
    });

    if (!res.ok) {
      const meldung = (await res.text().catch(() => '')).slice(0, 500);
      console.error('Resend hat abgelehnt:', res.status, meldung);
      return technischerFehler(willJson);
    }
  } catch (err) {
    const grund = err?.name === 'AbortError'
      ? `Zeitlimit von ${ZEITLIMIT_MS} ms überschritten`
      : err?.message;
    console.error('Versand fehlgeschlagen:', grund);
    return technischerFehler(willJson);
  } finally {
    clearTimeout(wecker);
  }

  vermerken(absender, jetzt);
  return erfolg(willJson);
}
