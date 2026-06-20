/* build-index.js — scan records/*.xml and write data/records-index.json (the
 * authoritative catalogue list). Handles both this app's own generator output
 * and the imported EDH EpiDoc structure. Coordinates are joined from
 * data/geo.json via the find-spot's Pleiades URI.
 *
 * Run after adding/editing records:  node scripts/build-index.js
 */
var fs = require("fs");
var path = require("path");
var recDir = path.join(__dirname, "..", "records");
var dataDir = path.join(__dirname, "..", "data");

function decode(s) {
  return String(s)
    .replace(/&amp;ndash;|&ndash;/g, "–").replace(/&amp;amp;/g, "&")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#160;|&nbsp;/g, " ");
}
function pick(xml, re) { var m = xml.match(re); return m ? decode(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim() : ""; }

// pleiades URI -> [lat, lng] from the geo gazetteer
var pleiades = {};
try {
  JSON.parse(fs.readFileSync(path.join(dataDir, "geo.json"), "utf8")).forEach(function (g) {
    if (g.pleiades) pleiades[g.pleiades] = [g.lat, g.lng];
  });
} catch (e) { /* geo optional */ }

var files = fs.readdirSync(recDir).filter(function (f) { return /\.xml$/i.test(f); }).sort();
var index = files.map(function (f) {
  var xml = fs.readFileSync(path.join(recDir, f), "utf8");

  var title = pick(xml, /<title xml:lang="en">([\s\S]*?)<\/title>/) || pick(xml, /<title[^>]*>([\s\S]*?)<\/title>/);
  var settlement = pick(xml, /<settlement>([\s\S]*?)<\/settlement>/) || pick(xml, /<placeName type="modern">([\s\S]*?)<\/placeName>/);
  var region = pick(xml, /<region>([\s\S]*?)<\/region>/) || pick(xml, /<placeName type="region">([\s\S]*?)<\/placeName>/);
  var date = pick(xml, /<origDate[^>]*>([\s\S]*?)<\/origDate>/) ||
             ((xml.match(/notBefore(?:-custom)?="([^"]+)"/) || [])[1] || "") +
             ((xml.match(/notAfter(?:-custom)?="([^"]+)"/) || [])[1] ? " – " + (xml.match(/notAfter(?:-custom)?="([^"]+)"/) || [])[1] : "");
  var textType = pick(xml, /<rs type="textType"[^>]*>([\s\S]*?)<\/rs>/) ||
                 pick(xml, /<term ref="[^"]*typeins[^"]*">([\s\S]*?)<\/term>/) ||
                 pick(xml, /<term[^>]*>([\s\S]*?)<\/term>/);
  var objectType = pick(xml, /<objectType[^>]*>([\s\S]*?)<\/objectType>/);
  var material = pick(xml, /<material[^>]*>([\s\S]*?)<\/material>/);

  // coordinates: own <geo> first, else join find-spot Pleiades URI
  var lat = "", lng = "";
  var geo = pick(xml, /<geo>([^<]+)<\/geo>/);
  if (geo) { var p = geo.split(/\s+/); lat = p[0] || ""; lng = p[1] || ""; }
  else {
    var pref = (xml.match(/<placeName[^>]*ref="(https:\/\/pleiades\.stoa\.org\/places\/\d+)"[^>]*>/) || [])[1];
    if (pref && pleiades[pref]) { lat = pleiades[pref][0]; lng = pleiades[pref][1]; }
  }

  return {
    file: f, titleEn: title, settlement: settlement, region: region,
    date: date, textType: textType, objectType: objectType, material: material,
    lat: lat, lng: lng
  };
});

fs.writeFileSync(path.join(dataDir, "records-index.json"), JSON.stringify(index));
console.log("wrote data/records-index.json — " + index.length + " records (" +
  index.filter(function (r) { return r.lat; }).length + " geolocated)");
