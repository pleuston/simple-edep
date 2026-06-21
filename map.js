/* map.js — Geodata: clustered map of geolocated inscriptions + Roman province
 * boundaries overlay. Reads the merged collection index (local + EDH). */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var map = L.map("map", { scrollWheelZoom: true, worldCopyJump: true, preferCanvas: true }).setView([43, 13], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · data: <a href="https://edh.ub.uni-heidelberg.de/">EDH</a> (CC BY-SA)'
    }).addTo(map);

    // province boundaries overlay (toggleable)
    EpiCollections.getJSON(EpiCollections.get("edh").provinces).then(function (geo) {
      if (!geo || !geo.features) return;
      var prov = L.geoJSON(geo, {
        style: { color: "#cc0000", weight: 1, fillColor: "#cc0000", fillOpacity: 0.04 },
        onEachFeature: function (f, l) { if (f.properties && f.properties.province) l.bindTooltip(f.properties.province, { sticky: true }); }
      });
      L.control.layers(null, { "Roman provinces": prov }, { collapsed: false }).addTo(map);
    });

    EpiCollections.loadCatalog().then(function (idx) {
      var spots = (idx || []).filter(function (e) { return e.lat !== "" && e.lng !== "" && !isNaN(+e.lat) && !isNaN(+e.lng); });
      var cluster = (typeof L.markerClusterGroup === "function")
        ? L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 45, removeOutsideVisibleBounds: true })
        : null;
      var layer = cluster || map;
      var bounds = [];
      spots.forEach(function (e) {
        var lat = +e.lat, lng = +e.lng;
        var m = L.marker([lat, lng]);
        m.bindPopup(function () {
          var id = e.file.replace(/\.xml$/, ""), col = e.col || "edh";
          return "<strong>" + esc(e.titleEn || id) + "</strong>" +
            (e.settlement ? "<br>" + esc(e.settlement) : "") + (e.date ? " · " + esc(e.date) : "") +
            '<br><a href="viewer.html?id=' + encodeURIComponent(id) + "&col=" + encodeURIComponent(col) + '">Read →</a>';
        });
        m.addTo(layer);
        bounds.push([lat, lng]);
      });
      if (cluster) map.addLayer(cluster);

      var c = document.getElementById("map-count");
      if (c) c.textContent = spots.length.toLocaleString() + " geolocated inscriptions";

      function refit() { map.invalidateSize(); }
      if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
      refit(); setTimeout(refit, 60); setTimeout(refit, 400);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
      window.addEventListener("resize", refit);
    });
  });
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
})();
