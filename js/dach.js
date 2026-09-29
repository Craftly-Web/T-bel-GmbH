/*
 * Hero-Animation: Ein Dach entsteht – wie auf der Baustelle.
 * Ablauf: Haus → Gerüst → Dachstuhl (Fußpfette, Sparren, Grat, First, Richtbaum)
 *         → Unterspannbahn, Konterlatten, Dachlatten → Biberschwanz Reihe für Reihe
 *         → Grat- und Firstziegel → Klempner (Rinne, Fallrohr, Verwahrung, Schneefang)
 *         → Gerüst abbauen → Lichtkante.
 * Gezeichnet auf <canvas> in einem festen Koordinatensystem (1000 × 640,
 * sichtbar ab y = 80),
 * das an .hero__buehne ausgerichtet wird. Bei „Bewegung reduzieren“ steht
 * sofort das fertige Dach da.
 */
(function () {
  "use strict";

  var hero = document.querySelector(".hero");
  var leinwand = hero && hero.querySelector(".hero__leinwand");
  var buehne = hero && hero.querySelector(".hero__buehne");
  if (!leinwand || !buehne || !leinwand.getContext) return;
  var ctx = leinwand.getContext("2d");

  var ruhig = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Geometrie (Weltkoordinaten) ---------- */

  var W = 1000;
  var OBEN = 80;             // leerer Himmel oberhalb der Zeichnung wird abgeschnitten
  var BODEN = 612;
  var TRAUFE = 390;          // Unterkante der Dachfläche
  var FIRST = 150;           // Firsthöhe
  var TRAUFE_L = 132, TRAUFE_R = 868;
  var FIRST_L = 330, FIRST_R = 670;
  var WAND_L = 188, WAND_R = 812;

  var ZIEGEL_B = 30;         // Breite Biberschwanz
  var ZIEGEL_H = 42;         // Gesamtlänge
  var REIHE = 14;            // sichtbare Reihenhöhe (Doppeldeckung)
  var UEBERSTAND = 6;        // Ziegel hängen etwas über die Traufe

  function randLinks(y) { return TRAUFE_L + (TRAUFE + UEBERSTAND - y) * (FIRST_L - TRAUFE_L) / (TRAUFE + UEBERSTAND - FIRST); }
  function randRechts(y) { return TRAUFE_R - (TRAUFE + UEBERSTAND - y) * (TRAUFE_R - FIRST_R) / (TRAUFE + UEBERSTAND - FIRST); }

  function dachPfad(c) {
    c.beginPath();
    c.moveTo(TRAUFE_L, TRAUFE + UEBERSTAND);
    c.lineTo(TRAUFE_R, TRAUFE + UEBERSTAND);
    c.lineTo(FIRST_R, FIRST);
    c.lineTo(FIRST_L, FIRST);
    c.closePath();
  }

  /* ---------- Zufall mit festem Startwert: jedes Mal dasselbe Dach ---------- */

  var saat = 20140109;
  function zufall() {
    saat |= 0; saat = (saat + 0x6d2b79f5) | 0;
    var t = Math.imul(saat ^ (saat >>> 15), 1 | saat);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /* ---------- Zeitplan ---------- */

  var TEMPO = 1.15;          // > 1 spielt schneller ab
  var T = {
    haus: [0, 0.8],
    schornstein: [0.4, 0.8],
    geruest: 0.8,            // Ständer, danach Riegel, Beläge, Diagonalen, Netz, Banner
    pfette: [2.9, 0.5],
    sparren: 3.1, sparrenDauer: 0.5, sparrenAbstand: 0.07,
    gratbalken: [4.4, 0.7],
    richtbaum: [4.9, 0.5, 6.1, 0.5],
    bahn: 5.3, bahnDauer: 0.55, bahnAbstand: 0.22,
    konter: [6.4, 0.5],
    latten: 6.8, lattenDauer: 0.4, lattenAbstand: 0.04,
    ziegel: 7.5, reihenAbstand: 0.16, spaltenAbstand: 0.012, ziegelDauer: 0.5,
    grat: 10.5, gratAbstand: 0.05, kappeDauer: 0.35,
    first: 11.0, firstAbstand: 0.045,
    rinne: [11.4, 0.6], fallrohr: [11.8, 0.5], verwahrung: [11.6, 0.4], schneefang: [11.9, 0.5],
    abbau: 12.6,
    licht: [14.1, 1.4]
  };

  /* ---------- Bauteile vorberechnen ---------- */

  var sparren = [];
  (function () {
    var i = 0;
    for (var x = TRAUFE_L + 26; x < TRAUFE_R - 20; x += 44) {
      var oben = FIRST;
      if (x < FIRST_L) oben = TRAUFE + UEBERSTAND - (x - TRAUFE_L) * (TRAUFE + UEBERSTAND - FIRST) / (FIRST_L - TRAUFE_L);
      else if (x > FIRST_R) oben = TRAUFE + UEBERSTAND - (TRAUFE_R - x) * (TRAUFE + UEBERSTAND - FIRST) / (TRAUFE_R - FIRST_R);
      sparren.push({ x: x, oben: oben, start: T.sparren + i * T.sparrenAbstand });
      i++;
    }
  })();

  var reihen = [];
  var ziegel = [];
  (function () {
    for (var r = 0; ; r++) {
      var unten = TRAUFE + UEBERSTAND - r * REIHE;
      if (unten - REIHE < FIRST - 2) break;
      var l = randLinks(unten), rr = randRechts(unten);
      reihen.push({ y: unten - REIHE + 3, l: randLinks(unten - REIHE + 3), r: randRechts(unten - REIHE + 3), start: T.latten + r * T.lattenAbstand });
      var versatz = (r % 2) * ZIEGEL_B / 2;
      var spalte = 0;
      for (var x = TRAUFE_L - ZIEGEL_B + versatz; x < TRAUFE_R; x += ZIEGEL_B) {
        if (x + ZIEGEL_B < l || x > rr) continue;
        ziegel.push({
          x: x,
          y: unten - ZIEGEL_H,
          reihe: r,
          sorte: zufall() < 0.12 ? 8 + Math.floor(zufall() * 2) : Math.floor(zufall() * 8),
          dreh: (zufall() - 0.5) * 0.5,
          start: T.ziegel + r * T.reihenAbstand + spalte * T.spaltenAbstand + zufall() * 0.04
        });
        spalte++;
      }
    }
  })();

  // Gratkappen entlang der beiden Grate, von unten nach oben
  var kappen = [];
  (function () {
    var dy = TRAUFE + UEBERSTAND - FIRST;
    [[TRAUFE_L, FIRST_L], [TRAUFE_R, FIRST_R]].forEach(function (g) {
      var dx = g[1] - g[0];
      var laenge = Math.sqrt(dx * dx + dy * dy);
      var winkel = Math.atan2(-dy, dx);
      var n = Math.floor(laenge / 21);
      for (var i = 0; i <= n; i++) {
        var f = Math.min(1, (i * 21 + 6) / laenge);
        kappen.push({
          x: g[0] + dx * f,
          y: TRAUFE + UEBERSTAND - dy * f,
          winkel: winkel,
          start: T.grat + i * T.gratAbstand
        });
      }
    });
    // Firstkappen von links nach rechts
    var k = 0;
    for (var x = FIRST_L + 4; x <= FIRST_R - 4; x += 22) {
      kappen.push({ x: x, y: FIRST, winkel: 0, first: true, start: T.first + k * T.firstAbstand });
      k++;
    }
  })();

  var ENDE = T.licht[0] + T.licht[1] + 0.1;

  /* ---------- Hilfen ---------- */

  function klemm(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function fortschritt(t, start, dauer) { return klemm((t - start) / dauer); }
  function ausCubic(p) { return 1 - Math.pow(1 - p, 3); }
  function ausZurueck(p) { var c = 1.4; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }

  /* ---------- Ziegel-Vorlagen (einmal je Größe gerendert) ---------- */

  var farben = [];
  (function () {
    for (var i = 0; i < 8; i++) farben.push([5 + zufall() * 7, 52 + zufall() * 12, 37 + zufall() * 9]);
    farben.push([4, 48, 31], [8, 44, 33]); // vereinzelt dunklere Ziegel
  })();

  var vorlagen = [];
  var kappenVorlage = null;
  var putzMuster = null;
  var RAND = 4;

  function biberPfad(c, b, h) {
    var k = b * 0.5;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(b, 0);
    c.lineTo(b, h - k);
    c.bezierCurveTo(b, h - k * 0.2, b * 0.78, h, b / 2, h);
    c.bezierCurveTo(b * 0.22, h, 0, h - k * 0.2, 0, h - k);
    c.closePath();
  }

  function vorlagenBauen(s) {
    vorlagen = farben.map(function (f) {
      var cv = document.createElement("canvas");
      cv.width = Math.ceil((ZIEGEL_B + RAND * 2) * s);
      cv.height = Math.ceil((ZIEGEL_H + RAND * 2) * s);
      var c = cv.getContext("2d");
      c.scale(s, s);
      c.translate(RAND, RAND);

      // Schlagschatten auf den darunterliegenden Ziegel
      c.save();
      c.shadowColor = "rgba(10, 4, 2, 0.55)";
      c.shadowBlur = 3.2 * s;
      c.shadowOffsetY = 2.2 * s;
      biberPfad(c, ZIEGEL_B, ZIEGEL_H);
      c.fillStyle = "hsl(" + f[0] + "," + f[1] + "%," + f[2] + "%)";
      c.fill();
      c.restore();

      // Fläche: oben verdeckt, unten Licht von links oben
      biberPfad(c, ZIEGEL_B, ZIEGEL_H);
      var g = c.createLinearGradient(0, 0, ZIEGEL_B * 0.6, ZIEGEL_H);
      g.addColorStop(0, "hsl(" + f[0] + "," + f[1] + "%," + (f[2] - 6) + "%)");
      g.addColorStop(0.55, "hsl(" + f[0] + "," + f[1] + "%," + (f[2] + 3) + "%)");
      g.addColorStop(1, "hsl(" + (f[0] - 1) + "," + (f[1] - 4) + "%," + (f[2] - 4) + "%)");
      c.fillStyle = g;
      c.fill();

      // Körnung des gebrannten Tons
      c.save();
      biberPfad(c, ZIEGEL_B, ZIEGEL_H);
      c.clip();
      for (var i = 0; i < 26; i++) {
        c.fillStyle = zufall() < 0.5 ? "rgba(255,225,205,0.07)" : "rgba(40,10,5,0.09)";
        c.beginPath();
        c.arc(zufall() * ZIEGEL_B, ZIEGEL_H * 0.4 + zufall() * ZIEGEL_H * 0.6, 0.4 + zufall() * 0.9, 0, 6.283);
        c.fill();
      }
      c.restore();

      // Helle Kante am Ziegelende
      var k = ZIEGEL_B * 0.5;
      c.beginPath();
      c.moveTo(0.8, ZIEGEL_H - k - 4);
      c.lineTo(0.8, ZIEGEL_H - k);
      c.bezierCurveTo(0.8, ZIEGEL_H - k * 0.2, ZIEGEL_B * 0.23, ZIEGEL_H - 0.8, ZIEGEL_B / 2, ZIEGEL_H - 0.8);
      c.strokeStyle = "rgba(255, 214, 190, 0.28)";
      c.lineWidth = 0.9;
      c.stroke();
      return cv;
    });

    // Grat-/Firstkappe (Halbrund, von oben gesehen)
    var kb = 30, kh = 20;
    var cv = document.createElement("canvas");
    cv.width = Math.ceil((kb + RAND * 2) * s);
    cv.height = Math.ceil((kh + RAND * 2) * s);
    var c = cv.getContext("2d");
    c.scale(s, s);
    c.translate(RAND, RAND);
    function kappenPfad() {
      c.beginPath();
      c.moveTo(kb, 1);
      c.lineTo(kh / 2, 1);
      c.bezierCurveTo(2, 1, 0, 5, 0, kh / 2);
      c.bezierCurveTo(0, kh - 5, 2, kh - 1, kh / 2, kh - 1);
      c.lineTo(kb, kh - 1);
      c.closePath();
    }
    c.save();
    c.shadowColor = "rgba(10, 4, 2, 0.6)";
    c.shadowBlur = 3 * s;
    c.shadowOffsetY = 1.5 * s;
    kappenPfad();
    c.fillStyle = "#7f2a1d";
    c.fill();
    c.restore();
    kappenPfad();
    var g = c.createLinearGradient(0, 0, 0, kh);
    g.addColorStop(0, "#a8412d");
    g.addColorStop(0.35, "#c9573f");
    g.addColorStop(1, "#7a2618");
    c.fillStyle = g;
    c.fill();
    c.beginPath();
    c.moveTo(kh / 2, 4.5);
    c.lineTo(kb - 2, 4.5);
    c.strokeStyle = "rgba(255, 220, 200, 0.3)";
    c.lineWidth = 1;
    c.stroke();
    kappenVorlage = { cv: cv, b: kb, h: kh };

    // feine Putzstruktur als Muster
    var pm = document.createElement("canvas");
    pm.width = pm.height = 48;
    var pc = pm.getContext("2d");
    for (var i = 0; i < 160; i++) {
      pc.fillStyle = zufall() < 0.5 ? "rgba(255,255,255,0.10)" : "rgba(60,45,30,0.07)";
      pc.fillRect(zufall() * 48, zufall() * 48, 1 + zufall(), 1 + zufall());
    }
    putzMuster = ctx.createPattern(pm, "repeat");
  }

  /* ---------- Layout ---------- */

  var dpr = 1, skala = 1, ox = 0, oy = 0, breite = 0, hoehe = 0;

  function layout() {
    var h = hero.getBoundingClientRect();
    var b = buehne.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    breite = h.width;
    hoehe = h.height;
    leinwand.width = Math.round(breite * dpr);
    leinwand.height = Math.round(hoehe * dpr);
    skala = b.width / W;
    ox = b.left - h.left;
    oy = b.top - h.top - OBEN * skala;
    vorlagenBauen(skala * dpr);
  }

  function welt() { ctx.setTransform(dpr * skala, 0, 0, dpr * skala, dpr * ox, dpr * oy); }

  /* ---------- Zeichnen ---------- */

  // Gerüst: Ständer, Lagen, Felder
  var G_X = [150, 250, 350, 450, 550, 650, 750, 850];
  var G_LAGEN = [508, 414];          // Oberkante der Beläge
  var G_OBEN = 332;                  // Oberkante Dachfangwand
  function geruestP(t, start, dauer, abbauStart, abbauDauer) {
    var auf = ausCubic(fortschritt(t, start, dauer));
    var ab = ausCubic(fortschritt(t, T.abbau + abbauStart, abbauDauer || 0.35));
    return auf * (1 - ab);
  }

  // Logo für das Gerüstbanner (dieselben Pfade wie im Seitenlogo)
  var LOGO_SCHRIFT = window.Path2D ? new Path2D("M220 400H300V720H220ZM325 470H395V650H425V470H495V720H360L325 685ZM348 402H398V450H348ZM420 402H470V450H420ZM520 260H595V455H680L715 490V685L680 720H520ZM595 525V650H640L650 640V535L640 525ZM775 455H910L945 490V605H815V650H945V720H775L740 685V490ZM815 515V555H875V515ZM985 340H1060V645H1180V720H985Z") : null;
  var LOGO_DACH = window.Path2D ? new Path2D("M545 55H608V210H545ZM65 437L735 85L1178 295V410L735 228L65 522Z") : null;

  function zeichneBoden(t) {
    var a = ausCubic(fortschritt(t, 0, 0.8));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var y = oy + BODEN * skala;
    var g = ctx.createLinearGradient(0, 0, breite, 0);
    g.addColorStop(0, "rgba(246,240,230,0)");
    g.addColorStop(0.3, "rgba(246,240,230," + 0.16 * a + ")");
    g.addColorStop(0.9, "rgba(246,240,230," + 0.16 * a + ")");
    g.addColorStop(1, "rgba(246,240,230,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, breite, 1);

    welt();
    ctx.save();
    ctx.globalAlpha = a;
    // Rasenstreifen und Pflasterweg zur Tür
    var rg = ctx.createLinearGradient(0, BODEN, 0, BODEN + 30);
    rg.addColorStop(0, "rgba(74, 98, 64, 0.55)");
    rg.addColorStop(1, "rgba(74, 98, 64, 0)");
    ctx.fillStyle = rg;
    ctx.fillRect(40, BODEN, 920, 30);
    ctx.fillStyle = "rgba(200, 190, 175, 0.35)";
    ctx.beginPath();
    ctx.moveTo(462, BODEN); ctx.lineTo(538, BODEN); ctx.lineTo(556, BODEN + 30); ctx.lineTo(444, BODEN + 30);
    ctx.closePath(); ctx.fill();
    // weicher Schatten unter dem Haus
    ctx.globalAlpha = 0.5 * a;
    ctx.translate(500, BODEN);
    ctx.scale(1, 0.08);
    var s = ctx.createRadialGradient(0, 0, 20, 0, 0, 440);
    s.addColorStop(0, "rgba(0,0,0,0.55)");
    s.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = s;
    ctx.fillRect(-440, -440, 880, 880);
    ctx.restore();
  }

  function zeichneHaus(t) {
    var p = ausCubic(fortschritt(t, T.haus[0], T.haus[1]));
    if (p <= 0) return;
    ctx.save();
    ctx.globalAlpha = p;
    ctx.translate(0, (1 - p) * 14);

    // Wand mit Putzstruktur
    var g = ctx.createLinearGradient(0, TRAUFE, 0, BODEN);
    g.addColorStop(0, "#d4c7b2");
    g.addColorStop(1, "#e7ddcc");
    ctx.fillStyle = g;
    ctx.fillRect(WAND_L, TRAUFE, WAND_R - WAND_L, BODEN - TRAUFE);
    if (putzMuster) {
      ctx.fillStyle = putzMuster;
      ctx.fillRect(WAND_L, TRAUFE, WAND_R - WAND_L, BODEN - TRAUFE);
    }
    // Ecken leicht abgesetzt
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.fillRect(WAND_R - 10, TRAUFE, 10, BODEN - TRAUFE);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(WAND_L, TRAUFE, 8, BODEN - TRAUFE);

    // Sockel aus Naturstein
    ctx.fillStyle = "#6c6764";
    ctx.fillRect(WAND_L, BODEN - 26, WAND_R - WAND_L, 26);
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(WAND_L, BODEN - 13); ctx.lineTo(WAND_R, BODEN - 13);
    for (var x = WAND_L + 22, n = 0; x < WAND_R; x += 26, n++) {
      var v = n % 2 ? 0 : 13;
      ctx.moveTo(x, BODEN - 26 + v); ctx.lineTo(x, BODEN - 13 + v);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(WAND_L, BODEN - 26, WAND_R - WAND_L, 1.5);

    // Fenster
    [238, 338, 602, 702].forEach(function (x) { fenster(x, 446, 60, 76); });

    // Haustür mit Oberlicht, Vordach-Konsole und Stufe
    ctx.fillStyle = "#efe7da";
    ctx.fillRect(462, 470, 76, BODEN - 26 - 470 + 2);
    var tg = ctx.createLinearGradient(470, 0, 530, 0);
    tg.addColorStop(0, "#3a3533");
    tg.addColorStop(1, "#2a2624");
    ctx.fillStyle = tg;
    ctx.fillRect(470, 478, 60, BODEN - 26 - 478);
    ctx.fillStyle = "rgba(170, 200, 210, 0.25)";
    ctx.fillRect(478, 488, 44, 26);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (var k = 0; k < 3; k++) ctx.fillRect(478, 522 + k * 18, 44, 12);
    ctx.fillStyle = "#c9b99b";
    ctx.fillRect(520, 548, 5, 2.5);
    ctx.fillStyle = "#8d8782";
    ctx.fillRect(452, BODEN - 26, 96, 6);
    ctx.fillRect(446, BODEN - 20, 108, 6);

    // Schatten unter dem Dachüberstand
    var sg = ctx.createLinearGradient(0, TRAUFE, 0, TRAUFE + 50);
    sg.addColorStop(0, "rgba(20, 16, 14, 0.5)");
    sg.addColorStop(1, "rgba(20, 16, 14, 0)");
    ctx.fillStyle = sg;
    ctx.fillRect(WAND_L, TRAUFE, WAND_R - WAND_L, 50);
    ctx.restore();
  }

  function fenster(x, y, b, h) {
    // Laibung mit Faschen
    ctx.fillStyle = "#f3ede2";
    ctx.fillRect(x - 6, y - 6, b + 12, h + 12);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(x - 6, y - 6, b + 12, 2);
    var g = ctx.createLinearGradient(x, y, x + b, y + h);
    g.addColorStop(0, "#44555d");
    g.addColorStop(1, "#22272c");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, b, h);
    // Gardine andeuten
    ctx.fillStyle = "rgba(240, 236, 228, 0.16)";
    ctx.fillRect(x + 2, y + 2, b - 4, h * 0.3);
    // Spiegelung
    ctx.fillStyle = "rgba(210, 230, 240, 0.12)";
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + b * 0.55, y); ctx.lineTo(x, y + h * 0.6); ctx.closePath();
    ctx.fill();
    // Flügelrahmen
    ctx.strokeStyle = "#f3ede2";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, b - 3, h - 3);
    ctx.fillStyle = "#f3ede2";
    ctx.fillRect(x + b / 2 - 2, y, 4, h);
    ctx.fillRect(x, y + h * 0.42, b, 3);
    // Fensterbank mit Schatten
    ctx.fillStyle = "#b3a792";
    ctx.fillRect(x - 9, y + h + 5, b + 18, 5);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(x - 7, y + h + 10, b + 14, 3);
  }

  function zeichneBuesche(t) {
    var p = ausCubic(fortschritt(t, 0.3, 0.8));
    if (p <= 0) return;
    ctx.save();
    ctx.globalAlpha = p;
    [[128, 596, 30], [160, 602, 22], [872, 598, 28], [842, 604, 20], [104, 606, 16]].forEach(function (b) {
      var g = ctx.createRadialGradient(b[0] - b[2] * 0.3, b[1] - b[2] * 0.4, 2, b[0], b[1], b[2]);
      g.addColorStop(0, "#5d7a4e");
      g.addColorStop(1, "#2f4228");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(b[0], b[1], b[2], b[2] * 0.85 * p, 0, Math.PI, 0);
      ctx.lineTo(b[0] + b[2], BODEN);
      ctx.lineTo(b[0] - b[2], BODEN);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }

  function holzFarbe(x0, x1, hell) {
    var g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, hell ? "#d8ad72" : "#c4935a");
    g.addColorStop(0.5, hell ? "#e3bb82" : "#cf9f64");
    g.addColorStop(1, hell ? "#b98a52" : "#a97a44");
    return g;
  }

  function zeichneDachstuhl(t) {
    var u = TRAUFE + UEBERSTAND;

    // Fußpfette auf der Mauerkrone, von links eingeschoben
    var pp = ausCubic(fortschritt(t, T.pfette[0], T.pfette[1]));
    if (pp > 0) {
      ctx.fillStyle = "#b8864d";
      ctx.fillRect(TRAUFE_L + 20, u - 8, (TRAUFE_R - TRAUFE_L - 40) * pp, 10);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(TRAUFE_L + 20, u + 1, (TRAUFE_R - TRAUFE_L - 40) * pp, 1.5);
    }

    // Sparrenköpfe unter der Traufe (bleiben am Ende sichtbar)
    sparren.forEach(function (s) {
      var p = ausCubic(fortschritt(t, s.start, T.sparrenDauer));
      if (p <= 0) return;
      ctx.globalAlpha = klemm(p * 2);
      ctx.fillStyle = "#a9773f";
      ctx.fillRect(s.x - 4, u, 8, 10 * p);
      ctx.fillStyle = "#8a5f30";
      ctx.fillRect(s.x - 4, u + 10 * p - 2, 8, 2);
    });
    ctx.globalAlpha = 1;

    ctx.save();
    dachPfad(ctx);
    ctx.clip();

    // Sparren werden von oben eingehoben
    sparren.forEach(function (s) {
      var p = fortschritt(t, s.start, T.sparrenDauer);
      if (p <= 0) return;
      var e = ausCubic(p);
      ctx.save();
      ctx.globalAlpha = klemm(p * 2.5);
      ctx.translate(0, -(1 - e) * 70);
      ctx.fillStyle = holzFarbe(s.x - 4, s.x + 4, false);
      ctx.fillRect(s.x - 4, s.oben - 10, 8, u - s.oben + 10);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(s.x + 2.5, s.oben - 10, 1.5, u - s.oben + 10);
      ctx.restore();
    });

    // Unterspannbahn, Bahn für Bahn von links ausgerollt
    var bahnH = 52;
    for (var b = 0; b * (bahnH - 6) < u - FIRST; b++) {
      var bp = ausCubic(fortschritt(t, T.bahn + b * T.bahnAbstand, T.bahnDauer));
      if (bp <= 0) continue;
      var y1 = u - b * (bahnH - 6) - bahnH;
      var bw = (TRAUFE_R - TRAUFE_L) * bp;
      ctx.fillStyle = "rgba(168, 186, 196, 0.94)";
      ctx.fillRect(TRAUFE_L, y1, bw, bahnH);
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.fillRect(TRAUFE_L, y1, bw, 3);
      ctx.fillStyle = "rgba(40, 60, 70, 0.25)";
      ctx.fillRect(TRAUFE_L, y1 + bahnH - 7, bw, 1.2);
      ctx.fillStyle = "rgba(40, 60, 70, 0.12)";
      for (var d = TRAUFE_L + 20; d < TRAUFE_L + bw - 20; d += 70) ctx.fillRect(d, y1 + bahnH / 2 - 1, 34, 2);
      if (bp < 1) {
        // die Rolle an der Vorderkante
        ctx.fillStyle = "#9fb0b9";
        ctx.fillRect(TRAUFE_L + bw - 5, y1 - 2, 10, bahnH + 4);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(TRAUFE_L + bw - 3, y1 - 2, 2, bahnH + 4);
      }
    }

    // Konterlatten auf den Sparren
    var kp = ausCubic(fortschritt(t, T.konter[0], T.konter[1]));
    if (kp > 0) {
      sparren.forEach(function (s) {
        var h = (u - s.oben) * kp;
        ctx.fillStyle = "#b78850";
        ctx.fillRect(s.x - 2.5, u - h, 5, h);
      });
    }

    // Dachlatten von links nach rechts
    reihen.forEach(function (r) {
      var p = ausCubic(fortschritt(t, r.start, T.lattenDauer));
      if (p <= 0) return;
      ctx.fillStyle = "#c29159";
      ctx.fillRect(r.l - 4, r.y - 2, (r.r - r.l + 8) * p, 4);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(r.l - 4, r.y + 1.5, (r.r - r.l + 8) * p, 1);
    });
    ctx.restore();

    // Gratsparren und Firstpfette
    var pg = ausCubic(fortschritt(t, T.gratbalken[0], T.gratbalken[1]));
    if (pg > 0) {
      ctx.save();
      ctx.strokeStyle = "#c79a61";
      ctx.lineWidth = 8;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(TRAUFE_L, u);
      ctx.lineTo(TRAUFE_L + (FIRST_L - TRAUFE_L) * pg, u - (u - FIRST) * pg);
      ctx.moveTo(TRAUFE_R, u);
      ctx.lineTo(TRAUFE_R - (TRAUFE_R - FIRST_R) * pg, u - (u - FIRST) * pg);
      if (pg > 0.6) {
        var q = (pg - 0.6) / 0.4;
        ctx.moveTo(FIRST_L, FIRST);
        ctx.lineTo(FIRST_L + (FIRST_R - FIRST_L) * q, FIRST);
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  function zeichneRichtbaum(t) {
    var auf = ausZurueck(fortschritt(t, T.richtbaum[0], T.richtbaum[1]));
    var ab = fortschritt(t, T.richtbaum[2], T.richtbaum[3]);
    if (auf <= 0 || ab >= 1) return;
    ctx.save();
    ctx.globalAlpha = 1 - ab;
    ctx.translate(500, FIRST - 2);
    ctx.scale(auf, auf);
    ctx.fillStyle = "#ece6da";
    ctx.fillRect(-1.5, -62, 3, 62);
    [[0, -58, 14, 11], [-9, -46, 12, 10], [9, -44, 12, 10], [0, -34, 11, 9]].forEach(function (k) {
      ctx.fillStyle = "#7fa35a";
      ctx.beginPath(); ctx.ellipse(k[0], k[1], k[2], k[3], 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath(); ctx.ellipse(k[0] - 3, k[1] - 3, k[2] * 0.5, k[3] * 0.4, 0, 0, 6.283); ctx.fill();
    });
    // Bänder
    [["#c9453a", -6], ["#f2d04b", 0], ["#3f7fc0", 6]].forEach(function (b, i) {
      ctx.strokeStyle = b[0];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b[1], -28);
      ctx.quadraticCurveTo(b[1] + 8, -18 + i * 2, b[1] + 3 + i * 3, -8 + i * 3);
      ctx.stroke();
    });
    ctx.restore();
  }

  function zeichneMasse(t) {
    // Bemaßung wie auf dem Plan, blendet nach dem Eindecken ab
    var ein = ausCubic(fortschritt(t, 2.8, 0.8));
    var aus = fortschritt(t, 10.2, 1.2);
    var a = ein * (1 - aus * 0.8);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a * 0.55;
    ctx.strokeStyle = "#f6f0e6";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    var y = FIRST - 44;
    ctx.beginPath();
    ctx.moveTo(FIRST_L, y); ctx.lineTo(FIRST_R, y);
    ctx.moveTo(TRAUFE_R + 36, TRAUFE + UEBERSTAND); ctx.lineTo(TRAUFE_R + 36, FIRST);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    [[FIRST_L, y], [FIRST_R, y]].forEach(function (p) { ctx.moveTo(p[0], p[1] - 7); ctx.lineTo(p[0], p[1] + 7); });
    [[TRAUFE_R + 36, TRAUFE + UEBERSTAND], [TRAUFE_R + 36, FIRST]].forEach(function (p) { ctx.moveTo(p[0] - 7, p[1]); ctx.lineTo(p[0] + 7, p[1]); });
    ctx.stroke();
    ctx.globalAlpha = a * 0.25;
    ctx.beginPath();
    ctx.moveTo(FIRST_L, FIRST); ctx.lineTo(FIRST_L, y - 10);
    ctx.moveTo(FIRST_R, FIRST); ctx.lineTo(FIRST_R, y - 10);
    ctx.moveTo(FIRST_R + 10, FIRST); ctx.lineTo(TRAUFE_R + 46, FIRST);
    ctx.moveTo(TRAUFE_R + 10, TRAUFE + UEBERSTAND); ctx.lineTo(TRAUFE_R + 46, TRAUFE + UEBERSTAND);
    ctx.stroke();
    ctx.globalAlpha = a * 0.5;
    ctx.beginPath();
    var w = Math.atan2(TRAUFE + UEBERSTAND - FIRST, FIRST_L - TRAUFE_L);
    ctx.arc(TRAUFE_L, TRAUFE + UEBERSTAND, 58, -w, 0);
    ctx.stroke();
    ctx.restore();
  }

  function zeichneRinne(t) {
    var p = ausCubic(fortschritt(t, T.rinne[0], T.rinne[1]));
    if (p <= 0) return;
    ctx.save();
    var y = TRAUFE + UEBERSTAND - 1;
    var l = TRAUFE_L - 8, r = TRAUFE_R + 8;
    // Traufblech
    ctx.fillStyle = "#6f7a7b";
    ctx.fillRect(l, y - 2, (r - l) * p, 3);
    // Rinne wird von links angesetzt
    var rr = l + (r - l) * p;
    var g = ctx.createLinearGradient(0, y, 0, y + 12);
    g.addColorStop(0, "#a9b3b4");
    g.addColorStop(0.4, "#808b8c");
    g.addColorStop(1, "#4f5859");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(l, y);
    ctx.lineTo(rr, y);
    ctx.lineTo(rr, y + 6);
    ctx.quadraticCurveTo(rr, y + 12, rr - 6, y + 12);
    ctx.lineTo(l + 6, y + 12);
    ctx.quadraticCurveTo(l, y + 12, l, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect(l, y, rr - l, 1.3);
    // Rinnenhaken
    ctx.fillStyle = "rgba(40,45,46,0.5)";
    for (var hx = l + 30; hx < rr - 10; hx += 60) ctx.fillRect(hx, y + 1, 2, 10);
    // Fallrohr mit Bogen und Schellen
    var fx = WAND_R - 26;
    var pr = ausCubic(fortschritt(t, T.fallrohr[0], T.fallrohr[1]));
    if (pr > 0) {
      var gr = ctx.createLinearGradient(fx - 5, 0, fx + 5, 0);
      gr.addColorStop(0, "#5e6869");
      gr.addColorStop(0.4, "#a0aaab");
      gr.addColorStop(1, "#4f5859");
      ctx.fillStyle = gr;
      ctx.fillRect(fx - 5, y + 11, 10, (BODEN - 14 - y) * pr);
      ctx.fillStyle = "#4f5859";
      for (var sy = y + 60; sy < y + 11 + (BODEN - 14 - y) * pr; sy += 70) ctx.fillRect(fx - 7, sy, 14, 3);
    }
    ctx.restore();
  }

  function zeichneZiegel(t) {
    var s = 1 / (skala * dpr);
    ctx.save();
    dachPfad(ctx);
    ctx.clip();
    for (var i = 0; i < ziegel.length; i++) {
      var z = ziegel[i];
      var p = fortschritt(t, z.start, T.ziegelDauer);
      if (p <= 0) continue;
      var v = vorlagen[z.sorte];
      var bw = v.width * s, bh = v.height * s;
      if (p >= 1) {
        ctx.drawImage(v, z.x - RAND, z.y - RAND, bw, bh);
        continue;
      }
      var e = ausCubic(p);
      var cx = z.x + ZIEGEL_B / 2, cy = z.y + ZIEGEL_H * 0.75;
      ctx.save();
      ctx.globalAlpha = klemm(p * 3);
      ctx.translate(cx, cy - (1 - e) * 34);
      ctx.rotate(z.dreh * (1 - e));
      var sc = 1 + (1 - ausZurueck(p)) * 0.12;
      ctx.scale(sc, sc);
      ctx.drawImage(v, -ZIEGEL_B / 2 - RAND, -ZIEGEL_H * 0.75 - RAND, bw, bh);
      ctx.restore();
    }
    ctx.restore();
  }

  function zeichneKappen(t) {
    if (!kappenVorlage) return;
    var s = 1 / (skala * dpr);
    var k = kappenVorlage;
    var bw = k.cv.width * s, bh = k.cv.height * s;
    for (var i = 0; i < kappen.length; i++) {
      var c = kappen[i];
      var p = fortschritt(t, c.start, T.kappeDauer);
      if (p <= 0) continue;
      var e = ausZurueck(p);
      ctx.save();
      ctx.globalAlpha = klemm(p * 2.5);
      ctx.translate(c.x, c.y - (1 - ausCubic(p)) * 16);
      ctx.rotate(c.winkel);
      ctx.scale(0.85 + 0.15 * e, 0.85 + 0.15 * e);
      ctx.drawImage(k.cv, -k.h / 2 - RAND, -k.h / 2 - RAND, bw, bh);
      ctx.restore();
    }
  }

  function zeichneSchneefang(t) {
    var p = ausCubic(fortschritt(t, T.schneefang[0], T.schneefang[1]));
    if (p <= 0) return;
    var y = TRAUFE + UEBERSTAND - 3 * REIHE - 4;
    var l = randLinks(y) + 14, r = l + (randRechts(y) - 14 - l) * p;
    ctx.save();
    ctx.fillStyle = "#3a3d40";
    for (var x = l + 10; x < r; x += 46) ctx.fillRect(x, y - 9, 3, 12);
    ctx.fillStyle = "#6d7577";
    ctx.fillRect(l, y - 9, r - l, 2.5);
    ctx.fillRect(l, y - 3, r - l, 2.5);
    ctx.restore();
  }

  // Der Schornstein wird von der Mauerkrone aus hochgemauert. Der untere Teil
  // liegt hinter der Dachfläche (wird vor den Ziegeln gezeichnet), der Kopf
  // ragt aus dem Dach (wird danach gezeichnet).
  var KAMIN_DURCHGANG = 262;
  function zeichneSchornstein(t, teil) {
    var p = ausCubic(fortschritt(t, T.schornstein[0], T.schornstein[1]));
    if (p <= 0) return;
    var l = 404, r = 442, fuss = TRAUFE, kopf = 112;
    var oben = fuss - (fuss - kopf) * p;
    ctx.save();
    ctx.beginPath();
    if (teil === "unten") ctx.rect(l - 10, KAMIN_DURCHGANG, r - l + 20, fuss - KAMIN_DURCHGANG);
    else ctx.rect(l - 10, 0, r - l + 20, KAMIN_DURCHGANG);
    ctx.clip();
    var g = ctx.createLinearGradient(l, 0, r, 0);
    g.addColorStop(0, "#9a3a2a");
    g.addColorStop(0.6, "#86301f");
    g.addColorStop(1, "#6b2518");
    ctx.fillStyle = g;
    ctx.fillRect(l, oben, r - l, fuss - oben);
    ctx.strokeStyle = "rgba(30, 10, 6, 0.35)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (var y = fuss - 7, n = 0; y > oben; y -= 7, n++) {
      ctx.moveTo(l, y); ctx.lineTo(r, y);
      for (var x = l + (n % 2 ? 9.5 : 0) + 19; x < r; x += 19) { ctx.moveTo(x, y); ctx.lineTo(x, Math.max(oben, y - 7)); }
    }
    ctx.stroke();
    if (p > 0.85) {
      ctx.globalAlpha = (p - 0.85) / 0.15;
      ctx.fillStyle = "#3b3c41";
      ctx.fillRect(l - 6, oben - 7, r - l + 12, 8);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(l - 6, oben - 7, r - l + 12, 1.2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (teil === "unten") return;
    // Verwahrung aus Zink erst mit den Klempnerarbeiten
    var vp = ausCubic(fortschritt(t, T.verwahrung[0], T.verwahrung[1]));
    if (vp > 0) {
      ctx.save();
      ctx.globalAlpha = vp;
      var vy = KAMIN_DURCHGANG;
      ctx.fillStyle = "#8b9695";
      ctx.fillRect(l - 7, vy - 10, r - l + 14, 12);
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.fillRect(l - 7, vy - 10, r - l + 14, 1.3);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(l - 7, vy + 1, r - l + 14, 1.5);
      ctx.restore();
    }
  }

  /* Gerüst vor der Fassade: wird aufgebaut und am Ende wieder abgebaut */
  function rohr(x1, y1, x2, y2, dicke) {
    ctx.lineWidth = dicke;
    ctx.strokeStyle = "#9aa3a5";
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.lineWidth = dicke * 0.35;
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath(); ctx.moveTo(x1 - dicke * 0.2, y1 - dicke * 0.2); ctx.lineTo(x2 - dicke * 0.2, y2 - dicke * 0.2); ctx.stroke();
  }

  function zeichneGeruest(t) {
    var b0 = T.geruest;
    if (t < b0) return;
    ctx.save();
    ctx.lineCap = "round";
    var n = G_X.length;

    // Fußplatten und Ständer wachsen aus dem Boden
    G_X.forEach(function (x, i) {
      var p = geruestP(t, b0 + i * 0.07, 0.45, 1.0 - i * 0.05, 0.4);
      if (p <= 0) return;
      ctx.fillStyle = "#8a6a45";
      ctx.fillRect(x - 12, BODEN - 3, 24, 4);
      ctx.fillStyle = "#6d7577";
      ctx.fillRect(x - 6, BODEN - 5, 12, 3);
      rohr(x, BODEN - 4, x, BODEN - 4 - (BODEN - 4 - G_OBEN) * p, 4);
    });

    // Längsriegel und Geländer je Lage, von unten nach oben
    G_LAGEN.forEach(function (y, lage) {
      var p = geruestP(t, b0 + 0.55 + lage * 0.3, 0.5, 0.7 - lage * 0.15, 0.3);
      if (p <= 0) return;
      var xe = G_X[0] + (G_X[n - 1] - G_X[0]) * p;
      rohr(G_X[0], y - 28, xe, y - 28, 3);
      rohr(G_X[0], y - 54, xe, y - 54, 3);
      rohr(G_X[0], y + 8, xe, y + 8, 3);
    });
    // Geländer der Dachfangwand
    var pf = geruestP(t, b0 + 1.2, 0.4, 0.55, 0.3);
    if (pf > 0) rohr(G_X[0], G_OBEN, G_X[0] + (G_X[n - 1] - G_X[0]) * pf, G_OBEN, 3);

    // Diagonalen in jedem zweiten Feld
    for (var f = 0; f < n - 1; f += 2) {
      var pd = geruestP(t, b0 + 0.9 + f * 0.04, 0.4, 0.6, 0.3);
      if (pd <= 0) continue;
      var x1 = G_X[f], x2 = G_X[f + 1];
      rohr(x1, BODEN - 6, x1 + (x2 - x1) * pd, BODEN - 6 - (BODEN - 6 - G_LAGEN[0] - 8) * pd, 2.5);
      rohr(x2, G_LAGEN[0] + 8, x2 - (x2 - x1) * pd, G_LAGEN[0] + 8 - (G_LAGEN[0] - G_LAGEN[1]) * pd, 2.5);
    }

    // Beläge und Bordbretter, Feld für Feld eingelegt
    G_LAGEN.forEach(function (y, lage) {
      for (var f = 0; f < n - 1; f++) {
        var pb = geruestP(t, b0 + 0.8 + lage * 0.3 + f * 0.05, 0.35, 0.3 - lage * 0.1 + f * 0.02, 0.3);
        if (pb <= 0) continue;
        var x1 = G_X[f] + 3, x2 = G_X[f + 1] - 3;
        ctx.save();
        ctx.globalAlpha = klemm(pb * 2);
        ctx.translate(0, -(1 - pb) * 20);
        ctx.fillStyle = "#7f898c";
        ctx.fillRect(x1, y, x2 - x1, 7);
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(x1, y, x2 - x1, 1.2);
        ctx.fillStyle = "#b5874f";
        ctx.fillRect(x1, y - 10, x2 - x1, 10);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(x1, y - 1.5, x2 - x1, 1.5);
        ctx.restore();
      }
    });

    // Dachfangnetz vor der Traufe
    var pn = geruestP(t, b0 + 1.4, 0.5, 0.45, 0.3);
    if (pn > 0) {
      ctx.save();
      ctx.globalAlpha = 0.55 * pn;
      ctx.strokeStyle = "#1b2a24";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (var gx = G_X[0]; gx <= G_X[n - 1]; gx += 9) { ctx.moveTo(gx, G_OBEN); ctx.lineTo(gx, G_LAGEN[1] - 54); }
      for (var gy = G_OBEN; gy <= G_LAGEN[1] - 54; gy += 9) { ctx.moveTo(G_X[0], gy); ctx.lineTo(G_X[n - 1], gy); }
      ctx.stroke();
      ctx.restore();
    }

    // Banner mit Logo am Geländer der ersten Lage
    var pbn = geruestP(t, b0 + 1.6, 0.5, 0.5, 0.3);
    if (pbn > 0 && LOGO_SCHRIFT) {
      var bx = 440, by = G_LAGEN[0] - 54, bb = 120, bh = 50;
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, bb, bh * pbn);
      ctx.clip();
      ctx.fillStyle = "#f6f0e6";
      ctx.fillRect(bx, by, bb, bh);
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fillRect(bx, by + bh - 3, bb, 3);
      ctx.translate(bx + 17, by + 5);
      var sc = 86 / 1135;
      ctx.scale(sc, sc);
      ctx.translate(-55, -45);
      ctx.fillStyle = "#3d3e43";
      ctx.fill(LOGO_SCHRIFT, "evenodd");
      ctx.fillStyle = "#b5412f";
      ctx.fill(LOGO_DACH);
      ctx.restore();
      // Befestigung
      ctx.fillStyle = "#3a3d40";
      [bx + 6, bx + bb - 8].forEach(function (x) { ctx.fillRect(x, by - 2, 3, 5); });
    }
    ctx.restore();
  }

  function zeichneLicht(t) {
    var p = fortschritt(t, T.licht[0], T.licht[1]);
    if (p <= 0 || p >= 1) return;
    var x = TRAUFE_L - 200 + (TRAUFE_R - TRAUFE_L + 400) * ausCubic(p);
    ctx.save();
    dachPfad(ctx);
    ctx.clip();
    var g = ctx.createLinearGradient(x - 90, 0, x + 90, 0);
    g.addColorStop(0, "rgba(255, 236, 214, 0)");
    g.addColorStop(0.5, "rgba(255, 236, 214, 0.22)");
    g.addColorStop(1, "rgba(255, 236, 214, 0)");
    ctx.fillStyle = g;
    ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([1, 0, -0.45, 1, 0, 0])));
    ctx.fillRect(x - 300, FIRST - 20, 600, TRAUFE - FIRST + 40);
    ctx.restore();
  }

  function bild(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, leinwand.width, leinwand.height);
    zeichneBoden(t);
    welt();
    zeichneMasse(t);
    zeichneHaus(t);
    zeichneSchornstein(t, "unten");
    zeichneDachstuhl(t);
    zeichneZiegel(t);
    zeichneKappen(t);
    zeichneSchneefang(t);
    zeichneRichtbaum(t);
    zeichneSchornstein(t, "oben");
    zeichneRinne(t);
    zeichneBuesche(t);
    zeichneGeruest(t);
    zeichneLicht(t);
  }

  /* ---------- Ablauf ---------- */

  var zeit = ruhig ? ENDE : 0;
  var zuletzt = null;
  var laeuft = false;

  function schritt(jetzt) {
    if (zuletzt !== null) zeit += Math.min((jetzt - zuletzt) / 1000, 0.05) * TEMPO;
    zuletzt = jetzt;
    bild(zeit);
    if (zeit < ENDE) requestAnimationFrame(schritt);
    else laeuft = false;
  }

  function starten() {
    if (laeuft) return;
    laeuft = true;
    zuletzt = null;
    requestAnimationFrame(schritt);
  }

  function neuZeichnen() {
    layout();
    if (!laeuft) bild(zeit);
  }

  var wartet = null;
  window.addEventListener("resize", function () {
    clearTimeout(wartet);
    wartet = setTimeout(neuZeichnen, 120);
  });

  // Erneut abspielen: Doppelklick auf das Dach (praktisch für Präsentationen)
  hero.addEventListener("dblclick", function (e) {
    if (ruhig || e.target.closest("a, button")) return;
    zeit = 0;
    starten();
  });

  function los() {
    layout();
    bild(zeit);
    if (zeit < ENDE) starten();
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(los);
  else los();
})();
