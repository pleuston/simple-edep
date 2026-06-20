/*
 * reading.js — render EpiDoc/TEI XML to a human-readable HTML reading view.
 * Applies (display) Leiden conventions: () for expansions, [] for supplied,
 * underdots for unclear, [---] for gaps. Used by the editor "Reading" pane and
 * by viewer.html. Exposed as window.EpiDocReader.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EpiDocReader = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var NS = "http://www.tei-c.org/ns/1.0";

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function parse(xml) {
    var doc = new DOMParser().parseFromString(xml, "application/xml");
    return doc.getElementsByTagName("parsererror").length ? null : doc;
  }
  function ns(doc, name) { return doc.getElementsByTagNameNS(NS, name); }
  function txt(node) { return node ? node.textContent.trim() : ""; }
  function attr(node, a) { return node && node.getAttribute(a) || ""; }

  // walk an edition node -> display HTML (Leiden rendering)
  function renderNodes(node) {
    var out = "";
    for (var n = node.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) { out += esc(n.nodeValue); continue; }
      if (n.nodeType !== 1) continue;
      var name = n.localName;
      switch (name) {
        case "lb":
          var nn = attr(n, "n"), brk = attr(n, "break");
          if (out !== "") out += (brk === "no" ? "" : "\n");
          out += '<span class="lb-num">' + esc(nn || "") + "</span>";
          break;
        case "supplied":
          out += '<span class="supplied">[' + renderNodes(n) + "]</span>"; break;
        case "expan":
          out += renderExpan(n); break;
        case "abbr": out += renderNodes(n); break;
        case "ex": out += '<span class="ex">(' + renderNodes(n) + ")</span>"; break;
        case "unclear": out += '<span class="unclear">' + renderNodes(n) + "</span>"; break;
        case "gap":
          out += '<span class="gap">' + gapText(n) + "</span>"; break;
        case "del":
          out += '<span class="del">⟦' + renderNodes(n) + "⟧</span>"; break;
        case "del-erasure": out += "⟦" + renderNodes(n) + "⟧"; break;
        case "num": out += '<span class="num">' + renderNodes(n) + "</span>"; break;
        case "hi": out += renderNodes(n); break;
        case "g": out += esc(attr(n, "type") || txt(n) || "·"); break;
        case "space": out += " "; break;
        case "choice": out += renderChoice(n); break;
        case "w": case "name": case "persName": case "placeName": case "rs":
          out += renderNodes(n); break;
        default: out += renderNodes(n);
      }
    }
    return out;
  }
  function renderExpan(n) {
    // abbr + ex shown as letters with (expansion)
    var out = "";
    for (var c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) out += esc(c.nodeValue);
      else if (c.nodeType === 1 && c.localName === "abbr") out += renderNodes(c);
      else if (c.nodeType === 1 && c.localName === "ex") out += '<span class="ex">(' + renderNodes(c) + ")</span>";
      else if (c.nodeType === 1) out += renderNodes(c);
    }
    return out;
  }
  function renderChoice(n) {
    var corr = n.getElementsByTagNameNS(NS, "corr")[0] || n.getElementsByTagNameNS(NS, "reg")[0];
    var sic  = n.getElementsByTagNameNS(NS, "sic")[0]  || n.getElementsByTagNameNS(NS, "orig")[0];
    if (corr) return renderNodes(corr);
    if (sic) return renderNodes(sic);
    return renderNodes(n);
  }
  function gapText(n) {
    var reason = attr(n, "reason"), q = attr(n, "quantity"), ext = attr(n, "extent"), unit = attr(n, "unit");
    if (ext === "unknown" || (!q && !attr(n, "atLeast"))) return reason === "lost" ? "[- - -]" : "------";
    var dots = q ? new Array(parseInt(q, 10) + 1).join("·") : "·";
    return reason === "lost" ? "[" + dots + "]" : dots;
  }

  function renderEditionHtml(doc) {
    var editions = [];
    var divs = ns(doc, "div");
    for (var i = 0; i < divs.length; i++) {
      if (divs[i].getAttribute("type") === "edition") {
        var abs = divs[i].getElementsByTagNameNS(NS, "ab");
        var parts = divs[i].querySelectorAll ? null : null;
        // collect each <ab> (covers textpart structure too)
        var blocks = "";
        for (var j = 0; j < abs.length; j++) {
          var head = abs[j].parentNode && abs[j].parentNode.localName === "div"
            ? txt(abs[j].parentNode.getElementsByTagNameNS(NS, "head")[0]) : "";
          if (head) blocks += '<div class="reading-sub">' + esc(head) + "</div>";
          blocks += '<div class="edition-text">' + renderNodes(abs[j]) + "</div>";
        }
        editions.push(blocks);
      }
    }
    return editions.join("");
  }

  function render(xml) {
    var doc = parse(xml);
    if (!doc) return '<p style="color:#b42318">Document is not well-formed.</p>';

    var titles = ns(doc, "title");
    var titleEn = "";
    for (var i = 0; i < titles.length; i++) {
      if (titles[i].parentNode.localName === "titleStmt" && titles[i].getAttribute("xml:lang") !== "la") { titleEn = txt(titles[i]); break; }
    }
    var settlement = txt(ns(doc, "settlement")[0]);
    var dateText = txt(ns(doc, "origDate")[0]);
    var html = "";
    if (titleEn) html += '<h2 class="reading-title">' + esc(titleEn) + "</h2>";
    var sub = [settlement, dateText].filter(Boolean).join(" · ");
    if (sub) html += '<p class="reading-sub">' + esc(sub) + "</p>";

    var ed = renderEditionHtml(doc);
    if (ed) html += '<div class="reading-section"><h3>Text</h3>' + ed + "</div>";

    // translations
    var divs = ns(doc, "div");
    for (var k = 0; k < divs.length; k++) {
      if (divs[k].getAttribute("type") === "translation") {
        var lang = divs[k].getAttribute("xml:lang") || "";
        var ps = divs[k].getElementsByTagNameNS(NS, "p");
        var body = "";
        for (var p = 0; p < ps.length; p++) body += "<p>" + esc(txt(ps[p])) + "</p>";
        html += '<div class="reading-section"><h3>Translation' + (lang ? " (" + esc(lang) + ")" : "") + "</h3>" + body + "</div>";
      }
    }
    // apparatus
    var apps = ns(doc, "app");
    if (apps.length) {
      var ap = "";
      for (var a = 0; a < apps.length; a++) {
        var loc = apps[a].getAttribute("loc");
        ap += '<div class="app-entry">' + (loc ? '<span class="loc">' + esc(loc) + "</span>" : "") + esc(txt(apps[a])) + "</div>";
      }
      html += '<div class="reading-section"><h3>Apparatus</h3>' + ap + "</div>";
    }
    // commentary
    for (var c = 0; c < divs.length; c++) {
      if (divs[c].getAttribute("type") === "commentary") {
        html += '<div class="reading-section"><h3>Commentary</h3><p>' + esc(txt(divs[c])) + "</p></div>";
      }
    }
    // bibliography
    var bibls = ns(doc, "bibl");
    if (bibls.length) {
      var bl = "";
      for (var b = 0; b < bibls.length; b++) bl += "<li>" + esc(txt(bibls[b])) + "</li>";
      html += '<div class="reading-section"><h3>Bibliography</h3><ul class="bibl-list">' + bl + "</ul></div>";
    }
    return html;
  }

  return { render: render, renderEdition: function (xml) { var d = parse(xml); return d ? renderEditionHtml(d) : ""; } };
});
