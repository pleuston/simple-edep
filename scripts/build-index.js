/* build-index.js — scan a collection's records/*.xml and write its index.json
 * (the authoritative catalogue list). EDH-aware; joins coordinates from the
 * collection's geo.json (via the find-spot Pleiades URI) and flags records that
 * have a heidICON photo (from photos.json).
 *
 * Usage: node scripts/build-index.js [outDir]   (default ../simple-edep-edh)
 *        node scripts/build-index.js . demo      (app repo, local demo index)
 */
var fs = require("fs");
var path = require("path");
var OUT = process.argv[2] || path.join(__dirname, "..", "..", "simple-edep-edh");
var mode = process.argv[3] || "edh";
var recDir = path.join(OUT, "records");
var collDir = mode === "demo" ? path.join(OUT, "data") : path.join(OUT, "collections", "edh");
var indexFile = mode === "demo" ? path.join(collDir, "records-index.json") : path.join(collDir, "index.json");
fs.mkdirSync(collDir, { recursive: true });

function decode(s) {
  return String(s).replace(/&amp;ndash;|&ndash;/g, "–").replace(/&amp;amp;/g, "&")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#160;|&nbsp;/g, " ");
}
function pick(xml, re) { var m = xml.match(re); return m ? decode(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim() : ""; }

// pleiades URI -> [lat, lng] from the collection gazetteer
var pleiades = {};
[path.join(collDir, "geo.json"), path.join(__dirname, "..", "data", "geo.json")].some(function (g) {
  try { JSON.parse(fs.readFileSync(g, "utf8")).forEach(function (x) { if (x.pleiades) pleiades[x.pleiades] = [x.lat, x.lng]; }); return true; }
  catch (e) { return false; }
});
// set of hd numbers that have a photo
var hasPhoto = {};
try { JSON.parse(fs.readFileSync(path.join(collDir, "photos.json"), "utf8")).forEach(function (p) { if (p.hd) hasPhoto[p.hd] = 1; }); } catch (e) {}
// hd -> TM (for cross-collection reconciliation)
var tmMap = {};
try { tmMap = JSON.parse(fs.readFileSync(path.join(collDir, "tm.json"), "utf8")) || {}; } catch (e) {}

var files = fs.readdirSync(recDir).filter(function (f) { return /\.xml$/i.test(f); }).sort();
var index = files.map(function (f) {
  var xml = fs.readFileSync(path.join(recDir, f), "utf8");
  var title = pick(xml, /<title xml:lang="en">([\s\S]*?)<\/title>/) || pick(xml, /<title[^>]*>([\s\S]*?)<\/title>/);
  var settlement = pick(xml, /<settlement>([\s\S]*?)<\/settlement>/) || pick(xml, /<placeName type="modern">([\s\S]*?)<\/placeName>/);
  var region = pick(xml, /<region>([\s\S]*?)<\/region>/) || pick(xml, /<placeName type="region">([\s\S]*?)<\/placeName>/);
  var date = pick(xml, /<origDate[^>]*>([\s\S]*?)<\/origDate>/) ||
             (((xml.match(/notBefore(?:-custom)?="([^"]+)"/) || [])[1] || "") +
              ((xml.match(/notAfter(?:-custom)?="([^"]+)"/) || [])[1] ? " – " + (xml.match(/notAfter(?:-custom)?="([^"]+)"/) || [])[1] : ""));
  var textType = pick(xml, /<rs type="textType"[^>]*>([\s\S]*?)<\/rs>/) ||
                 pick(xml, /<term ref="[^"]*typeins[^"]*">([\s\S]*?)<\/term>/) || pick(xml, /<term[^>]*>([\s\S]*?)<\/term>/);
  var objectType = pick(xml, /<objectType[^>]*>([\s\S]*?)<\/objectType>/);
  var material = pick(xml, /<material[^>]*>([\s\S]*?)<\/material>/);

  var lat = "", lng = "";
  var geo = pick(xml, /<geo>([^<]+)<\/geo>/);
  if (geo) { var p = geo.split(/\s+/); lat = p[0] || ""; lng = p[1] || ""; }
  else {
    var pref = (xml.match(/<placeName[^>]*ref="(https:\/\/pleiades\.stoa\.org\/places\/\d+)"[^>]*>/) || [])[1];
    if (pref && pleiades[pref]) { lat = pleiades[pref][0]; lng = pleiades[pref][1]; }
  }

  // faceting fields: Roman province, modern country, numeric date bounds
  var province = pick(xml, /<placeName type="province"[^>]*>([\s\S]*?)<\/placeName>/);
  var country = pick(xml, /<placeName type="country"[^>]*>([\s\S]*?)<\/placeName>/) || pick(xml, /<country[^>]*>([\s\S]*?)<\/country>/);
  function yr(m) { if (!m) return null; var n = parseInt(m[1], 10); return isNaN(n) ? null : n; }
  var nb = yr(xml.match(/notBefore-custom="([^"]+)"/)) ;
  if (nb === null) nb = yr(xml.match(/notBefore="([^"]+)"/));
  if (nb === null) nb = yr(xml.match(/\bwhen(?:-custom)?="([^"]+)"/));
  var na = yr(xml.match(/notAfter-custom="([^"]+)"/));
  if (na === null) na = yr(xml.match(/notAfter="([^"]+)"/));
  if (na === null) na = nb;

  var e = { file: f, titleEn: title, settlement: settlement, region: region,
            date: date, textType: textType, objectType: objectType, material: material, lat: lat, lng: lng };
  if (province) e.province = province;
  if (country) e.country = country;
  if (nb !== null) e.nb = nb;
  if (na !== null) e.na = na;
  var hd = f.replace(/\.xml$/, "");
  if (tmMap[hd]) e.tm = tmMap[hd];
  if (hasPhoto[hd]) e.photo = 1;
  return e;
});

var stats = "(" + index.filter(function (r) { return r.lat; }).length + " geolocated, " +
  index.filter(function (r) { return r.photo; }).length + " with photo)";
if (mode === "demo") {
  fs.writeFileSync(indexFile, JSON.stringify(index));
  console.log("wrote " + path.relative(OUT, indexFile) + " — " + index.length + " records " + stats);
} else {
  // Chunk the large index: jsDelivr serves files up to 20 MB only.
  var CHUNK = 25000, parts = [];
  for (var i = 0; i < index.length; i += CHUNK) {
    var name = "index-" + parts.length + ".json";
    fs.writeFileSync(path.join(collDir, name), JSON.stringify(index.slice(i, i + CHUNK)));
    parts.push(name);
  }
  fs.writeFileSync(path.join(collDir, "index-parts.json"), JSON.stringify({ parts: parts, count: index.length }));
  try { fs.unlinkSync(path.join(collDir, "index.json")); } catch (e) {}
  console.log("wrote " + parts.length + " index chunks + index-parts.json — " + index.length + " records " + stats);
}
