/* panel.js — shared right-side reading panel. RecordPanel.open(id, col, opts)
 * renders an inscription (reading + IIIF image + small find-spot map) via
 * RecordView into the #rec-panel drawer; reused by the catalogue and the people
 * register so a record "resolves" in place instead of navigating away. */
(function () {
  "use strict";
  function el(id) { return document.getElementById(id); }
  var wired = false;
  function wire() {
    if (wired) return;
    var c = el("rp-close"); if (!c) return;
    c.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    wired = true;
  }
  document.addEventListener("DOMContentLoaded", wire);

  function open(id, col, opts) {
    opts = opts || {}; wire();
    var panel = el("rec-panel"); if (!panel || !window.RecordView) return;
    var tb = document.querySelector(".topbar");
    panel.style.top = (tb ? tb.offsetHeight : 56) + "px";
    var label = col === "edh" ? " · EDH" : col === "isic" ? " · I.Sicily" : "";
    el("rp-id").textContent = id + label;
    var favEl = el("rp-fav");
    if (favEl && window.EpiFav) {
      favEl.innerHTML = EpiFav.button({ id: id, col: col, title: opts.title || id, place: opts.place || "", date: opts.date || "" });
    }
    var q = "id=" + encodeURIComponent(id) + "&col=" + encodeURIComponent(col) +
      (opts.lat != null && opts.lat !== "" && opts.lng != null && opts.lng !== "" ? "&lat=" + opts.lat + "&lng=" + opts.lng : "");
    el("rp-full").href = "viewer.html?" + q;
    panel.classList.add("open"); panel.setAttribute("aria-hidden", "false");
    document.body.classList.add("rp-open");
    RecordView.load({
      id: id, col: col,
      reading: el("rp-reading"), imageHost: el("rp-image"),
      thumbs: el("rp-thumbs"), credit: el("rp-credit"), map: el("rp-map"),
      lat: opts.lat, lng: opts.lng
    });
  }
  function close() {
    var panel = el("rec-panel"); if (!panel) return;
    panel.classList.remove("open"); panel.setAttribute("aria-hidden", "true");
    document.body.classList.remove("rp-open");
    if (window.RecordView && RecordView.clearMap) RecordView.clearMap();
    Array.prototype.forEach.call(document.querySelectorAll(".catalog-item.selected"), function (x) { x.classList.remove("selected"); });
  }
  window.RecordPanel = { open: open, close: close };
})();
