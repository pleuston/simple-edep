/*
 * generator.js — EpiDoc/TEI serializer for Roman/Latin inscriptions.
 *
 * EpiDocGen.buildEpiDoc(data) -> EpiDoc/TEI XML string.
 *
 * Environment-agnostic (no DOM): runs in the browser (window.EpiDocGen) AND
 * under Node (module.exports), so the same code that powers the form can be
 * unit-tested headlessly.
 *
 * The transcription is owned by the Leiden editor (jinn-epidoc-editor), which
 * hands back already-converted EpiDoc XML. That fragment is injected VERBATIM
 * via the raw() node — it is NOT re-escaped. When no Leiden fragment is present
 * (plain-text fallback) the text is split into <lb n=".."/> lines instead.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EpiDocGen = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // --- escaping -----------------------------------------------------------
  function escText(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escAttr(s) { return escText(s).replace(/"/g, "&quot;"); }
  function t(v) { return v == null ? "" : String(v).trim(); }

  // --- tiny node model ----------------------------------------------------
  function cleanAttrs(attrs) {
    var out = {};
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (t(attrs[k]) !== "") out[k] = t(attrs[k]);
    });
    return out;
  }
  function flat(children) {
    var out = [];
    children.forEach(function (c) {
      if (Array.isArray(c)) out = out.concat(flat(c));
      else if (c != null && !(typeof c === "string" && c.trim() === "")) out.push(c);
    });
    return out;
  }
  // h = prune when empty; hk = keep even if empty (structural spine)
  function h(tag, attrs) {
    var children = flat([].slice.call(arguments, 2));
    var a = cleanAttrs(attrs);
    if (Object.keys(a).length === 0 && children.length === 0) return null;
    return { tag: tag, attrs: a, children: children };
  }
  function hk(tag, attrs) {
    var children = flat([].slice.call(arguments, 2));
    return { tag: tag, attrs: cleanAttrs(attrs), children: children };
  }
  function comment(s) { return { comment: t(s) }; }
  function selfclose(tag, attrs) { return { tag: tag, attrs: cleanAttrs(attrs), children: [], selfclose: true }; }
  // raw = emit the string verbatim (already-serialized EpiDoc XML, no escaping)
  function raw(xml) { return { raw: String(xml == null ? "" : xml) }; }

  // --- serialize ----------------------------------------------------------
  function attrStr(attrs) {
    var keys = Object.keys(attrs);
    if (!keys.length) return "";
    return " " + keys.map(function (k) { return k + '="' + escAttr(attrs[k]) + '"'; }).join(" ");
  }
  function serialize(node, depth) {
    var pad = "  ".repeat(depth);
    if (node == null) return "";
    if (typeof node === "string") return pad + escText(node);
    if (node.raw != null) {
      // re-indent each non-blank line to the current depth; no escaping
      return node.raw.replace(/\r/g, "").split("\n")
        .filter(function (l) { return l.trim() !== ""; })
        .map(function (l) { return pad + l.replace(/^\s+/, ""); })
        .join("\n");
    }
    if (node.comment != null) return pad + "<!-- " + node.comment + " -->";
    var a = attrStr(node.attrs);
    var kids = node.children || [];
    if (node.selfclose || kids.length === 0) return pad + "<" + node.tag + a + "/>";
    if (kids.length === 1 && typeof kids[0] === "string") {
      return pad + "<" + node.tag + a + ">" + escText(kids[0]) + "</" + node.tag + ">";
    }
    var inner = kids.map(function (c) { return serialize(c, depth + 1); })
      .filter(function (s) { return s !== ""; }).join("\n");
    return pad + "<" + node.tag + a + ">\n" + inner + "\n" + pad + "</" + node.tag + ">";
  }

  // --- edition body -------------------------------------------------------
  // strip a redundant default-namespace decl the component may emit on fragments
  function stripNs(xml) {
    return String(xml).replace(/\s+xmlns="http:\/\/www\.tei-c\.org\/ns\/1\.0"/g, "");
  }
  function lbSplit(text) {
    var raw0 = t(text);
    if (!raw0) return [comment("transcription — type in the Leiden+ editor")];
    var lines = raw0.replace(/\r/g, "").split("\n");
    var out = [], n = 0;
    lines.forEach(function (line) {
      if (line.trim() === "") return;
      n += 1;
      out.push(selfclose("lb", { n: String(n) }));
      out.push(line);
    });
    return out.length ? out : [comment("transcription")];
  }
  // children that go inside <ab>: Leiden fragment (verbatim) or <lb>-split text
  function editionAbContent(tx) {
    var frag = t(tx.editionXml);
    if (frag) return [raw(stripNs(frag))];
    return lbSplit(tx.editionText);
  }

  function normTexts(d) {
    if (d.texts && d.texts.length) return d.texts;
    return [{ label: "", lang: d.editionLang || "la", editionXml: d.editionXml, editionText: d.editionText }];
  }

  // --- bibliography lines -> <bibl> ---------------------------------------
  function biblChildren(text) {
    var raw0 = t(text);
    if (!raw0) return null;
    return raw0.replace(/\r/g, "").split("\n").map(function (l) { return l.trim(); })
      .filter(Boolean).map(function (l) { return h("bibl", null, l); });
  }

  // --- apparatus lines -> <app> -------------------------------------------
  // each line "loc: note"  ->  <app loc="loc"><note>note</note></app>
  function apparatusChildren(text) {
    var raw0 = t(text);
    if (!raw0) return null;
    return raw0.replace(/\r/g, "").split("\n").map(function (l) { return l.trim(); })
      .filter(Boolean).map(function (l) {
        var m = l.match(/^\s*([0-9]+(?:[-–][0-9]+)?)\s*[:.\)]\s*(.+)$/);
        if (m) return h("app", { loc: m[1] }, h("note", null, m[2]));
        return h("app", null, h("note", null, l));
      });
  }

  // --- body: editions, apparatus, translation, commentary, bibliography ---
  function bodyChildren(d) {
    var texts = normTexts(d);
    var simple = texts.length === 1 && !t(texts[0].label);
    var edition;
    if (simple) {
      edition = hk("div",
        { type: "edition", "xml:lang": texts[0].lang || "la", "xml:space": "preserve" },
        hk("ab", null, editionAbContent(texts[0])));
    } else {
      var parts = texts.map(function (tx, i) {
        return hk("div",
          { type: "textpart", n: String(i + 1), subtype: tx.subtype, "xml:lang": tx.lang || "la" },
          t(tx.label) ? h("head", null, tx.label) : null,
          hk("ab", null, editionAbContent(tx)));
      });
      edition = hk("div", { type: "edition", "xml:space": "preserve" }, parts);
    }

    var apparatus = (function () {
      var apps = apparatusChildren(d.apparatus);
      return apps ? h("div", { type: "apparatus" }, h("listApp", null, apps)) : null;
    })();

    var translations = [];
    if (t(d.translationEn)) translations.push(transDiv(d.translationEn, "en"));
    if (t(d.translationDe)) translations.push(transDiv(d.translationDe, "de"));

    var commentary = t(d.commentaryText)
      ? h("div", { type: "commentary" }, h("p", null, d.commentaryText)) : null;

    var bibl = (function () {
      var bibls = biblChildren(d.bibliography);
      return bibls ? h("div", { type: "bibliography" }, h("listBibl", null, bibls)) : null;
    })();

    return [edition, apparatus].concat(translations).concat([commentary, bibl]);
  }
  function transDiv(text, lang) {
    var paras = String(text).replace(/\r/g, "").split(/\n{2,}/).map(function (p) { return p.trim(); }).filter(Boolean);
    return h("div", { type: "translation", "xml:lang": lang },
      paras.length ? paras.map(function (p) { return h("p", null, p); }) : h("p", null, text));
  }

  // --- main builder -------------------------------------------------------
  function buildEpiDoc(d) {
    d = d || {};

    var titleStmt = hk("titleStmt", null,
      t(d.titleEn) ? h("title", { "xml:lang": "en" }, d.titleEn) : comment("English title"),
      t(d.titleLa) ? h("title", { "xml:lang": "la" }, d.titleLa) : null,
      h("editor", { role: "editor" }, d.editor));

    var publicationStmt = hk("publicationStmt", null,
      h("authority", null, d.authority || "simple-edep"),
      h("idno", { type: "filename" }, d.filename),
      d.idURI ? h("idno", { type: "URI" }, d.idURI) : null,
      hk("availability", null,
        d.licenceTarget || d.licence
          ? h("licence", { target: d.licenceTarget }, d.licence || d.licenceTarget)
          : comment("licence, e.g. CC BY 4.0")));

    var idnos = [
      idno("EDH", d.edh), idno("EDCS", d.edcs), idno("EDR", d.edr),
      idno("TM", d.tm), idno("PHI", d.phi), idno("CIL", d.cil)
    ].filter(Boolean);

    var msIdentifier = hk("msIdentifier", null,
      h("country", { ref: d.countryRef }, d.country),
      h("region", null, d.region),
      h("settlement", null, d.settlement),
      h("repository", null, d.repository),
      h("idno", { type: "inventory" }, d.inventory) || (idnos.length ? null : comment("inventory no.")),
      idnos);

    var msItem = h("msItem", null,
      d.textType ? h("rs", { type: "textType", ref: d.textTypeRef }, d.textType) : null);
    var msContents = h("msContents", null, h("summary", null, d.summary), msItem);

    // physical description
    var dims = h("dimensions", { unit: "cm" },
      h("height", null, d.heightCm), h("width", null, d.widthCm), h("depth", null, d.depthCm));
    var letterDims = (t(d.letterMin) || t(d.letterMax))
      ? h("dimensions", { type: "letterHeight", unit: "cm" },
          h("height", { min: d.letterMin, max: d.letterMax }, !t(d.letterMax) && t(d.letterMin) ? d.letterMin : null))
      : null;
    var support = h("support", null,
      h("material", { ref: d.materialRef }, d.material),
      h("objectType", { ref: d.objectTypeRef }, d.objectType),
      dims, letterDims);
    var supportDesc = h("supportDesc", null, support, h("condition", null, d.condition));
    var layout = h("layout", { columns: d.layoutColumns, writtenLines: d.layoutLines }, d.layoutNote);
    var objectDesc = h("objectDesc", null, supportDesc, layout ? h("layoutDesc", null, layout) : null);
    var handDesc = (t(d.script) || t(d.decoration))
      ? h("handDesc", null,
          t(d.script) ? h("handNote", { ref: d.scriptRef }, d.script + (t(d.decoration) ? ". " + d.decoration : "")) : h("handNote", null, d.decoration))
      : null;
    var physDesc = h("physDesc", null, objectDesc, handDesc);

    // history / origin
    var origDate = h("origDate",
      { datingMethod: d.datingMethod ? "#" + d.datingMethod : "", when: d.whenISO, notBefore: d.notBefore, notAfter: d.notAfter },
      d.dateText);
    var origPlace = h("origPlace", { ref: d.origPlaceRef },
      t(d.origPlace) || t(d.province) ? (t(d.origPlace) || "") + (t(d.province) ? (t(d.origPlace) ? " (" + d.province + ")" : d.province) : "") : null);
    var geo = (t(d.lat) && t(d.long)) ? h("location", null, h("geo", null, d.lat + " " + d.long)) : null;
    var origin = h("origin", null, origDate, origPlace, geo);
    var provenance = [];
    if (t(d.provenanceText)) provenance.push(h("provenance", { type: d.provenanceType || "found" }, h("p", null, d.provenanceText)));
    var history = h("history", null, origin, provenance);

    var msDesc = hk("msDesc", null, msIdentifier, msContents, physDesc, history);
    var sourceDesc = hk("sourceDesc", null, msDesc);
    var fileDesc = hk("fileDesc", null, titleStmt, publicationStmt, sourceDesc);

    // profileDesc
    var profileDesc = h("profileDesc", null,
      h("langUsage", null,
        h("language", { ident: d.langIdent || "la" }, d.langLabel || "Latin"),
        t(d.langSecondary) ? h("language", { ident: d.langSecondaryIdent || "grc" }, d.langSecondary) : null),
      d.textType ? h("textClass", null,
        h("keywords", { scheme: "#texttype" }, h("term", { ref: d.textTypeRef }, d.textType))) : null);

    var revisionDesc = (t(d.changeNote) || t(d.changeWhen))
      ? h("revisionDesc", { status: d.status },
          h("change", { when: d.changeWhen, who: d.changeWho }, d.changeNote || "edited")) : null;

    var teiHeader = hk("teiHeader", null, fileDesc,
      d.encodingNote ? h("encodingDesc", null, h("p", null, d.encodingNote)) : null,
      profileDesc, revisionDesc);

    var facsimile = t(d.facsimileUrl)
      ? h("facsimile", null, selfclose("graphic", { url: d.facsimileUrl })) : null;

    var body = hk("body", null, bodyChildren(d));
    var text = hk("text", null, body);

    var TEI = hk("TEI", { xmlns: "http://www.tei-c.org/ns/1.0", "xml:lang": "en" },
      teiHeader, facsimile, text);

    var prolog =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<?xml-model href="https://www.stoa.org/epidoc/schema/latest/tei-epidoc.rng" schematypens="http://relaxng.org/ns/structure/1.0"?>\n' +
      '<?xml-model href="https://www.stoa.org/epidoc/schema/latest/tei-epidoc.rng" schematypens="http://purl.oclc.org/dsdl/schematron"?>\n';

    return prolog + serialize(TEI, 0) + "\n";

    function idno(type, val) { return t(val) ? h("idno", { type: type }, val) : null; }
  }

  return { buildEpiDoc: buildEpiDoc };
});
