/*
 * vocab.js — controlled vocabularies for Roman/Latin epigraphy.
 *
 * Hand-editable data only (no network). Object types reference EAGLE / Eagle
 * vocabularies where possible; materials reference the Getty AAT; text types
 * follow the EDH (Epigraphic Database Heidelberg) "Texttyp" scheme.
 *
 * Exposed as window.V (browser) and module.exports (Node), so the generator
 * and its unit tests can read the same data.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.V = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MATERIALS = [
    { en: "Marble",     ref: "http://vocab.getty.edu/aat/300011443" },
    { en: "Limestone",  ref: "http://vocab.getty.edu/aat/300011286" },
    { en: "Sandstone",  ref: "http://vocab.getty.edu/aat/300011727" },
    { en: "Granite",    ref: "http://vocab.getty.edu/aat/300011197" },
    { en: "Travertine", ref: "http://vocab.getty.edu/aat/300011689" },
    { en: "Tufa",       ref: "http://vocab.getty.edu/aat/300011083" },
    { en: "Basalt",     ref: "http://vocab.getty.edu/aat/300011098" },
    { en: "Bronze",     ref: "http://vocab.getty.edu/aat/300010957" },
    { en: "Stone (unspecified)", ref: "http://vocab.getty.edu/aat/300011176" }
  ];

  // EAGLE "object type / support" vocabulary (https://www.eagle-network.eu/voc/typeobject/)
  var OBJECT_TYPES = [
    { en: "Altar",            ref: "https://www.eagle-network.eu/voc/typeobject/lod/2.html" },
    { en: "Stele",            ref: "https://www.eagle-network.eu/voc/typeobject/lod/258.html" },
    { en: "Tabula / plaque",  ref: "https://www.eagle-network.eu/voc/typeobject/lod/272.html" },
    { en: "Base",             ref: "https://www.eagle-network.eu/voc/typeobject/lod/57.html" },
    { en: "Cippus",           ref: "https://www.eagle-network.eu/voc/typeobject/lod/91.html" },
    { en: "Sarcophagus",      ref: "https://www.eagle-network.eu/voc/typeobject/lod/247.html" },
    { en: "Funerary urn",     ref: "https://www.eagle-network.eu/voc/typeobject/lod/284.html" },
    { en: "Milestone",        ref: "https://www.eagle-network.eu/voc/typeobject/lod/177.html" },
    { en: "Column",           ref: "https://www.eagle-network.eu/voc/typeobject/lod/104.html" },
    { en: "Architectural block", ref: "https://www.eagle-network.eu/voc/typeobject/lod/49.html" },
    { en: "Instrumentum",     ref: "https://www.eagle-network.eu/voc/typeobject/lod/156.html" },
    { en: "Other / unspecified", ref: "" }
  ];

  // EDH text type (https://edh.ub.uni-heidelberg.de/data/api – "Inschriftgattung")
  var TEXT_TYPES = [
    { en: "Epitaph (funerary)",  ref: "https://www.eagle-network.eu/voc/typeins/lod/92.html" },
    { en: "Votive / dedication", ref: "https://www.eagle-network.eu/voc/typeins/lod/69.html" },
    { en: "Building / construction", ref: "https://www.eagle-network.eu/voc/typeins/lod/74.html" },
    { en: "Honorific",           ref: "https://www.eagle-network.eu/voc/typeins/lod/100.html" },
    { en: "Milestone",           ref: "https://www.eagle-network.eu/voc/typeins/lod/96.html" },
    { en: "Owner / maker mark",  ref: "https://www.eagle-network.eu/voc/typeins/lod/93.html" },
    { en: "Boundary",            ref: "https://www.eagle-network.eu/voc/typeins/lod/72.html" },
    { en: "Legal / official",    ref: "https://www.eagle-network.eu/voc/typeins/lod/89.html" },
    { en: "List / album",        ref: "https://www.eagle-network.eu/voc/typeins/lod/88.html" },
    { en: "Acclamation",         ref: "https://www.eagle-network.eu/voc/typeins/lod/68.html" },
    { en: "Defixio (curse)",     ref: "https://www.eagle-network.eu/voc/typeins/lod/77.html" },
    { en: "Other / unspecified", ref: "" }
  ];

  // origDate/@datingMethod — EpiDoc-style controlled values
  var DATING_METHODS = [
    { value: "lettering",      label: "Letter forms / palaeography" },
    { value: "context",        label: "Archaeological context" },
    { value: "consules",       label: "Named consuls (consular date)" },
    { value: "nomina",         label: "Imperial titulature / names" },
    { value: "tribunicia",     label: "Tribunician power / regnal year" },
    { value: "prosopography",  label: "Prosopography / formula" },
    { value: "combined",       label: "Combination of criteria" }
  ];

  var PROVENANCE_TYPES = [
    { value: "found",     label: "Find spot" },
    { value: "observed",  label: "Current location / repository" },
    { value: "reused",    label: "Re-used (spolia)" },
    { value: "relocated", label: "Relocated (modern)" }
  ];

  var LANGUAGES = [
    { ident: "la",  label: "Latin" },
    { ident: "grc", label: "Ancient Greek" },
    { ident: "la-Latn", label: "Latin (Latin script)" },
    { ident: "xpu", label: "Punic" },
    { ident: "und", label: "Undetermined" }
  ];

  // Roman provinces (free-text helper list for the find-spot field)
  var PROVINCES = [
    "Italia", "Sicilia", "Sardinia et Corsica", "Hispania Tarraconensis",
    "Baetica", "Lusitania", "Gallia Narbonensis", "Aquitania", "Lugdunensis",
    "Belgica", "Germania Superior", "Germania Inferior", "Raetia", "Noricum",
    "Pannonia Superior", "Pannonia Inferior", "Dalmatia", "Moesia Superior",
    "Moesia Inferior", "Dacia", "Thracia", "Macedonia", "Achaia", "Epirus",
    "Asia", "Bithynia et Pontus", "Galatia", "Cappadocia", "Cilicia", "Lycia et Pamphylia",
    "Syria", "Iudaea / Syria Palaestina", "Arabia", "Aegyptus", "Cyrenaica et Creta",
    "Africa Proconsularis", "Numidia", "Mauretania Caesariensis", "Mauretania Tingitana",
    "Britannia"
  ];

  var LICENCES = [
    { en: "CC BY 4.0",    ref: "https://creativecommons.org/licenses/by/4.0/" },
    { en: "CC BY-SA 4.0", ref: "https://creativecommons.org/licenses/by-sa/4.0/" },
    { en: "CC0 1.0",      ref: "https://creativecommons.org/publicdomain/zero/1.0/" }
  ];

  var SCRIPTS = [
    "Capitalis monumentalis", "Capitalis rustica", "Capitalis quadrata",
    "Actuaria", "Cursive", "Greek capitals", "Other"
  ];

  return {
    MATERIALS: MATERIALS, OBJECT_TYPES: OBJECT_TYPES, TEXT_TYPES: TEXT_TYPES,
    DATING_METHODS: DATING_METHODS, PROVENANCE_TYPES: PROVENANCE_TYPES,
    LANGUAGES: LANGUAGES, PROVINCES: PROVINCES, LICENCES: LICENCES, SCRIPTS: SCRIPTS
  };
});
