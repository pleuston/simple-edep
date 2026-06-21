/* collections.js — registry of data collections the app reads.
 *
 * The EDH collection lives in a separate public repo (pleuston/simple-edep-edh)
 * and is served via jsDelivr (CORS-enabled CDN, gzip, no Pages build). The base
 * can be overridden for local testing via localStorage "edep_edh_base"
 * (e.g. "_edhdata", a symlink served same-origin by the dev server).
 *
 * Exposes window.EpiCollections.
 */
(function () {
  "use strict";
  var EDH_BASE = (window.localStorage && localStorage.getItem("edep_edh_base")) ||
    "https://cdn.jsdelivr.net/gh/pleuston/simple-edep-edh@main";

  var COLLECTIONS = {
    local: { id: "local", title: "Local", records: "records/", index: "data/records-index.json" },
    edh: {
      id: "edh", title: "Epigraphic Database Heidelberg", base: EDH_BASE,
      records:      EDH_BASE + "/records/",
      coll:         EDH_BASE + "/collections/edh/",
      indexParts:   EDH_BASE + "/collections/edh/index-parts.json",
      people:       EDH_BASE + "/collections/edh/people.json",
      photos:       EDH_BASE + "/collections/edh/photos.json",
      geo:          EDH_BASE + "/collections/edh/geo.json",
      provinces:    EDH_BASE + "/collections/edh/provinces.json",
      bibliography: EDH_BASE + "/collections/edh/bibliography.json",
      manifest:     EDH_BASE + "/collections/edh/manifest.json"
    }
  };

  function recordUrl(file, col) {
    var c = COLLECTIONS[col || "local"] || COLLECTIONS.local;
    var name = String(file).replace(/^.*\//, "").replace(/\.xml$/i, "") + ".xml";
    return c.records + name;
  }

  function getJSON(url) { return fetch(url).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }); }

  // merged catalogue list: local demo records + the EDH collection; each entry
  // tagged .col. The EDH index is split into chunks (jsDelivr caps files at
  // 20 MB), listed in index-parts.json and fetched in parallel.
  function loadCatalog() {
    function tag(arr, col) { (arr || []).forEach(function (e) { e.col = col; }); return arr || []; }
    var local = getJSON(COLLECTIONS.local.index).then(function (a) { return tag(a, "local"); });
    var edh = getJSON(COLLECTIONS.edh.indexParts).then(function (pm) {
      var parts = (pm && pm.parts) || [];
      return Promise.all(parts.map(function (name) { return getJSON(COLLECTIONS.edh.coll + name); }))
        .then(function (chunks) { var all = []; chunks.forEach(function (c) { all = all.concat(tag(c, "edh")); }); return all; });
    });
    return Promise.all([local, edh]).then(function (p) { return p[0].concat(p[1]); });
  }

  window.EpiCollections = {
    list: COLLECTIONS, get: function (id) { return COLLECTIONS[id]; },
    recordUrl: recordUrl, getJSON: getJSON, loadCatalog: loadCatalog, edhBase: EDH_BASE
  };
})();
