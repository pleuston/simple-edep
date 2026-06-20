/* Generate seed Roman inscription records into records/*.xml using generator.js. */
var fs = require("fs");
var path = require("path");
var EpiDocGen = require(path.join(__dirname, "..", "generator.js"));
var outDir = path.join(__dirname, "..", "records");

var records = [
  {
    filename: "demo_altar",
    titleEn: "Funerary altar of Iulia Secunda",
    titleLa: "D M",
    summary: "Marble funerary altar dedicated to the Manes of Iulia Secunda.",
    editor: "simple-edep",
    edh: "HD000000", cil: "CIL XIII 0000",
    objectType: "Altar", objectTypeRef: "https://www.eagle-network.eu/voc/typeobject/lod/2.html",
    material: "Marble", materialRef: "http://vocab.getty.edu/aat/300011443",
    heightCm: "78", widthCm: "42", depthCm: "30", letterMin: "2", letterMax: "3.5",
    condition: "Intact, lightly weathered.",
    layoutColumns: "1", layoutLines: "5", layoutNote: "Five lines, centred on the front face.",
    script: "Capitalis monumentalis",
    textType: "Epitaph (funerary)", textTypeRef: "https://www.eagle-network.eu/voc/typeins/lod/92.html",
    whenISO: "0150", notBefore: "0100", notAfter: "0200", datingMethod: "lettering",
    dateText: "2nd century CE (letter forms).",
    origPlace: "Mogontiacum", province: "Germania Superior",
    origPlaceRef: "https://pleiades.stoa.org/places/109169",
    country: "Germany", region: "Rheinland-Pfalz", settlement: "Mainz",
    lat: "49.9929", long: "8.2473",
    provenanceType: "found", provenanceText: "Found re-used in the late-antique city wall.",
    repository: "Landesmuseum Mainz", inventory: "S 137",
    langIdent: "la", langLabel: "Latin",
    texts: [{ lang: "la", editionXml:
      '<lb n="1"/><expan><abbr>D</abbr></expan> <expan><abbr>M</abbr></expan>\n' +
      '<lb n="2"/>Iulia\n<lb n="3"/>Secunda\n<lb n="4"/>vixit ann<supplied reason="lost">is</supplied>\n' +
      '<lb n="5"/><expan><abbr>h</abbr><ex>ic</ex></expan> <expan><abbr>s</abbr><ex>ita</ex></expan> <expan><abbr>e</abbr><ex>st</ex></expan>' }],
    translationEn: "To the Spirits of the Departed. Iulia Secunda lived [..] years. She lies here.",
    apparatus: "4: ANN for ann(is)",
    commentaryText: "A standard provincial funerary formula (D M … h s e).",
    bibliography: "CIL XIII 0000\nAE 2026, 1",
    licence: "CC BY 4.0", licenceTarget: "https://creativecommons.org/licenses/by/4.0/",
    changeWhen: "2026-06-20", status: "draft", changeNote: "Seed record."
  },
  {
    filename: "demo_votive",
    titleEn: "Votive altar to Iuppiter Optimus Maximus",
    titleLa: "I O M",
    summary: "Limestone votive altar to Jupiter Best and Greatest, set up in fulfilment of a vow.",
    editor: "simple-edep",
    edh: "HD000001",
    objectType: "Altar", objectTypeRef: "https://www.eagle-network.eu/voc/typeobject/lod/2.html",
    material: "Limestone", materialRef: "http://vocab.getty.edu/aat/300011286",
    heightCm: "95", widthCm: "48", depthCm: "40", letterMin: "3", letterMax: "4",
    condition: "Upper moulding chipped.",
    layoutColumns: "1", layoutLines: "5",
    script: "Capitalis monumentalis",
    textType: "Votive / dedication", textTypeRef: "https://www.eagle-network.eu/voc/typeins/lod/69.html",
    whenISO: "0200", notBefore: "0150", notAfter: "0250", datingMethod: "lettering",
    dateText: "early 3rd century CE.",
    origPlace: "Aquincum", province: "Pannonia Inferior",
    origPlaceRef: "https://pleiades.stoa.org/places/197164",
    country: "Hungary", region: "Budapest", settlement: "Budapest (Óbuda)",
    lat: "47.5614", long: "19.0394",
    provenanceType: "found", provenanceText: "Found in the canabae of the legionary fortress.",
    repository: "Aquincum Museum", inventory: "63.10.5",
    langIdent: "la", langLabel: "Latin",
    texts: [{ lang: "la", editionXml:
      '<lb n="1"/><expan><abbr>I</abbr></expan> <expan><abbr>O</abbr></expan> <expan><abbr>M</abbr></expan>\n' +
      '<lb n="2"/>Aurelius\n<lb n="3"/>Victor\n<lb n="4"/><expan><abbr>v</abbr><ex>otum</ex></expan> <expan><abbr>s</abbr><ex>olvit</ex></expan> <expan><abbr>l</abbr><ex>ibens</ex></expan>\n' +
      '<lb n="5"/><expan><abbr>m</abbr><ex>erito</ex></expan>' }],
    translationEn: "To Jupiter Best and Greatest. Aurelius Victor willingly and deservedly fulfilled his vow.",
    commentaryText: "The dedication formula v(otum) s(olvit) l(ibens) m(erito) is among the commonest on Roman votive altars.",
    bibliography: "CIL III 3489\nRIU 1234",
    licence: "CC BY 4.0", licenceTarget: "https://creativecommons.org/licenses/by/4.0/",
    changeWhen: "2026-06-20", status: "draft", changeNote: "Seed record."
  },
  {
    filename: "demo_milestone",
    titleEn: "Milestone of Maximinus Thrax",
    titleLa: "Imp Caes",
    summary: "Sandstone milestone recording road repair under the emperor Maximinus.",
    editor: "simple-edep",
    edcs: "EDCS-12300456",
    objectType: "Milestone", objectTypeRef: "https://www.eagle-network.eu/voc/typeobject/lod/177.html",
    material: "Sandstone", materialRef: "http://vocab.getty.edu/aat/300011727",
    heightCm: "180", widthCm: "55", depthCm: "55", letterMin: "4", letterMax: "6",
    condition: "Lower part lost.",
    layoutColumns: "1", layoutLines: "6",
    script: "Capitalis monumentalis",
    textType: "Milestone", textTypeRef: "https://www.eagle-network.eu/voc/typeins/lod/96.html",
    whenISO: "0236", notBefore: "0235", notAfter: "0238", datingMethod: "nomina",
    dateText: "236 CE, by imperial titulature.",
    origPlace: "Lugdunum", province: "Gallia Lugdunensis",
    origPlaceRef: "https://pleiades.stoa.org/places/167717",
    country: "France", region: "Auvergne-Rhône-Alpes", settlement: "Lyon",
    lat: "45.7600", long: "4.8357",
    provenanceType: "found", provenanceText: "Found along the via Agrippa.",
    repository: "Musée gallo-romain de Lyon-Fourvière", inventory: "ML 401",
    langIdent: "la", langLabel: "Latin",
    texts: [{ lang: "la", editionXml:
      '<lb n="1"/><expan><abbr>Imp</abbr><ex>erator</ex></expan> <expan><abbr>Caes</abbr><ex>ar</ex></expan>\n' +
      '<lb n="2"/><expan><abbr>C</abbr><ex>aius</ex></expan> Iulius\n<lb n="3"/>Verus\n<lb n="4"/>Maximinus\n' +
      '<lb n="5"/><expan><abbr>p</abbr><ex>ius</ex></expan> <expan><abbr>f</abbr><ex>elix</ex></expan> <expan><abbr>Aug</abbr><ex>ustus</ex></expan>\n' +
      '<lb n="6"/>viam restituit' }],
    translationEn: "The Emperor Caesar Gaius Iulius Verus Maximinus, Pius Felix Augustus, restored the road.",
    bibliography: "CIL XVII-2 1\nAE 2025, 100",
    licence: "CC BY 4.0", licenceTarget: "https://creativecommons.org/licenses/by/4.0/",
    changeWhen: "2026-06-20", status: "draft", changeNote: "Seed record."
  }
];

records.forEach(function (r) {
  var xml = EpiDocGen.buildEpiDoc(r);
  fs.writeFileSync(path.join(outDir, r.filename + ".xml"), xml, "utf8");
  console.log("wrote records/" + r.filename + ".xml (" + xml.length + " bytes)");
});
