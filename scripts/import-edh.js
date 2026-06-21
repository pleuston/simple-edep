/* import-edh.js — build the EDH collection registers for the data repo.
 *
 * Reads the EDH open-data exports from ~/Downloads/edh and writes slim,
 * app-ready JSON into <data-repo>/collections/edh/. The EpiDoc records are
 * unzipped into <data-repo>/records/ separately; build-index.js turns those
 * into collections/edh/index.json.
 *
 * Source: Epigraphic Database Heidelberg (data CC BY-SA 4.0; photos hotlinked
 * from heidICON — Rights Reserved, Free Access).
 *
 * Usage: node scripts/import-edh.js [outDir]   (default ../simple-edep-edh)
 */
var fs = require("fs");
var path = require("path");
var SRC = process.env.HOME + "/Downloads/edh";
var OUT = process.argv[2] || path.join(__dirname, "..", "..", "simple-edep-edh");
var COLL = path.join(OUT, "collections", "edh");
fs.mkdirSync(COLL, { recursive: true });

// ---- tiny CSV parser (RFC-4180-ish: quoted fields, "" escapes, , and \n) ---
function parseCSV(text) {
  var rows = [], row = [], field = "", i = 0, q = false, c;
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (; i < text.length; i++) {
    c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function readTable(name) {
  var p = path.join(SRC, name);
  if (!fs.existsSync(p)) { console.log("  (missing " + name + ")"); return []; }
  var rows = parseCSV(fs.readFileSync(p, "utf8"));
  var head = rows.shift().map(function (h) { return h.trim(); });
  return rows.filter(function (r) { return r.length > 1; }).map(function (r) {
    var o = {}; head.forEach(function (h, j) { o[h] = (r[j] || "").trim(); }); return o;
  });
}
function write(name, obj) {
  fs.writeFileSync(path.join(COLL, name), JSON.stringify(obj));
  console.log("  wrote collections/edh/" + name + " — " + (Array.isArray(obj) ? obj.length + " items" : "object") +
    " (" + (fs.statSync(path.join(COLL, name)).size / 1048576).toFixed(1) + " MB)");
}

// ---- people (edh_data_pers.csv) ------------------------------------------
function importPeople() {
  var rows = readTable("edh_data_pers.csv");
  var out = rows.map(function (r) {
    var name = r.name || [r.praenomen, r.nomen, r.cognomen, r.supernomen].filter(Boolean).join(" ");
    var age = [r.l_jahre && r.l_jahre + "y", r.l_monate && r.l_monate + "m", r.l_tage && r.l_tage + "d"].filter(Boolean).join(" ");
    return {
      hd: r.hd_nr || "", name: name.trim(),
      role: r.funktion || r.beruf || "", status: r.status || "",
      gender: r.geschlecht || "", age: age, pir: r.pir || "", uri: r.uri || ""
    };
  }).filter(function (p) { return p.name; });
  write("people.json", out);
}

// ---- photos (edh_data_foto.csv) — only those with a heidICON IIIF image ---
function importPhotos() {
  var rows = readTable("edh_data_foto.csv");
  var out = [];
  rows.forEach(function (r) {
    if (!r.heidicon_iiif) return;
    out.push({
      f: r.f_nr || "", hd: r.hd_nr || "",
      iiif: r.heidicon_iiif, thumb: r.heidicon_thumb || "", detail: r.heidicon_detail || "",
      year: r.aufnahme_jahr || "", place: r.fo_antik || r.fo_modern || "", cil: r.cil || ""
    });
  });
  write("photos.json", out);
  return out.length;
}

// ---- geographic gazetteer (edhGeographicData.json) -> coords by pleiades --
function importGeo() {
  var p = path.join(SRC, "edhGeographicData.json");
  if (!fs.existsSync(p)) { console.log("  (missing edhGeographicData.json)"); return; }
  var fc = JSON.parse(fs.readFileSync(p, "utf8")), out = [];
  (fc.features || []).forEach(function (f) {
    var g = f.geometry, pr = f.properties || {};
    if (!g || g.type !== "Point" || !g.coordinates) return;
    var lng = +g.coordinates[0], lat = +g.coordinates[1];
    if (isNaN(lng) || isNaN(lat)) return;
    out.push({ name: pr.ancient_findspot || "", lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5,
      pleiades: pr.pleiades_uri || "", tm: pr.trismegistos_geo_uri || "" });
  });
  write("geo.json", out);
}

// ---- Roman province boundaries -> provinces.json (rounded to shrink) ------
function importProvinces() {
  var p = path.join(SRC, "roman_province_boundaries.json");
  if (!fs.existsSync(p)) { console.log("  (missing roman_province_boundaries.json)"); return; }
  var fc = JSON.parse(fs.readFileSync(p, "utf8"));
  function round(x) { return Math.round(x * 1e4) / 1e4; }
  function walk(a) { return Array.isArray(a[0]) ? a.map(walk) : [round(a[0]), round(a[1])]; }
  fc.features.forEach(function (f) { if (f.geometry && f.geometry.coordinates) f.geometry.coordinates = walk(f.geometry.coordinates); });
  write("provinces.json", fc);
}

// ---- bibliography (edh_data_biblio.csv) ----------------------------------
function importBiblio() {
  var rows = readTable("edh_data_biblio.csv");
  var out = rows.map(function (r) {
    return { key: r.b_nr || "", author: r.autor || "", title: r.titel || "", journal: r.publikation || "",
      number: r.band || "", year: r.jahr || "", pages: r.seiten || "",
      note: [r.cil, r.ae].filter(Boolean).join("; ") };
  }).filter(function (e) { return e.author || e.title; });
  write("bibliography.json", out);
}

console.log("importing EDH collection registers into " + COLL);
importPeople();
var nPhotos = importPhotos();
importGeo();
importProvinces();
importBiblio();

// ---- manifest -------------------------------------------------------------
var nRecords = fs.existsSync(path.join(OUT, "records"))
  ? fs.readdirSync(path.join(OUT, "records")).filter(function (f) { return /\.xml$/.test(f); }).length : 0;
write("manifest.json", {
  id: "edh", title: "Epigraphic Database Heidelberg",
  source: "https://edh.ub.uni-heidelberg.de/",
  licence: "CC BY-SA 4.0", licence_url: "https://creativecommons.org/licenses/by-sa/4.0/",
  photos_rights: "Photos: Epigraphische Fotothek Heidelberg / heidICON — Rights Reserved, Free Access",
  attribution: "Data: Epigraphic Database Heidelberg (Heidelberg Academy of Sciences and Humanities), CC BY-SA 4.0.",
  counts: { records: nRecords, photos: nPhotos }
});
console.log("done.");
