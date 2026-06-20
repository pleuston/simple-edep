/* map.js — Geodata: plot geolocated inscriptions on a clustered Leaflet map.
 * Coordinates come from data/records-index.json (joined from the EDH find-spot
 * gazetteer at build time). Clustering keeps thousands of points usable. */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var map = L.map("map", { scrollWheelZoom: true, worldCopyJump: true }).setView([43, 13], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · data: <a href="https://edh.ub.uni-heidelberg.de/">EDH</a> (CC BY-SA)'
    }).addTo(map);

    fetch("data/records-index.json").then(function (r) { return r.ok ? r.json() : []; })
      .then(function (idx) {
        var spots = (idx || []).filter(function (e) {
          return e.lat !== "" && e.lng !== "" && !isNaN(+e.lat) && !isNaN(+e.lng);
        });
        var cluster = (typeof L.markerClusterGroup === "function")
          ? L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 45, spiderfyOnMaxZoom: true })
          : null;
        var layer = cluster || map;
        var pts = [];
        spots.forEach(function (e) {
          var lat = +e.lat, lng = +e.lng, id = e.file.replace(/\.xml$/, "");
          var popup = "<strong>" + esc(e.titleEn || id) + "</strong>" +
            (e.settlement ? "<br>" + esc(e.settlement) : "") + (e.date ? " · " + esc(e.date) : "") +
            '<br><a href="viewer.html?id=' + encodeURIComponent(id) + '">Read →</a>';
          L.marker([lat, lng]).bindPopup(popup).addTo(layer);
          pts.push([lat, lng]);
        });
        if (cluster) map.addLayer(cluster);

        var c = document.getElementById("map-count");
        if (c) c.textContent = spots.length.toLocaleString() + " geolocated inscriptions";

        function refit() { map.invalidateSize(); }
        if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 6 });
        refit(); setTimeout(refit, 60); setTimeout(refit, 400);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
        window.addEventListener("resize", refit);
      })
      .catch(function () {});
  });
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
})();
