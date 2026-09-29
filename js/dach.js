/*
 * Hero-Animation: Ein Dach entsteht – wie auf der Baustelle.
 * Ablauf: Haus → Gerüst → Dachstuhl (Fußpfette, Sparren, Grat, First)
 *         → Unterspannbahn, Konterlatten, Dachlatten → Biberschwanz Reihe für Reihe
 *         → Grat- und Firstziegel → Klempner (Rinne, Fallrohr, Verwahrung, Schneefang)
 *         → Gerüst abbauen → Lichtkante. Ein Mitarbeiter in Tübel-Kleidung
 *         begleitet jeden Schritt, ein Schrägaufzug bringt die Ziegel hoch.
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

  var TEMPO = 1;             // > 1 spielt schneller ab
  var G = 1.7;               // Dehnung der Gerüst-Schritte
  var T = {
    haus: [0, 1.0],
    schornstein: [0.5, 1.0],
    geruest: 1.2,            // Ständer, danach Riegel, Beläge, Diagonalen, Netz, Banner
    pfette: [4.2, 0.7],
    sparren: 4.6, sparrenDauer: 0.7, sparrenAbstand: 0.14,
    gratbalken: [7.2, 1.0],
    bahn: 8.3, bahnDauer: 0.8, bahnAbstand: 0.45,
    konter: [11.0, 0.8],
    latten: 11.6, lattenDauer: 0.6, lattenAbstand: 0.07,
    ziegel: 13.2, reihenAbstand: 0.3, spaltenAbstand: 0.028, ziegelDauer: 0.7,
    grat: 19.0, gratAbstand: 0.08, kappeDauer: 0.45,
    first: 19.8, firstAbstand: 0.07,
    rinne: [22.2, 0.8], fallrohr: [22.8, 0.7], verwahrung: [22.5, 0.5], schneefang: [23.0, 0.7],
    abbau: 25.0,
    licht: [27.6, 1.6]
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
          dreh: (zufall() - 0.5) * 0.22,
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
      ctx.translate(0, -(1 - e) * 45);
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

  function zeichneMasse(t) {
    // Bemaßung wie auf dem Plan, blendet nach dem Eindecken ab
    var ein = ausCubic(fortschritt(t, 4.0, 1.0));
    var aus = fortschritt(t, 18.5, 1.5);
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
      ctx.globalAlpha = klemm(p * 2);
      ctx.translate(cx, cy - (1 - e) * 18);
      ctx.rotate(z.dreh * (1 - e));
      var sc = 1 + (1 - ausCubic(p)) * 0.06;
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
      var p = geruestP(t, b0 + i * 0.07 * G, 0.45 * G, (1.0 - i * 0.05) * G, 0.4 * G);
      if (p <= 0) return;
      ctx.fillStyle = "#8a6a45";
      ctx.fillRect(x - 12, BODEN - 3, 24, 4);
      ctx.fillStyle = "#6d7577";
      ctx.fillRect(x - 6, BODEN - 5, 12, 3);
      rohr(x, BODEN - 4, x, BODEN - 4 - (BODEN - 4 - G_OBEN) * p, 4);
    });

    // Längsriegel und Geländer je Lage, von unten nach oben
    G_LAGEN.forEach(function (y, lage) {
      var p = geruestP(t, b0 + (0.55 + lage * 0.3) * G, 0.5 * G, (0.7 - lage * 0.15) * G, 0.3 * G);
      if (p <= 0) return;
      var xe = G_X[0] + (G_X[n - 1] - G_X[0]) * p;
      rohr(G_X[0], y - 28, xe, y - 28, 3);
      rohr(G_X[0], y - 54, xe, y - 54, 3);
      rohr(G_X[0], y + 8, xe, y + 8, 3);
    });
    // Geländer der Dachfangwand
    var pf = geruestP(t, b0 + 1.2 * G, 0.4 * G, 0.55 * G, 0.3 * G);
    if (pf > 0) rohr(G_X[0], G_OBEN, G_X[0] + (G_X[n - 1] - G_X[0]) * pf, G_OBEN, 3);

    // Diagonalen in jedem zweiten Feld
    for (var f = 0; f < n - 1; f += 2) {
      var pd = geruestP(t, b0 + (0.9 + f * 0.04) * G, 0.4 * G, 0.6 * G, 0.3 * G);
      if (pd <= 0) continue;
      var x1 = G_X[f], x2 = G_X[f + 1];
      rohr(x1, BODEN - 6, x1 + (x2 - x1) * pd, BODEN - 6 - (BODEN - 6 - G_LAGEN[0] - 8) * pd, 2.5);
      rohr(x2, G_LAGEN[0] + 8, x2 - (x2 - x1) * pd, G_LAGEN[0] + 8 - (G_LAGEN[0] - G_LAGEN[1]) * pd, 2.5);
    }

    // Beläge und Bordbretter, Feld für Feld eingelegt
    G_LAGEN.forEach(function (y, lage) {
      for (var f = 0; f < n - 1; f++) {
        var pb = geruestP(t, b0 + (0.8 + lage * 0.3 + f * 0.05) * G, 0.35 * G, (0.3 - lage * 0.1 + f * 0.02) * G, 0.3 * G);
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
    var pn = geruestP(t, b0 + 1.4 * G, 0.5 * G, 0.45 * G, 0.3 * G);
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

    ctx.restore();
  }

  /* ---------- Baustelle: Leiter, Schrägaufzug, Mitarbeiter ---------- */

  var LEITER_X = 172;                 // Leitergang im ersten Gerüstfeld
  var DECK = G_LAGEN[1];              // oberste Gerüstlage (Standfläche)

  function zeichneLeiter(t) {
    var p = geruestP(t, T.geruest + 1.0 * G, 0.5 * G, 0.4 * G, 0.3 * G);
    if (p <= 0) return;
    ctx.save();
    ctx.globalAlpha = klemm(p * 1.5);
    var unten = BODEN - 2, oben = DECK - 34;
    var yo = unten - (unten - oben) * p;
    ctx.strokeStyle = "#b9c0c2";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(LEITER_X - 9, unten); ctx.lineTo(LEITER_X - 9, yo);
    ctx.moveTo(LEITER_X + 9, unten); ctx.lineTo(LEITER_X + 9, yo);
    ctx.stroke();
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (var y = unten - 10; y > yo; y -= 11) { ctx.moveTo(LEITER_X - 9, y); ctx.lineTo(LEITER_X + 9, y); }
    ctx.stroke();
    ctx.restore();
  }

  // Schrägaufzug bringt die Ziegel aufs Dach
  var AUFZ_U = { x: 968, y: BODEN }, AUFZ_O = { x: 872, y: 360 };
  function zeichneAufzug(t) {
    var ein = ausCubic(fortschritt(t, T.ziegel - 1.2, 0.8));
    var aus = ausCubic(fortschritt(t, T.abbau - 0.2, 0.6));
    var a = ein * (1 - aus);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    var dx = AUFZ_O.x - AUFZ_U.x, dy = AUFZ_O.y - AUFZ_U.y;
    var len = Math.sqrt(dx * dx + dy * dy), nx = -dy / len * 6, ny = dx / len * 6;
    // Ziegelpalette am Boden
    ctx.fillStyle = "#8a6a45";
    ctx.fillRect(918, BODEN - 6, 40, 6);
    var rest = 1 - fortschritt(t, T.ziegel, 5.8) * 0.8;
    for (var r = 0; r < Math.round(5 * rest); r++) {
      ctx.fillStyle = r % 2 ? "#a9432f" : "#b84d36";
      ctx.fillRect(920, BODEN - 12 - r * 6, 36, 6);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(920, BODEN - 7 - r * 6, 36, 1);
    }
    // Schiene mit Sprossen
    ctx.strokeStyle = "#c9cfd1";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(AUFZ_U.x + nx, AUFZ_U.y + ny); ctx.lineTo(AUFZ_O.x + nx, AUFZ_O.y + ny);
    ctx.moveTo(AUFZ_U.x - nx, AUFZ_U.y - ny); ctx.lineTo(AUFZ_O.x - nx, AUFZ_O.y - ny);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (var f = 0.04; f < 1; f += 0.045) {
      var px = AUFZ_U.x + dx * f, py = AUFZ_U.y + dy * f;
      ctx.moveTo(px + nx, py + ny); ctx.lineTo(px - nx, py - ny);
    }
    ctx.stroke();
    // Motor am Fuß
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(AUFZ_U.x - 6, BODEN - 22, 20, 16);
    ctx.fillStyle = "#2c2e31";
    ctx.fillRect(AUFZ_U.x - 2, BODEN - 6, 5, 6);
    // Schlitten: fährt voll hoch, leer herunter
    var zyklus = 2.6, s = ((t - T.ziegel + 1.0) % zyklus + zyklus) % zyklus / zyklus;
    var pos = s < 0.45 ? ausCubic(s / 0.45) : s < 0.6 ? 1 : 1 - ausCubic((s - 0.6) / 0.4);
    var voll = s < 0.6;
    if (t > T.first) { pos = 0; voll = false; }
    var sx = AUFZ_U.x + dx * (0.08 + 0.9 * pos), sy = AUFZ_U.y + dy * (0.08 + 0.9 * pos);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = "#5c6366";
    ctx.fillRect(-12, -3, 24, 4);
    if (voll) {
      for (var k = 0; k < 3; k++) {
        ctx.fillStyle = k % 2 ? "#a9432f" : "#b84d36";
        ctx.fillRect(-11, -9 - k * 5, 22, 5);
      }
    }
    ctx.restore();
    ctx.restore();
  }

  // Laufweg des Mitarbeiters als feste Stationen: Er geht ruhig von Station zu
  // Station, bleibt stehen und arbeitet. "modus" gilt für den Abschnitt, der an
  // der Station beginnt (Armhaltung); die Beine bewegen sich nur, wenn er läuft.
  var B = BODEN, D = G_LAGEN[1];
  var WEG = [
    { t: 1.0,  x: 40,  y: B, modus: "gehen",    werkzeug: "rohr" },
    { t: 2.6,  x: 230, y: B, modus: "stehen",   werkzeug: "rohr" },
    { t: 3.0,  x: 230, y: B, modus: "gehen" },
    { t: 3.6,  x: 172, y: B, modus: "klettern" },
    { t: 5.0,  x: 172, y: D, modus: "gehen" },
    { t: 5.9,  x: 290, y: D, modus: "haemmern", werkzeug: "hammer" },
    { t: 6.5,  x: 290, y: D, modus: "gehen" },
    { t: 7.4,  x: 420, y: D, modus: "haemmern", werkzeug: "hammer" },
    { t: 8.6,  x: 420, y: D, modus: "gehen" },
    { t: 9.6,  x: 560, y: D, modus: "haemmern", werkzeug: "hammer" },
    { t: 11.0, x: 560, y: D, modus: "gehen" },
    { t: 12.3, x: 380, y: D, modus: "haemmern", werkzeug: "hammer" },
    { t: 13.2, x: 380, y: D, modus: "legen",    werkzeug: "ziegel" },
    { t: 14.6, x: 330, y: 350, modus: "legen",  werkzeug: "ziegel" },
    { t: 16.0, x: 420, y: 285, modus: "legen",  werkzeug: "ziegel" },
    { t: 17.4, x: 360, y: 222, modus: "legen",  werkzeug: "ziegel" },
    { t: 18.6, x: 470, y: 180, modus: "legen",  werkzeug: "ziegel" },
    { t: 20.9, x: 420, y: 178, modus: "gehen" },
    { t: 22.6, x: 300, y: D, modus: "haemmern", werkzeug: "hammer" },
    { t: 23.4, x: 300, y: D, modus: "gehen" },
    { t: 24.3, x: 172, y: D, modus: "klettern" },
    { t: 25.6, x: 172, y: B, modus: "gehen" },
    { t: 28.2, x: 560, y: B, modus: "stehen" }
  ];
  // Wegstrecke bis zu jeder Station, damit die Schritte zur Strecke passen
  (function () {
    var s = 0;
    WEG[0].strecke = 0;
    for (var i = 1; i < WEG.length; i++) {
      s += Math.hypot(WEG[i].x - WEG[i - 1].x, WEG[i].y - WEG[i - 1].y);
      WEG[i].strecke = s;
    }
  })();

  function weich(p) { return p * p * (3 - 2 * p); }

  function arbeiterPos(t) {
    if (t < WEG[0].t) return null;
    var i = 0;
    while (i < WEG.length - 1 && WEG[i + 1].t <= t) i++;
    var a = WEG[i], b = WEG[Math.min(i + 1, WEG.length - 1)];
    var dauer = b.t - a.t;
    var p = dauer > 0 ? klemm((t - a.t) / dauer) : 1;
    var e = weich(p);
    var laenge = b.strecke - a.strecke;
    // Geschwindigkeit (Einheiten/s) aus der Ableitung von weich()
    var tempo = dauer > 0 ? laenge * 6 * p * (1 - p) / dauer : 0;
    return {
      x: a.x + (b.x - a.x) * e,
      y: a.y + (b.y - a.y) * e,
      strecke: a.strecke + laenge * e,
      tempo: tempo,
      modus: a.modus,
      vorher: i > 0 ? WEG[i - 1].modus : a.modus,
      seit: t - a.t,
      werkzeug: a.werkzeug
    };
  }

  // Armwinkel je Tätigkeit
  function armWinkel(modus, t, a, schritt) {
    if (modus === "gehen") return [0.12 + schritt * 0.25, 0.12 - schritt * 0.25];
    if (modus === "klettern") { var k = Math.sin(a.strecke * 0.09); return [2.8 + k * 0.25, 2.8 - k * 0.25]; }
    if (modus === "haemmern") return [0.35, 2.3 + Math.sin(t * 9) * 0.45];
    if (modus === "legen") { var r = (Math.sin(t * 4) + 1) / 2; return [0.3 + r * 0.25, 2.2 + r * 0.75]; }
    return [0.1, 0.1];
  }

  function zeichneArbeiter(t) {
    var a = arbeiterPos(t);
    if (!a) return;
    // Schrittweite wächst mit dem Tempo, damit Anlaufen und Anhalten weich sind
    var staerke = klemm(a.tempo / 60);
    var schritt = Math.sin(a.strecke * 0.11) * staerke;
    var ein = klemm((t - 1.0) / 0.4);

    ctx.save();
    ctx.globalAlpha = ein;
    ctx.translate(a.x, a.y);
    var H = 1;                            // Figur ca. 98 Einheiten hoch

    // Schatten
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath(); ctx.ellipse(0, 1, 17, 3, 0, 0, 6.283); ctx.fill();

    var klettern = a.modus === "klettern";
    var kl = Math.sin(a.strecke * 0.09) * staerke;
    var hebL = klettern ? Math.max(0, kl) * 8 : Math.max(0, schritt) * 5;
    var hebR = klettern ? Math.max(0, -kl) * 8 : Math.max(0, -schritt) * 5;

    // Beine: Arbeitshose anthrazit mit roten Kniepolster-Taschen
    function bein(x, heb) {
      ctx.fillStyle = "#2f3136";
      ctx.fillRect(x - 6, -48, 12, 42 - heb);
      ctx.fillStyle = "#b5412f";
      ctx.fillRect(x - 6, -28 - heb * 0.5, 12, 3);
      ctx.fillStyle = "#1b1c1e";               // Arbeitsschuh
      ctx.fillRect(x - 7, -8 - heb, 14, 8);
      ctx.fillStyle = "#4a4c50";
      ctx.fillRect(x - 7, -1.5 - heb, 14, 1.5);
    }
    bein(-7, hebL);
    bein(7, hebR);

    // Werkzeuggürtel
    ctx.fillStyle = "#3b2c20";
    ctx.fillRect(-17, -50, 34, 5);
    ctx.fillStyle = "#6b4e33";
    ctx.fillRect(9, -48, 8, 9);

    // Oberteil: weißes Poloshirt, Rücken zum Betrachter
    var g = ctx.createLinearGradient(-17, 0, 17, 0);
    g.addColorStop(0, "#e2ded6");
    g.addColorStop(0.4, "#fbf9f4");
    g.addColorStop(1, "#d6d1c7");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-17, -48); ctx.lineTo(17, -48); ctx.lineTo(18, -76);
    ctx.quadraticCurveTo(17, -82, 10, -83); ctx.lineTo(-10, -83);
    ctx.quadraticCurveTo(-17, -82, -18, -76);
    ctx.closePath(); ctx.fill();
    // Kragen
    ctx.fillStyle = "#e9e5dd";
    ctx.fillRect(-7, -85, 14, 4);
    // Tübel-Logo auf dem Rücken
    if (LOGO_SCHRIFT) {
      ctx.save();
      ctx.translate(-12, -76);
      ctx.scale(24 / 1135, 24 / 1135);
      ctx.translate(-55, -45);
      ctx.fillStyle = "#3d3e43";
      ctx.fill(LOGO_SCHRIFT, "evenodd");
      ctx.fillStyle = "#b5412f";
      ctx.fill(LOGO_DACH);
      ctx.restore();
    }

    // Arme
    function arm(seite, winkel, werkzeug) {
      ctx.save();
      ctx.translate(seite * 16, -78);
      ctx.rotate(-winkel * seite);
      ctx.fillStyle = "#f3f0ea";                // Ärmel
      ctx.fillRect(-4.5, 0, 9, 11);
      ctx.fillStyle = "#d9a585";                // Unterarm
      ctx.fillRect(-3.5, 10, 7, 17);
      ctx.fillStyle = "#b5412f";                // Arbeitshandschuh
      ctx.fillRect(-4, 26, 8, 7);
      if (werkzeug === "hammer") {
        ctx.fillStyle = "#7a5a3a";
        ctx.fillRect(-1.5, 30, 3, 14);
        ctx.fillStyle = "#3a3d40";
        ctx.fillRect(-6, 42, 12, 5);
      } else if (werkzeug === "ziegel") {
        ctx.fillStyle = "#b84d36";
        ctx.fillRect(-7, 31, 14, 18);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fillRect(-7, 45, 14, 4);
      }
      ctx.restore();
    }
    // Armhaltung weich von der vorigen Tätigkeit überblenden
    var jetzt = armWinkel(a.modus, t, a, schritt);
    var mix = weich(klemm(a.seit / 0.5));
    var alt = armWinkel(a.vorher, t, a, schritt);
    var links = alt[0] + (jetzt[0] - alt[0]) * mix;
    var rechts = alt[1] + (jetzt[1] - alt[1]) * mix;
    var wz = a.modus === "haemmern" ? "hammer" : a.modus === "legen" ? "ziegel" : null;
    arm(-1, links, null);
    arm(1, rechts, wz);

    // Mitgetragenes: Gerüstrohr auf der Schulter oder Bahnenrolle
    if (a.werkzeug === "rohr") {
      ctx.fillStyle = "#a7afb1";
      ctx.save(); ctx.rotate(-0.08);
      ctx.fillRect(-46, -86, 92, 4);
      ctx.restore();
    }
    if (a.werkzeug === "rolle") {
      ctx.fillStyle = "#9fb0b9";
      ctx.fillRect(-26, -34, 52, 12);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(-26, -34, 52, 3);
    }

    // Kopf: Nacken, kurze Haare, weißer Schutzhelm
    ctx.fillStyle = "#d9a585";
    ctx.fillRect(-4, -89, 8, 6);
    ctx.fillStyle = "#4a3426";
    ctx.beginPath(); ctx.ellipse(0, -96, 9, 10, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = "#d9a585";
    ctx.beginPath(); ctx.ellipse(-9, -95, 2, 3, 0, 0, 6.283); ctx.ellipse(9, -95, 2, 3, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = "#f4f2ee";
    ctx.beginPath();
    ctx.ellipse(0, -101, 11, 8, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-13, -102, 26, 3);
    ctx.fillStyle = "#b5412f";
    ctx.fillRect(-2, -109, 4, 8);

    ctx.restore();
  }

  function zeichneBanner(t) {
    var pbn = geruestP(t, T.geruest + 1.6 * G, 0.5 * G, 0.5 * G, 0.3 * G);
    if (pbn <= 0 || !LOGO_SCHRIFT) return;
    var bx = 392, by = G_LAGEN[0] - 58, bb = 216, bh = 58;
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx - 2, by - 4, bb + 4, bh * pbn + 6);
    ctx.clip();
    // Plane mit leichtem Schatten und Ösen
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(bx + 2, by + 3, bb, bh);
    ctx.fillStyle = "#f6f0e6";
    ctx.fillRect(bx, by, bb, bh);
    ctx.fillStyle = "#b5412f";
    ctx.fillRect(bx, by + bh - 6, bb, 6);
    // Logo vollständig
    ctx.save();
    var sc = 40 / 685;
    ctx.translate(bx + 8, by + 6);
    ctx.scale(sc, sc);
    ctx.translate(-55, -45);
    ctx.fillStyle = "#3d3e43";
    ctx.fill(LOGO_SCHRIFT, "evenodd");
    ctx.fillStyle = "#b5412f";
    ctx.fill(LOGO_DACH);
    ctx.restore();
    // Schrift
    // Schrift passend zur Bannerbreite setzen
    function passend(text, gewicht, groesse, x, y, farbe) {
      var frei = bx + bb - 8 - x;
      ctx.font = gewicht + " " + groesse + "px Archivo, sans-serif";
      var w = ctx.measureText(text).width;
      if (w > frei) ctx.font = gewicht + " " + (groesse * frei / w).toFixed(2) + "px Archivo, sans-serif";
      ctx.fillStyle = farbe;
      ctx.fillText(text, x, y);
    }
    ctx.textBaseline = "alphabetic";
    passend("Dachdecker- & Zimmermeister", 700, 10.5, bx + 80, by + 21, "#3d3e43");
    passend("03594 702207", 800, 15, bx + 80, by + 41, "#b5412f");
    // Ösen
    ctx.fillStyle = "#8b9295";
    [6, bb / 2, bb - 6].forEach(function (x) {
      ctx.beginPath(); ctx.arc(bx + x, by + 4, 2, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(bx + x, by + bh - 9, 2, 0, 6.283); ctx.fill();
    });
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
    zeichneSchornstein(t, "oben");
    zeichneRinne(t);
    zeichneBuesche(t);
    zeichneAufzug(t);
    zeichneGeruest(t);
    zeichneLeiter(t);
    zeichneBanner(t);
    zeichneArbeiter(t);
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
