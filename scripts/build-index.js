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

  var e = { file: f, titleEn: title, settlement: settlement, region: region,
            date: date, textType: textType, objectType: objectType, material: material, lat: lat, lng: lng };
  if (hasPhoto[f.replace(/\.xml$/, "")]) e.photo = 1;
  return e;
});

fs.writeFileSync(indexFile, JSON.stringify(index));
console.log("wrote " + path.relative(OUT, indexFile) + " — " + index.length + " records (" +
  index.filter(function (r) { return r.lat; }).length + " geolocated, " +
  index.filter(function (r) { return r.photo; }).length + " with photo)");
