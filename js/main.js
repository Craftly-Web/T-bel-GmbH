(function () {
  "use strict";

  // Mobiles Menü
  var knopf = document.querySelector(".menue-knopf");
  var nav = document.getElementById("nav");
  if (knopf && nav) {
    var setzen = function (offen) {
      document.body.classList.toggle("menue-offen", offen);
      knopf.setAttribute("aria-expanded", String(offen));
    };
    knopf.addEventListener("click", function () {
      setzen(!document.body.classList.contains("menue-offen"));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setzen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setzen(false);
    });
  }

  // Anfrageformular: ohne JavaScript schickt der Browser klassisch ab und
  // die Funktion leitet weiter; mit JavaScript bleibt man auf der Seite.
  document.querySelectorAll("form[data-anfrage]").forEach(function (form) {
    var status = form.querySelector("[data-status]");
    var ts = form.querySelector("[data-ts]");
    if (ts) ts.value = String(Date.now());

    function zeigen(meldungen) {
      if (!status) return;
      status.hidden = false;
      status.textContent = "";
      if (meldungen.length === 1) {
        status.textContent = meldungen[0];
      } else {
        var ul = document.createElement("ul");
        meldungen.forEach(function (m) {
          var li = document.createElement("li");
          li.textContent = m;
          ul.appendChild(li);
        });
        status.appendChild(ul);
      }
      status.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    // Rückmeldung nach klassischem Absenden (?fehler=…); als Text gesetzt, nie als HTML
    var fehler = new URLSearchParams(window.location.search).get("fehler");
    if (fehler && status) {
      zeigen([fehler]);
      history.replaceState(null, "", window.location.pathname + "#anfrage");
    }

    function pruefen() {
      var f = form.elements, m = [];
      var mail = f.email ? f.email.value.trim() : "";
      var tel = f.telefon ? f.telefon.value.trim() : "";
      if (!f.name.value.trim()) m.push("Bitte geben Sie Ihren Namen an.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail) && (tel.match(/\d/g) || []).length < 6) {
        m.push("Bitte geben Sie eine Telefonnummer oder eine gültige E-Mail-Adresse an.");
      }
      if (f.nachricht.value.trim().length < 10) m.push("Bitte beschreiben Sie Ihr Anliegen in ein paar Worten.");
      if (!f.datenschutz.checked) m.push("Bitte bestätigen Sie die Datenschutzhinweise.");
      return m;
    }

    form.addEventListener("submit", function (e) {
      var m = pruefen();
      if (m.length) { e.preventDefault(); zeigen(m); return; }
      if (!window.fetch || !window.FormData) return;
      e.preventDefault();

      var knopf = form.querySelector('button[type="submit"]');
      if (knopf) knopf.disabled = true;
      var fd = new FormData(form);
      var daten = {};
      fd.forEach(function (wert, schluessel) {
        if (schluessel === "anliegen") (daten.anliegen = daten.anliegen || []).push(wert);
        else daten[schluessel] = wert;
      });

      fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(daten)
      })
        .then(function (res) { return res.json().catch(function () { return { ok: false }; }); })
        .then(function (antwort) {
          if (antwort.ok) { window.location.href = "danke.html"; return; }
          zeigen(antwort.fehler || ["Die Nachricht konnte nicht gesendet werden. Bitte rufen Sie uns an: 03594 702207."]);
        })
        .catch(function () {
          zeigen(["Die Nachricht konnte nicht gesendet werden. Bitte rufen Sie uns an: 03594 702207."]);
        })
        .then(function () { if (knopf) knopf.disabled = false; });
    });
  });

  // Referenzen: Großansicht mit Blättern innerhalb einer Kategorie
  var lightbox = document.querySelector("[data-lightbox]");
  if (lightbox && lightbox.showModal) {
    var lbBild = lightbox.querySelector("img");
    var lbText = lightbox.querySelector("figcaption");
    var liste = [], stelle = 0, ausloeser = null;

    var zeigeBild = function (i) {
      stelle = (i + liste.length) % liste.length;
      var k = liste[stelle];
      lbBild.src = k.getAttribute("data-gross");
      lbBild.alt = k.getAttribute("data-titel") || "";
      lbText.textContent = "";
      var b = document.createElement("b");
      b.textContent = (stelle + 1) + " / " + liste.length;
      lbText.appendChild(b);
      lbText.appendChild(document.createTextNode(k.getAttribute("data-titel") || ""));
      var mehrere = liste.length > 1;
      lightbox.querySelector("[data-zurueck]").hidden = !mehrere;
      lightbox.querySelector("[data-vor]").hidden = !mehrere;
    };

    document.querySelectorAll("[data-galerie] button").forEach(function (k) {
      k.addEventListener("click", function () {
        liste = Array.prototype.slice.call(k.closest("[data-galerie]").querySelectorAll("button"));
        ausloeser = k;
        zeigeBild(liste.indexOf(k));
        lightbox.showModal();
      });
    });
    lightbox.querySelector("[data-zu]").addEventListener("click", function () { lightbox.close(); });
    lightbox.querySelector("[data-zurueck]").addEventListener("click", function () { zeigeBild(stelle - 1); });
    lightbox.querySelector("[data-vor]").addEventListener("click", function () { zeigeBild(stelle + 1); });
    lightbox.addEventListener("click", function (e) { if (e.target === lightbox) lightbox.close(); });
    lightbox.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") zeigeBild(stelle - 1);
      if (e.key === "ArrowRight") zeigeBild(stelle + 1);
    });
    lightbox.addEventListener("close", function () { if (ausloeser) ausloeser.focus(); });
  }

  // Referenzen: aktive Kategorie in der Leiste markieren
  var chips = document.querySelectorAll(".kategorien a");
  if (chips.length && "IntersectionObserver" in window) {
    var markieren = function (id) {
      chips.forEach(function (c) {
        var aktiv = c.getAttribute("href") === "#" + id;
        c.classList.toggle("aktiv", aktiv);
        if (aktiv && c.scrollIntoView) {
          var leiste = c.parentNode;
          leiste.scrollTo({ left: c.offsetLeft - leiste.clientWidth / 2 + c.clientWidth / 2, behavior: "smooth" });
        }
      });
    };
    var sichtbereich = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) { if (e.isIntersecting) markieren(e.target.id); });
    }, { rootMargin: "-160px 0px -60% 0px" });
    document.querySelectorAll("[data-bereich]").forEach(function (b) { sichtbereich.observe(b); });
  }

  // Abschnitte beim Scrollen einblenden
  var elemente = document.querySelectorAll(".einblenden");
  if (!("IntersectionObserver" in window)) {
    elemente.forEach(function (el) { el.classList.add("sichtbar"); });
    return;
  }
  var beobachter = new IntersectionObserver(function (eintraege) {
    eintraege.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add("sichtbar");
        beobachter.unobserve(e.target);
      }
    });
  }, { rootMargin: "0px 0px -10% 0px" });
  elemente.forEach(function (el) { beobachter.observe(el); });
})();
