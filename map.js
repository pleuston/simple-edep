/* map.js — plot inscription find spots from data/records-index.json on Leaflet. */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var map = L.map("map", { scrollWheelZoom: true }).setView([46, 8], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    fetch("data/records-index.json").then(function (r) { return r.ok ? r.json() : []; })
      .then(function (idx) {
        var markers = [], pts = [];
        (idx || []).forEach(function (e) {
          var lat = parseFloat(e.lat), lng = parseFloat(e.lng);
          if (isNaN(lat) || isNaN(lng)) return;
          var id = e.file.replace(/\.xml$/, "");
          var popup = '<strong>' + esc(e.titleEn || id) + "</strong><br>" +
            esc([e.settlement, e.date].filter(Boolean).join(" · ")) +
            (e.textType ? "<br><em>" + esc(e.textType) + "</em>" : "") +
            '<br><a href="viewer.html?id=' + encodeURIComponent(id) + '">Read →</a>';
          var m = L.marker([lat, lng]).bindPopup(popup);
          markers.push(m); pts.push([lat, lng]);
          m.addTo(map);
        });
        var c = document.getElementById("map-count");
        if (c) c.textContent = pts.length + (pts.length === 1 ? " find spot" : " find spots");

        // The container is sized after layout + web-font load; Leaflet must be
        // told to recompute its size or it loads only one tile and mis-places
        // markers (the "0×0 at init" race).
        function refit() {
          map.invalidateSize();
          if (pts.length) map.fitBounds(pts, { padding: [50, 50], maxZoom: 7 });
        }
        refit();
        setTimeout(refit, 60);
        setTimeout(refit, 400);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
        window.addEventListener("resize", function () { map.invalidateSize(); });
      })
      .catch(function () {});
  });
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
})();
