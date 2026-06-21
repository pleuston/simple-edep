/* collections.js — registry of data collections the app can read and combine.
 *
 *  - local  : the user's demo records, in this repo (records/, data/).
 *  - edh    : Epigraphic Database Heidelberg, in a separate repo served via
 *             jsDelivr (records + chunked index + registers). CC BY-SA 4.0.
 *  - isic   : I.Sicily — records served from github.com/ISicily/ISicily via
 *             jsDelivr; the derived index lives in this repo. CC BY 4.0.
 *
 * Collections can be selected separately (localStorage "edep_cols"), and a
 * reconciled view (localStorage "edep_reconcile") eliminates duplicates across
 * collections via shared authority IDs (TM, EDH/HD-number, EDCS).
 *
 * The EDH base is overridable via "edep_edh_base" for local testing.
 */
(function () {
  "use strict";
  var EDH_BASE = (window.localStorage && localStorage.getItem("edep_edh_base")) ||
    "https://cdn.jsdelivr.net/gh/pleuston/simple-edep-edh@main";
  var ISIC_RECORDS = "https://cdn.jsdelivr.net/gh/ISicily/ISicily@master/inscriptions/";

  var COLLECTIONS = {
    local: { id: "local", title: "My records", short: "—", color: "#6e1423",
      records: "records/", index: "data/records-index.json" },
    edh: { id: "edh", title: "Epigraphic Database Heidelberg", short: "EDH", color: "#cc0000",
      records: EDH_BASE + "/records/", coll: EDH_BASE + "/collections/edh/",
      indexParts: EDH_BASE + "/collections/edh/index-parts.json",
      people: EDH_BASE + "/collections/edh/people.json",
      photos: EDH_BASE + "/collections/edh/photos.json",
      bibliography: EDH_BASE + "/collections/edh/bibliography.json",
      geo: EDH_BASE + "/collections/edh/geo.json",
      provinces: EDH_BASE + "/collections/edh/provinces.json" },
    isic: { id: "isic", title: "I.Sicily", short: "I.Sicily", color: "#127a4f",
      records: ISIC_RECORDS, index: "collections/isic/index.json", manifest: "collections/isic/manifest.json" }
  };
  var ALL = ["edh", "isic", "local"];
  var PREF = { isic: 0, edh: 1, local: 2 };   // which edition to keep when reconciling

  function getActive() {
    var s = window.localStorage && localStorage.getItem("edep_cols");
    var arr = s ? s.split(",").filter(function (x) { return COLLECTIONS[x]; }) : ALL.slice();
    return arr.length ? arr : ALL.slice();
  }
  function setActive(arr) { localStorage.setItem("edep_cols", (arr || []).join(",")); }
  function isReconcile() { return localStorage.getItem("edep_reconcile") === "1"; }
  function setReconcile(on) { localStorage.setItem("edep_reconcile", on ? "1" : "0"); }

  function recordUrl(file, col) {
    var c = COLLECTIONS[col || "local"] || COLLECTIONS.local;
    var name = String(file).replace(/^.*\//, "").replace(/\.xml$/i, "") + ".xml";
    return c.records + name;
  }
  function getJSON(url) { return fetch(url).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }); }

  function loadIndex(id) {
    var c = COLLECTIONS[id];
    if (!c) return Promise.resolve([]);
    var p;
    if (c.indexParts) {
      p = getJSON(c.indexParts).then(function (pm) {
        return Promise.all(((pm && pm.parts) || []).map(function (n) { return getJSON(c.coll + n); }))
          .then(function (chunks) { var all = []; chunks.forEach(function (ch) { all = all.concat(ch); }); return all; });
      });
    } else { p = getJSON(c.index); }
    return p.then(function (a) { (a || []).forEach(function (e) { e.col = id; }); return a || []; });
  }

  // Eliminate duplicates that share an authority id (TM, EDH/HD-number, EDCS).
  function reconcile(entries) {
    var keyMap = {}, out = [];
    function keysOf(e) {
      var k = [];
      if (e.tm) k.push("tm:" + e.tm);
      if (e.col === "edh") k.push("edh:" + String(e.file).replace(/\.xml$/i, ""));
      if (e.edh) k.push("edh:" + e.edh);           // I.Sicily's recorded EDH/HD number
      if (e.edcs) k.push("edcs:" + e.edcs);
      return k;
    }
    function uniq(a) { var s = {}, r = []; a.forEach(function (x) { if (x && !s[x]) { s[x] = 1; r.push(x); } }); return r; }
    entries.forEach(function (e) {
      var ks = keysOf(e), hit = null, i;
      for (i = 0; i < ks.length; i++) { if (keyMap[ks[i]]) { hit = keyMap[ks[i]]; break; } }
      // only reconcile duplicates ACROSS collections; keep same-collection records
      if (!hit || hit.col === e.col) { out.push(e); ks.forEach(function (k) { if (!keyMap[k]) keyMap[k] = e; }); return; }
      if ((PREF[e.col] == null ? 9 : PREF[e.col]) < (PREF[hit.col] == null ? 9 : PREF[hit.col])) {
        e._also = uniq((hit._also || []).concat([hit.col]));
        var idx = out.indexOf(hit); if (idx >= 0) out[idx] = e;
        ks.concat(keysOf(hit)).forEach(function (k) { keyMap[k] = e; });
      } else {
        hit._also = uniq((hit._also || []).concat([e.col]));
        ks.forEach(function (k) { if (!keyMap[k]) keyMap[k] = hit; });
      }
    });
    return out;
  }

  // merged catalogue list across the active collections (deduped if reconciling)
  function loadCatalog() {
    var active = getActive();
    return Promise.all(active.map(loadIndex)).then(function (parts) {
      var all = []; parts.forEach(function (p) { all = all.concat(p); });
      if (isReconcile() && active.length > 1) all = reconcile(all);
      return all;
    });
  }

  window.EpiCollections = {
    list: COLLECTIONS, all: ALL, get: function (id) { return COLLECTIONS[id]; },
    getActive: getActive, setActive: setActive, isReconcile: isReconcile, setReconcile: setReconcile,
    recordUrl: recordUrl, getJSON: getJSON, loadIndex: loadIndex, loadCatalog: loadCatalog, edhBase: EDH_BASE
  };
})();
