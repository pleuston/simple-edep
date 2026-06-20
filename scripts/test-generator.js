/* Headless unit test for generator.js — run with `node scripts/test-generator.js`.
 * Verifies the Leiden fragment is injected verbatim (NOT escaped) and that the
 * assembled document is well-formed. */
var assert = require("assert");
var path = require("path");
var EpiDocGen = require(path.join(__dirname, "..", "generator.js"));

var fails = 0;
function check(name, fn) {
  try { fn(); console.log("  ok  " + name); }
  catch (e) { fails++; console.log("FAIL  " + name + "\n      " + e.message); }
}

// A realistic Leiden-converted edition fragment (inner <ab> content), as the
// jinn-epidoc-editor would hand back.
var editionXml =
  '<lb n="1"/><supplied reason="lost">Imp</supplied>erator Caes<supplied reason="lost">ar</supplied>\n' +
  '<lb n="2"/><expan><abbr>co</abbr><ex>n</ex>s<ex>ul</ex></expan>';

var state = {
  filename: "test_001",
  titleEn: "Test funerary altar",
  titleLa: "D M",
  editor: "Test Editor",
  edh: "HD000001", edcs: "EDCS-00000001", tm: "123456",
  material: "Marble", materialRef: "http://vocab.getty.edu/aat/300011443",
  objectType: "Altar", objectTypeRef: "https://www.eagle-network.eu/voc/typeobject/lod/2.html",
  heightCm: "80", widthCm: "45", depthCm: "35",
  letterMin: "2.0", letterMax: "2.5",
  condition: "Intact",
  layoutColumns: "1", layoutLines: "2", layoutNote: "Two lines, centred",
  script: "Capitalis monumentalis",
  textType: "Epitaph (funerary)", textTypeRef: "https://www.eagle-network.eu/voc/typeins/lod/92.html",
  whenISO: "0150", datingMethod: "lettering", dateText: "ca. 150 CE",
  origPlace: "Mogontiacum", province: "Germania Superior",
  country: "Germany", region: "Rheinland-Pfalz", settlement: "Mainz",
  lat: "49.999", long: "8.271",
  repository: "Landesmuseum Mainz", inventory: "S 1",
  texts: [{ lang: "la", editionXml: editionXml }],
  translationEn: "Emperor Caesar, consul.",
  apparatus: "1: IMP for Imp(erator)",
  commentaryText: "A test inscription.",
  bibliography: "CIL XIII 1\nAE 2020, 1",
  licence: "CC BY 4.0", licenceTarget: "https://creativecommons.org/licenses/by/4.0/",
  changeWhen: "2026-06-20", status: "draft", changeNote: "Initial encoding"
};

var xml = EpiDocGen.buildEpiDoc(state);

check("contains unescaped <supplied>", function () {
  assert(xml.indexOf('<supplied reason="lost">Imp</supplied>') !== -1, "supplied markup missing/escaped");
});
check("contains unescaped <expan>", function () {
  assert(xml.indexOf("<expan><abbr>co</abbr><ex>n</ex>s<ex>ul</ex></expan>") !== -1, "expan markup missing/escaped");
});
check("fragment NOT double-escaped", function () {
  assert(xml.indexOf("&lt;supplied") === -1, "found &lt;supplied — fragment was escaped");
});
check("edition wrapped in <div type=\"edition\"><ab>", function () {
  assert(/<div type="edition"[^>]*>\s*<ab>/.test(xml), "edition div/ab wrapper missing");
});
check("EpiDoc processing instructions present", function () {
  assert(xml.indexOf("tei-epidoc.rng") !== -1, "xml-model PI missing");
});
check("root has TEI namespace", function () {
  assert(xml.indexOf('<TEI xmlns="http://www.tei-c.org/ns/1.0"') !== -1, "TEI root/namespace missing");
});
check("IDs emitted", function () {
  assert(xml.indexOf('<idno type="EDH">HD000001</idno>') !== -1, "EDH idno missing");
  assert(xml.indexOf('<idno type="EDCS">EDCS-00000001</idno>') !== -1, "EDCS idno missing");
});
check("letter height dimensions emitted", function () {
  assert(/<dimensions type="letterHeight"[^>]*>/.test(xml), "letterHeight dimensions missing");
});
check("apparatus app/note emitted", function () {
  assert(/<app loc="1">\s*<note>IMP for Imp\(erator\)<\/note>\s*<\/app>/.test(xml), "apparatus entry missing");
});
check("translation emitted", function () {
  assert(/<div type="translation" xml:lang="en">/.test(xml), "translation div missing");
});
check("no leftover xmlns on the injected fragment", function () {
  // the fragment must not carry its own xmlns (root TEI provides it once)
  var ed = xml.split('<div type="edition"')[1] || "";
  assert(ed.indexOf('xmlns="http://www.tei-c.org/ns/1.0"') === -1, "fragment kept a redundant xmlns");
});

console.log("\n--- generated document ---\n");
console.log(xml);
console.log("\n" + (fails ? (fails + " FAILURE(S)") : "ALL CHECKS PASSED"));
process.exit(fails ? 1 : 0);
