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
