/* build-index.js — scan records/*.xml and write data/records-index.json with a
 * compact summary per record (for the catalogue list and the map). Run after
 * adding or editing records by hand:  node scripts/build-index.js */
var fs = require("fs");
var path = require("path");
var recDir = path.join(__dirname, "..", "records");
var outFile = path.join(__dirname, "..", "data", "records-index.json");

function pick(xml, re) { var m = xml.match(re); return m ? m[1].replace(/<[^>]+>/g, "").trim() : ""; }

var files = fs.readdirSync(recDir).filter(function (f) { return /\.xml$/i.test(f); }).sort();
var index = files.map(function (f) {
  var xml = fs.readFileSync(path.join(recDir, f), "utf8");
  var geo = pick(xml, /<geo>([^<]+)<\/geo>/);
  var lat = "", lng = "";
  if (geo) { var p = geo.split(/\s+/); lat = p[0] || ""; lng = p[1] || ""; }
  return {
    file: f,
    titleEn: pick(xml, /<title xml:lang="en">([\s\S]*?)<\/title>/) || pick(xml, /<title[^>]*>([\s\S]*?)<\/title>/),
    settlement: pick(xml, /<settlement>([\s\S]*?)<\/settlement>/),
    region: pick(xml, /<region>([\s\S]*?)<\/region>/),
    date: pick(xml, /<origDate[^>]*>([\s\S]*?)<\/origDate>/) || (xml.match(/<origDate[^>]*\bwhen="([^"]+)"/) || [])[1] || "",
    textType: pick(xml, /<rs type="textType"[^>]*>([\s\S]*?)<\/rs>/),
    objectType: pick(xml, /<objectType[^>]*>([\s\S]*?)<\/objectType>/),
    material: pick(xml, /<material[^>]*>([\s\S]*?)<\/material>/),
    lat: lat, lng: lng
  };
});

fs.writeFileSync(outFile, JSON.stringify(index, null, 2) + "\n", "utf8");
console.log("wrote data/records-index.json (" + index.length + " records)");
