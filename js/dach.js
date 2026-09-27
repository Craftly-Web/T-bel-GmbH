/*
 * Hero-Animation: Ein Dach entsteht.
 * Ablauf: Haus → Dachstuhl und Lattung → Biberschwanzziegel Reihe für Reihe
 *         → Grat- und Firstziegel → Schornstein → Lichtkante.
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

  var T = {
    haus: [0, 0.8],
    sparren: 0.45, sparrenDauer: 0.5, sparrenAbstand: 0.045,
    latten: 1.25, lattenDauer: 0.45, lattenAbstand: 0.045,
    ziegel: 1.9, reihenAbstand: 0.17, spaltenAbstand: 0.014, ziegelDauer: 0.5,
    grat: 5.2, gratAbstand: 0.055, kappeDauer: 0.35,
    first: 5.75, firstAbstand: 0.05,
    schornstein: [6.3, 0.7],
    licht: [6.9, 1.4]
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

  var ENDE = Math.max(T.licht[0] + T.licht[1], T.schornstein[0] + T.schornstein[1]) + 0.1;

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
    // weicher Schatten unter dem Haus
    ctx.save();
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

    // Wand
    var g = ctx.createLinearGradient(0, TRAUFE, 0, BODEN);
    g.addColorStop(0, "#d7cab5");
    g.addColorStop(1, "#e6dccb");
    ctx.fillStyle = g;
    ctx.fillRect(WAND_L, TRAUFE, WAND_R - WAND_L, BODEN - TRAUFE);
    // Sockel
    ctx.fillStyle = "#6f6a68";
    ctx.fillRect(WAND_L, BODEN - 24, WAND_R - WAND_L, 24);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(WAND_L, BODEN - 24, WAND_R - WAND_L, 2);

    // Fenster
    [238, 338, 602, 702].forEach(function (x) { fenster(x, 446, 60, 76); });
    // Tür
    ctx.fillStyle = "#ece4d6";
    ctx.fillRect(466, 478, 68, BODEN - 24 - 478 + 2);
    ctx.fillStyle = "#2c2a2e";
    ctx.fillRect(472, 484, 56, BODEN - 24 - 484);
    ctx.fillStyle = "rgba(160, 190, 200, 0.22)";
    ctx.fillRect(480, 494, 40, 34);
    ctx.fillStyle = "#b0a79a";
    ctx.fillRect(516, 546, 6, 2);
    ctx.fillStyle = "#8a8480";
    ctx.fillRect(460, BODEN - 24, 80, 5);

    // Schatten unter dem Dachüberstand
    var sg = ctx.createLinearGradient(0, TRAUFE, 0, TRAUFE + 46);
    sg.addColorStop(0, "rgba(20, 16, 14, 0.45)");
    sg.addColorStop(1, "rgba(20, 16, 14, 0)");
    ctx.fillStyle = sg;
    ctx.fillRect(WAND_L, TRAUFE, WAND_R - WAND_L, 46);
    ctx.restore();
  }

  function fenster(x, y, b, h) {
    ctx.fillStyle = "#f1ebdf";
    ctx.fillRect(x - 4, y - 4, b + 8, h + 8);
    var g = ctx.createLinearGradient(x, y, x + b, y + h);
    g.addColorStop(0, "#3a4a52");
    g.addColorStop(1, "#23282d");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, b, h);
    ctx.fillStyle = "rgba(210, 230, 240, 0.14)";
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + b * 0.55, y); ctx.lineTo(x, y + h * 0.6); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f1ebdf";
    ctx.fillRect(x + b / 2 - 2, y, 4, h);
    ctx.fillRect(x, y + h * 0.42, b, 3);
    ctx.fillStyle = "#b9ad9a";
    ctx.fillRect(x - 8, y + h + 4, b + 16, 5);
  }

  function zeichneDachstuhl(t) {
    var holz = "#c99a5e";
    ctx.save();
    dachPfad(ctx);
    ctx.clip();

    // Sparren wachsen von der Traufe nach oben
    ctx.lineCap = "butt";
    sparren.forEach(function (s) {
      var p = ausCubic(fortschritt(t, s.start, T.sparrenDauer));
      if (p <= 0) return;
      var unten = TRAUFE + UEBERSTAND;
      ctx.fillStyle = holz;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(s.x - 3.5, unten - (unten - s.oben) * p, 7, (unten - s.oben) * p);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(s.x + 2, unten - (unten - s.oben) * p, 1.5, (unten - s.oben) * p);
    });
    ctx.globalAlpha = 1;

    // Dachlatten von links nach rechts
    reihen.forEach(function (r) {
      var p = ausCubic(fortschritt(t, r.start, T.lattenDauer));
      if (p <= 0) return;
      ctx.fillStyle = "#b8894f";
      ctx.fillRect(r.l - 4, r.y - 2, (r.r - r.l + 8) * p, 4);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(r.l - 4, r.y + 1.5, (r.r - r.l + 8) * p, 1);
    });
    ctx.restore();

    // Grat- und Firstbalken als Linie
    var pg = ausCubic(fortschritt(t, 0.9, 0.7));
    if (pg > 0) {
      ctx.save();
      ctx.strokeStyle = holz;
      ctx.lineWidth = 6;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      var u = TRAUFE + UEBERSTAND;
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
      ctx.restore();
    }
  }

  function zeichneMasse(t) {
    // Bemaßung wie auf dem Plan, blendet nach dem Eindecken ab
    var ein = ausCubic(fortschritt(t, 0.5, 0.8));
    var aus = fortschritt(t, 5.6, 1.2);
    var a = ein * (1 - aus * 0.75);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a * 0.55;
    ctx.strokeStyle = "#f6f0e6";
    ctx.fillStyle = "#f6f0e6";
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
    // Hilfslinien
    ctx.globalAlpha = a * 0.25;
    ctx.beginPath();
    ctx.moveTo(FIRST_L, FIRST); ctx.lineTo(FIRST_L, y - 10);
    ctx.moveTo(FIRST_R, FIRST); ctx.lineTo(FIRST_R, y - 10);
    ctx.moveTo(FIRST_R + 10, FIRST); ctx.lineTo(TRAUFE_R + 46, FIRST);
    ctx.moveTo(TRAUFE_R + 10, TRAUFE + UEBERSTAND); ctx.lineTo(TRAUFE_R + 46, TRAUFE + UEBERSTAND);
    ctx.stroke();
    // Neigungsbogen an der Traufe
    ctx.globalAlpha = a * 0.5;
    ctx.beginPath();
    var w = Math.atan2(TRAUFE + UEBERSTAND - FIRST, FIRST_L - TRAUFE_L);
    ctx.arc(TRAUFE_L, TRAUFE + UEBERSTAND, 58, -w, 0);
    ctx.stroke();
    ctx.restore();
  }

  function zeichneRinne(t) {
    var p = ausCubic(fortschritt(t, 1.0, 0.6));
    if (p <= 0) return;
    ctx.save();
    ctx.globalAlpha = p;
    var y = TRAUFE + UEBERSTAND - 1;
    var l = TRAUFE_L - 8, r = TRAUFE_R + 8;
    var g = ctx.createLinearGradient(0, y, 0, y + 11);
    g.addColorStop(0, "#9aa5a6");
    g.addColorStop(0.4, "#7b8788");
    g.addColorStop(1, "#4f5859");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(l, y);
    ctx.lineTo(r, y);
    ctx.lineTo(r, y + 5);
    ctx.quadraticCurveTo(r, y + 11, r - 6, y + 11);
    ctx.lineTo(l + 6, y + 11);
    ctx.quadraticCurveTo(l, y + 11, l, y + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(l, y, r - l, 1.2);
    // Fallrohr
    var fx = WAND_R - 26;
    var pr = ausCubic(fortschritt(t, 1.3, 0.6));
    var gr = ctx.createLinearGradient(fx - 5, 0, fx + 5, 0);
    gr.addColorStop(0, "#5e6869");
    gr.addColorStop(0.4, "#98a3a4");
    gr.addColorStop(1, "#4f5859");
    ctx.fillStyle = gr;
    ctx.fillRect(fx - 5, y + 10, 10, (BODEN - 12 - y) * pr);
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

  function zeichneSchornstein(t) {
    var p = ausCubic(fortschritt(t, T.schornstein[0], T.schornstein[1]));
    if (p <= 0) return;
    var l = 404, r = 442, fuss = 262, kopf = 112;
    var oben = fuss - (fuss - kopf) * p;
    ctx.save();
    ctx.beginPath();
    ctx.rect(l - 10, 0, r - l + 20, fuss);
    ctx.clip();
    // Mauerwerk
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
    // Abdeckung
    if (p > 0.85) {
      var a = (p - 0.85) / 0.15;
      ctx.globalAlpha = a;
      ctx.fillStyle = "#3b3c41";
      ctx.fillRect(l - 6, oben - 7, r - l + 12, 8);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(l - 6, oben - 7, r - l + 12, 1.2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // Verwahrung aus Zink am Fuß
    ctx.fillStyle = "#86918f";
    ctx.fillRect(l - 6, fuss - 8, r - l + 12, 9);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(l - 6, fuss - 8, r - l + 12, 1.2);
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
    zeichneDachstuhl(t);
    zeichneZiegel(t);
    zeichneKappen(t);
    zeichneRinne(t);
    zeichneSchornstein(t);
    zeichneLicht(t);
  }

  /* ---------- Ablauf ---------- */

  var zeit = ruhig ? ENDE : 0;
  var zuletzt = null;
  var laeuft = false;

  function schritt(jetzt) {
    if (zuletzt !== null) zeit += Math.min((jetzt - zuletzt) / 1000, 0.05);
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
