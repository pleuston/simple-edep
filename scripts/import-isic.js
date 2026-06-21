/* import-isic.js — build the I.Sicily collection index.
 *
 * Reads the ISicily EpiDoc corpus (sparse clone of github.com/ISicily/ISicily)
 * and writes collections/isic/index.json into the APP repo. The records
 * themselves are served from ISicily via jsDelivr (see collections.js). Each
 * entry carries authority IDs (TM, EDH, EDCS) for cross-collection reconciliation.
 *
 * Source: I.Sicily (sicily.classics.ox.ac.uk), CC BY 4.0.
 * Usage: node scripts/import-isic.js [inscriptionsDir]
 */
var fs = require("fs");
var path = require("path");
var SRC = process.argv[2] || "/tmp/isic/inscriptions";
var COLL = path.join(__dirname, "..", "collections", "isic");
fs.mkdirSync(COLL, { recursive: true });

function decode(s) {
  return String(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#160;|&nbsp;/g, " ");
}
function pick(xml, re) { var m = xml.match(re); return m ? decode(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim() : ""; }
function idno(xml, type) { var m = xml.match(new RegExp('<idno type="' + type + '"[^>]*>([^<]*)</idno>')); return m ? m[1].trim() : ""; }
function yr(xml, re) { var m = xml.match(re); if (!m) return null; var n = parseInt(m[1], 10); return isNaN(n) ? null : n; }
function ad(n) { return n < 0 ? (-n + " BC") : (n + " AD"); }

var files = fs.readdirSync(SRC).filter(function (f) { return /\.xml$/i.test(f); }).sort();
var index = files.map(function (f) {
  var xml = fs.readFileSync(path.join(SRC, f), "utf8");
  var title = pick(xml, /<title[^>]*>([\s\S]*?)<\/title>/);
  var findspot = pick(xml, /<placeName type="modern"[^>]*>([^<]+)<\/placeName>/) || pick(xml, /<settlement[^>]*>([^<]+)<\/settlement>/);
  var geo = pick(xml, /<geo>([^<]+)<\/geo>/), lat = "", lng = "";
  if (geo) { var p = geo.split(/[,\s]+/).filter(Boolean); lat = p[0] || ""; lng = p[1] || ""; }
  var nb = yr(xml, /notBefore-custom="([^"]+)"/); if (nb === null) nb = yr(xml, /notBefore="([^"]+)"/);
  var na = yr(xml, /notAfter-custom="([^"]+)"/); if (na === null) na = yr(xml, /notAfter="([^"]+)"/); if (na === null) na = nb;
  var date = pick(xml, /<origDate[^>]*>([\s\S]*?)<\/origDate>/);
  if (!date && nb !== null) date = ad(nb) + (na !== null && na !== nb ? " – " + ad(na) : "");
  var textType = pick(xml, /<rs type="textType"[^>]*>([\s\S]*?)<\/rs>/) || pick(xml, /<term[^>]*>([\s\S]*?)<\/term>/);
  var objectType = pick(xml, /<objectType[^>]*>([\s\S]*?)<\/objectType>/);
  var material = pick(xml, /<material[^>]*>([\s\S]*?)<\/material>/);

  var e = { file: f, titleEn: title, settlement: findspot, region: "Sicily", date: date,
            textType: textType, objectType: objectType, material: material, lat: lat, lng: lng,
            province: "Sicilia", country: "Italy" };
  if (nb !== null) e.nb = nb;
  if (na !== null) e.na = na;
  var tm = idno(xml, "TM"); if (tm) e.tm = tm;
  var edh = idno(xml, "EDH"); if (edh) e.edh = edh;
  var edcs = idno(xml, "EDCS"); if (edcs) e.edcs = edcs;
  return e;
});

fs.writeFileSync(path.join(COLL, "index.json"), JSON.stringify(index));
fs.writeFileSync(path.join(COLL, "manifest.json"), JSON.stringify({
  id: "isic", title: "I.Sicily", source: "http://sicily.classics.ox.ac.uk/",
  repo: "https://github.com/ISicily/ISicily", licence: "CC BY 4.0",
  attribution: "I.Sicily (sicily.classics.ox.ac.uk), CC BY 4.0.",
  counts: { records: index.length }
}));
console.log("wrote collections/isic/index.json — " + index.length + " records (" +
  index.filter(function (r) { return r.lat; }).length + " geolocated, " +
  index.filter(function (r) { return r.tm; }).length + " with TM, " +
  index.filter(function (r) { return r.edh; }).length + " with an EDH id)");
