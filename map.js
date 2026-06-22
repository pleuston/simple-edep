/* map.js — Geodata: find-spot browser + clustered inscription map.
 * Layout: [filter sidebar | find-spots list | leaflet map] */
(function () {
  "use strict";
  var ALL = [], FILTERED = [], PAGE = 0, PER = 40;
  var GEO = [], GEO_FILT = [], GEO_PAGE = 0, GEO_PER = 40;
  var GEO_DETAIL = false; // true while showing a place detail view
  var map, cluster, activeMarker;
  var markerMap = {}; // file -> L.marker

  var fSearch, fProvince, fCountry, fTextType, fFrom, fTo, listEl, pagerEl;

  document.addEventListener("DOMContentLoaded", function () {
    fSearch   = document.getElementById("m-search");
    fProvince = document.getElementById("m-province");
    fCountry  = document.getElementById("m-country");
    fTextType = document.getElementById("m-textType");
    fFrom     = document.getElementById("m-from");
    fTo       = document.getElementById("m-to");
    listEl    = document.getElementById("m-list");
    pagerEl   = document.getElementById("m-pager");

    // --- Leaflet map ---
    map = L.map("map", { scrollWheelZoom: true, worldCopyJump: true, preferCanvas: true }).setView([43, 13], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · data: <a href="https://edh.ub.uni-heidelberg.de/">EDH</a> (CC BY-SA)'
    }).addTo(map);

    EpiCollections.getJSON(EpiCollections.get("edh").provinces).then(function (geo) {
      if (!geo || !geo.features) return;
      var prov = L.geoJSON(geo, {
        style: { color: "#cc0000", weight: 1, fillColor: "#cc0000", fillOpacity: 0.04 },
        onEachFeature: function (f, l) { if (f.properties && f.properties.province) l.bindTooltip(f.properties.province, { sticky: true }); }
      });
      L.control.layers(null, { "Roman provinces": prov }, { collapsed: false }).addTo(map);
    });

    // --- filter events ---
    // search filters the find-spots list; province/country/type/date filter the map markers
    var dt;
    fSearch.addEventListener("input", function () { clearTimeout(dt); dt = setTimeout(function () { GEO_PAGE = 0; filterGeo(); }, 200); });
    fProvince.addEventListener("change", applyFilters);
    fCountry.addEventListener("change", applyFilters);
    fTextType.addEventListener("change", applyFilters);
    fFrom.addEventListener("change", applyFilters);
    fTo.addEventListener("change", applyFilters);
    document.getElementById("m-reset").addEventListener("click", function () {
      fSearch.value = ""; fProvince.value = ""; fCountry.value = ""; fTextType.value = "";
      fFrom.value = ""; fTo.value = "";
      applyFilters();
    });

    // --- list click (always in find-spots mode) ---
    listEl.addEventListener("click", function (ev) {
      var geoRow = ev.target.closest && ev.target.closest(".geo-entry");
      if (geoRow && !ev.target.closest("a")) {
        var gid  = geoRow.getAttribute("data-gid");
        var glat = parseFloat(geoRow.getAttribute("data-lat"));
        var glng = parseFloat(geoRow.getAttribute("data-lng"));
        var gObj = null;
        if (gid) { for (var gi = 0; gi < GEO.length; gi++) { if (GEO[gi].id === gid) { gObj = GEO[gi]; break; } } }
        if (!gObj && !isNaN(glat) && !isNaN(glng)) {
          for (var gi = 0; gi < GEO.length; gi++) {
            if (Math.abs(GEO[gi].lat - glat) < 0.001 && Math.abs(GEO[gi].lng - glng) < 0.001) { gObj = GEO[gi]; break; }
          }
        }
        if (!gObj) {
          var nameEl = geoRow.querySelector(".geo-name");
          gObj = { id: gid, lat: glat, lng: glng, name: nameEl ? nameEl.textContent.trim() : "", modern: "", province: "", country: "", pleiades: "", tm: "" };
        }
        if (!isNaN(gObj.lat) && !isNaN(gObj.lng)) map.setView([gObj.lat, gObj.lng], 10);
        GEO_DETAIL = true;
        showInscriptionsForPlace(gObj);
      }
    });

    // --- load data: inscription index → map markers; geo.json → center list ---
    // always use the EDH index only — geo.json, G-IDs and province data are EDH-specific
    EpiCollections.loadIndex("edh").then(function (idx) {
      ALL = (idx || []).filter(function (e) {
        return e.lat !== "" && e.lng !== "" && !isNaN(+e.lat) && !isNaN(+e.lng);
      });
      populateFilters();
      buildAllMarkers();
      applyFilters();
    }).catch(function () { /* map stays empty */ });

    loadGeo();
  });

  // ---------------------------------------------------------------------------
  // Find-spots tab (geo.json)
  function loadGeo() {
    listEl.innerHTML = '<div class="catalog-loading">Loading find spots…</div>';
    EpiCollections.getJSON(EpiCollections.get("edh").geo).then(function (g) {
      GEO = (g || []).filter(function (x) { return x.name; })
                     .sort(function (a, b) { return a.name.localeCompare(b.name); });
      filterGeo();
    }).catch(function () {
      listEl.innerHTML = '<div class="catalog-empty">Could not load find spots.</div>';
    });
  }

  function filterGeo() {
    var q = (fSearch.value || "").toLowerCase().trim();
    var prov = fProvince.value, cty = fCountry.value, tt = fTextType.value;
    var hasInscFilter = prov || cty || tt || fFrom.value || fTo.value;

    // build fast-lookup sets from the already-filtered inscription set
    var filtGeoIds = {}, filtCoords = {};
    if (hasInscFilter) {
      FILTERED.forEach(function (e) {
        if (e.geo_id) filtGeoIds[e.geo_id] = true;
        if (e.lat && e.lng) {
          var k = Math.round(+e.lat * 100) / 100 + "," + Math.round(+e.lng * 100) / 100;
          filtCoords[k] = true;
        }
      });
    }

    GEO_FILT = GEO.filter(function (g) {
      if (q && (g.name || "").toLowerCase().indexOf(q) === -1 &&
               (g.modern || "").toLowerCase().indexOf(q) === -1) return false;
      if (hasInscFilter) {
        if (g.id && filtGeoIds[g.id]) return true;
        var gk = Math.round(g.lat * 100) / 100 + "," + Math.round(g.lng * 100) / 100;
        return !!filtCoords[gk];
      }
      return true;
    });
    GEO_PAGE = 0;
    if (!GEO_DETAIL) renderGeoList();
  }

  function renderGeoList() {
    var total = GEO_FILT.length, pages = Math.max(1, Math.ceil(total / GEO_PER));
    if (GEO_PAGE >= pages) GEO_PAGE = 0;
    if (!total) { listEl.innerHTML = '<div class="catalog-empty">No find spots match.</div>'; pagerEl.innerHTML = ""; return; }
    listEl.innerHTML = GEO_FILT.slice(GEO_PAGE * GEO_PER, GEO_PAGE * GEO_PER + GEO_PER).map(geoEntryHtml).join("");
    renderGeoPager(total, pages);
  }

  function geoEntryHtml(g) {
    var meta = [g.modern && g.modern !== g.name ? g.modern : "", g.province, g.country].filter(Boolean).join(" · ");
    var links = "";
    if (g.pleiades) links += '<a class="catalog-tag" href="' + esc(g.pleiades) + '" target="_blank" rel="noopener">Pleiades</a>';
    if (g.tm)       links += '<a class="catalog-tag" href="' + esc(g.tm)       + '" target="_blank" rel="noopener">TM</a>';
    return '<div class="geo-entry" data-gid="' + esc(g.id || "") + '" data-lat="' + g.lat + '" data-lng="' + g.lng + '">' +
      '<div class="geo-entry-body">' +
        '<span class="geo-name">' + esc(g.name) + (g.id ? ' <span class="catalog-tag geo-gid">' + esc(g.id) + '</span>' : '') + '</span>' +
        (meta ? '<span class="geo-meta">' + esc(meta) + '</span>' : '') +
      '</div>' +
      (links ? '<span class="geo-links">' + links + '</span>' : '') +
      '</div>';
  }

  function showInscriptionsForPlace(g) {
    // only filter by G-ID when non-empty, to avoid matching all entries with no geo_id
    var matches = g.id ? ALL.filter(function (e) { return e.geo_id === g.id; }) : [];
    if (!matches.length && !isNaN(g.lat) && !isNaN(g.lng)) {
      var THRESH = 0.01;
      matches = ALL.filter(function (e) {
        return e.lat && e.lng && Math.abs(+e.lat - g.lat) < THRESH && Math.abs(+e.lng - g.lng) < THRESH;
      });
    }
    FILTERED = matches; PAGE = 0;
    updateMapMarkers();

    // place detail card
    var fields = [];
    if (g.modern && g.modern !== g.name)  fields.push(["Modern name",  g.modern]);
    if (g.province)                        fields.push(["Province",     g.province]);
    if (g.country)                         fields.push(["Country",      g.country]);
    if (g.id)                              fields.push(["G-ID",         g.id]);
    if (!isNaN(g.lat) && !isNaN(g.lng))   fields.push(["Coordinates",  g.lat + ", " + g.lng]);
    var detailDl = fields.length
      ? '<dl class="geo-detail-dl">' + fields.map(function (f) {
          return '<dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd>';
        }).join("") + '</dl>'
      : '';
    var extLinks = [];
    if (g.pleiades) extLinks.push('<a class="btn small" href="' + esc(g.pleiades) + '" target="_blank" rel="noopener">Pleiades ↗</a>');
    if (g.tm)       extLinks.push('<a class="btn small" href="' + esc(g.tm)       + '" target="_blank" rel="noopener">Trismegistos ↗</a>');
    var detailLinks = extLinks.length ? '<div class="geo-detail-links">' + extLinks.join(" ") + '</div>' : '';

    // inscription list
    var CAP = 50;
    var shown = matches.slice(0, CAP);
    var more = matches.length > CAP ? matches.length - CAP : 0;
    var inscHtml = matches.length
      ? '<div class="geo-inscr-head">' + matches.length + ' inscription' + (matches.length !== 1 ? 's' : '') + '</div>' +
        shown.map(entryHtml).join("") +
        (more ? '<div class="geo-place-more">' + more + ' more — zoom into the map to explore</div>' : '')
      : '<div class="catalog-empty">No inscriptions linked to this site.</div>';

    listEl.innerHTML =
      '<div class="geo-place-head">' +
        '<button class="geo-back-btn" id="geo-back">← Find spots</button>' +
      '</div>' +
      '<div class="geo-detail-card">' +
        '<h2 class="geo-detail-name">' + esc(g.name) + '</h2>' +
        detailDl + detailLinks +
      '</div>' +
      inscHtml;

    document.getElementById("geo-back").addEventListener("click", function () {
      GEO_DETAIL = false;
      FILTERED = ALL; updateMapMarkers();
      filterGeo();
    });
  }

  function renderGeoPager(total, pages) {
    function btn(pg, label, on, dis) {
      return '<button data-gpg="' + pg + '"' + (on ? ' class="on"' : "") + (dis ? " disabled" : "") + ">" + label + "</button>";
    }
    var html = "";
    if (pages > 1) {
      html += btn("first", "|&lt;", false, GEO_PAGE === 0) + btn(Math.max(0, GEO_PAGE - 1), "&lt;", false, GEO_PAGE === 0);
      var start = Math.max(0, GEO_PAGE - 2), end = Math.min(pages - 1, GEO_PAGE + 2);
      if (start > 0) html += '<span class="reg-ell">…</span>';
      for (var i = start; i <= end; i++) html += btn(i, i + 1, i === GEO_PAGE, false);
      if (end < pages - 1) html += '<span class="reg-ell">…</span>';
      html += btn(Math.min(pages - 1, GEO_PAGE + 1), "&gt;", false, GEO_PAGE === pages - 1) + btn("last", "&gt;|", false, GEO_PAGE === pages - 1);
    }
    html += '<span class="register-count">' + (pages > 1 ? "Page " + (GEO_PAGE + 1) + " / " + pages + " · " : "") + total.toLocaleString() + " sites</span>";
    pagerEl.innerHTML = html;
    Array.prototype.forEach.call(pagerEl.querySelectorAll("button[data-gpg]"), function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-gpg");
        GEO_PAGE = v === "first" ? 0 : v === "last" ? pages - 1 : parseInt(v, 10);
        renderGeoList(); listEl.parentElement.scrollTop = 0;
      });
    });
  }

  // ---------------------------------------------------------------------------
  function populateFilters() {
    var provinces = {}, countries = {}, textTypes = {};
    ALL.forEach(function (e) {
      if (e.region)    provinces[e.region]    = true;
      if (e.country)   countries[e.country]   = true;
      if (e.textType)  textTypes[e.textType]  = true;
    });
    fill(fProvince, Object.keys(provinces).sort());
    fill(fCountry,  Object.keys(countries).sort());
    fill(fTextType, Object.keys(textTypes).sort());
  }

  function fill(sel, vals) {
    vals.forEach(function (v) {
      var o = document.createElement("option"); o.value = v; o.textContent = v; sel.appendChild(o);
    });
  }

  // ---------------------------------------------------------------------------
  function buildAllMarkers() {
    cluster = (typeof L.markerClusterGroup === "function")
      ? L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 45, removeOutsideVisibleBounds: true })
      : null;
    markerMap = {};
    ALL.forEach(function (e) {
      var lat = +e.lat, lng = +e.lng;
      var m = L.marker([lat, lng]);
      var id = (e.file || "").replace(/\.xml$/, ""), col = e.col || "edh";
      m.bindPopup(function () {
        var q = "id=" + encodeURIComponent(id) + "&col=" + encodeURIComponent(col);
        var editBtn = (window.EpiAuth && EpiAuth.isSignedIn())
          ? ' <a class="btn small" href="editor.html?' + q + '">Edit</a>' : "";
        return "<strong>" + esc(e.titleEn || id) + "</strong>" +
          (e.settlement ? "<br>" + esc(e.settlement) : "") +
          (e.date ? " · " + esc(e.date) : "") +
          '<br><a href="viewer.html?' + q + '">Read →</a>' + editBtn;
      });
      markerMap[id] = m;
      if (cluster) cluster.addLayer(m); else m.addTo(map);
    });
    if (cluster) map.addLayer(cluster);
  }

  // ---------------------------------------------------------------------------
  function applyFilters() {
    var prov = fProvince.value, cty = fCountry.value, tt = fTextType.value;
    var from = fFrom.value ? +fFrom.value : null, to = fTo.value ? +fTo.value : null;

    FILTERED = ALL.filter(function (e) {
      if (prov && e.region !== prov) return false;
      if (cty  && e.country !== cty) return false;
      if (tt   && e.textType !== tt) return false;
      if (from !== null || to !== null) {
        var yr = dateYear(e.date);
        if (yr === null) return false;
        if (from !== null && yr < from) return false;
        if (to   !== null && yr > to)   return false;
      }
      return true;
    });

    updateMapMarkers();
    // when inscription filters change, leave detail view and refresh the geo list
    GEO_DETAIL = false;
    filterGeo();
  }

  function dateYear(d) {
    if (!d) return null;
    var m = d.match(/(-?\d{1,4})/);
    return m ? parseInt(m[1], 10) : null;
  }

  // ---------------------------------------------------------------------------
  function updateMapMarkers() {
    if (!cluster) return;
    var filteredSet = {};
    FILTERED.forEach(function (e) { filteredSet[(e.file || "").replace(/\.xml$/, "")] = true; });
    cluster.clearLayers();
    ALL.forEach(function (e) {
      var id = (e.file || "").replace(/\.xml$/, "");
      if (filteredSet[id] && markerMap[id]) cluster.addLayer(markerMap[id]);
    });
    if (FILTERED.length && FILTERED.length < ALL.length) {
      var bounds = FILTERED.map(function (e) { return [+e.lat, +e.lng]; });
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
    }
    setTimeout(function () { map.invalidateSize(); }, 60);
  }

  // entryHtml used by showInscriptionsForPlace to render place-specific inscription list
  function entryHtml(e) {
    var id = (e.file || "").replace(/\.xml$/, ""), col = e.col || "edh";
    var q = "id=" + encodeURIComponent(id) + "&col=" + encodeURIComponent(col);
    var meta = [e.settlement, e.region, e.date].filter(Boolean).join(" · ");
    var editBtn = (window.EpiAuth && EpiAuth.isSignedIn())
      ? '<a class="btn small" href="editor.html?' + q + '">Edit</a>' : "";
    return '<div class="map-entry catalog-item" data-file="' + esc(id) + '" data-col="' + esc(col) + '">' +
      '<div class="catalog-monument"><div class="catalog-info">' +
      '<span class="catalog-filename">' + esc(id) + '</span>' +
      '<div class="catalog-title"><a href="viewer.html?' + q + '">' + esc(e.titleEn || id) + '</a></div>' +
      (meta ? '<span class="catalog-meta">' + esc(meta) + '</span>' : '') +
      '</div><div class="catalog-actions">' +
      '<a class="btn small" href="viewer.html?' + q + '">View</a>' + editBtn +
      '</div></div></div>';
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
