/* import-edh.js — one-time import of the EDH open-data exports.
 *
 * Reads the raw EDH downloads (geographic GeoJSON + BibTeX) and writes slim,
 * app-ready JSON into data/. The EpiDoc records are unzipped into records/
 * separately; build-index.js turns those into data/records-index.json.
 *
 * Source data: Epigraphic Database Heidelberg (CC BY-SA 4.0).
 * Usage: node scripts/import-edh.js [geo.json] [biblio.bib]
 */
var fs = require("fs");
var path = require("path");
var DL = process.env.HOME + "/Downloads";
var geoSrc = process.argv[2] || path.join(DL, "edhGeographicData.json");
var bibSrc = process.argv[3] || path.join(DL, "edhBibliography.bib");
var dataDir = path.join(__dirname, "..", "data");

// ---- geographic data → data/geo.json (slim find-spot gazetteer) ----------
function importGeo() {
  var fc = JSON.parse(fs.readFileSync(geoSrc, "utf8"));
  var out = [];
  (fc.features || []).forEach(function (f) {
    var g = f.geometry, p = f.properties || {};
    if (!g || g.type !== "Point" || !g.coordinates) return;
    var lng = +g.coordinates[0], lat = +g.coordinates[1];
    if (isNaN(lng) || isNaN(lat)) return;
    out.push({
      name: p.ancient_findspot || "",
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5,
      pleiades: p.pleiades_uri || "",
      tm: p.trismegistos_geo_uri || "",
      edh: p.uri || ""
    });
  });
  fs.writeFileSync(path.join(dataDir, "geo.json"), JSON.stringify(out));
  console.log("wrote data/geo.json — " + out.length + " find spots");
}

// ---- bibliography .bib → data/bibliography.json --------------------------
function importBib() {
  var raw = fs.readFileSync(bibSrc, "utf8");
  // split into entries on "@type{" at line start
  var entries = [];
  var re = /@(\w+)\s*\{\s*([^,]+),([\s\S]*?)\n\}/g, m;
  while ((m = re.exec(raw))) {
    var type = m[1].toLowerCase(), key = m[2].trim(), body = m[3];
    var fields = {};
    // field = {value}  or  field = "value"  or  field = value,
    var fre = /(\w+)\s*=\s*(\{([\s\S]*?)\}|"([\s\S]*?)"|([^,\n]+))\s*,?/g, fm;
    while ((fm = fre.exec(body))) {
      var name = fm[1].toLowerCase();
      var val = (fm[3] != null ? fm[3] : fm[4] != null ? fm[4] : fm[5] || "").replace(/\s+/g, " ").trim();
      fields[name] = val;
    }
    entries.push({
      key: key, type: type,
      author: fields.author || fields.editor || "",
      title: fields.title || "",
      journal: fields.journal || fields.booktitle || "",
      year: fields.year || "",
      number: fields.number || fields.volume || "",
      pages: fields.pages || "",
      note: fields.note || ""
    });
  }
  fs.writeFileSync(path.join(dataDir, "bibliography.json"), JSON.stringify(entries));
  console.log("wrote data/bibliography.json — " + entries.length + " entries");
}

if (fs.existsSync(geoSrc)) importGeo(); else console.log("skip geo: " + geoSrc + " not found");
if (fs.existsSync(bibSrc)) importBib(); else console.log("skip bib: " + bibSrc + " not found");
