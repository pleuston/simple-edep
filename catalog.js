/*
 * catalog.js — browse records/, search, and round-trip into the editor.
 *
 * The list comes from the GitHub Contents API when available (picks up records
 * saved after the last index build); otherwise from the committed
 * data/records-index.json. Records themselves are static files in records/
 * (the repo is public), fetched relative to this page — works locally and on
 * GitHub Pages without any API.
 */
(function () {
  "use strict";
  var NS = "http://www.tei-c.org/ns/1.0";
  var listEl, searchEl, sortEl, pagerEl;
  var ENTRIES = [];   // {file, titleEn, settlement, region, date, textType, ...}
  var PAGE = 0, PER = 12;

  document.addEventListener("DOMContentLoaded", function () {
    listEl = document.getElementById("cat-list");
    searchEl = document.getElementById("cat-search");
    sortEl = document.getElementById("cat-sort");
    pagerEl = document.getElementById("cat-pager");
    searchEl.addEventListener("input", function () { PAGE = 0; renderList(); });
    if (sortEl) sortEl.addEventListener("change", function () { PAGE = 0; renderList(); });
    var editId = new URLSearchParams(location.search).get("edit");
    if (editId) { openInEditor(editId.replace(/[^A-Za-z0-9_\-.]/g, "") + ".xml"); return; }
    loadList();
  });

  function loadList() {
    // 1) try the live Contents API (authoritative; includes new saves)
    var viaApi = window.EpiData
      ? EpiData.list("records").then(function (files) {
          if (!files || !files.length) return null;
          return files.filter(function (f) { return /\.xml$/i.test(f.name); })
                      .map(function (f) { return { file: f.name }; });
        }).catch(function () { return null; })
      : Promise.resolve(null);

    viaApi.then(function (apiList) {
      if (apiList && apiList.length) { mergeIndex(apiList); return; }
      // 2) fall back to the committed static index
      fetch("data/records-index.json").then(function (r) { return r.ok ? r.json() : []; })
        .then(function (idx) { ENTRIES = idx || []; renderList(); })
        .catch(function () { showError("Could not load the catalogue."); });
    });
  }

  // Merge API filenames with the rich static index (so we keep summaries).
  function mergeIndex(apiList) {
    fetch("data/records-index.json").then(function (r) { return r.ok ? r.json() : []; })
      .then(function (idx) {
        var byFile = {};
        (idx || []).forEach(function (e) { byFile[e.file] = e; });
        ENTRIES = apiList.map(function (a) { return byFile[a.file] || { file: a.file, titleEn: a.file.replace(/\.xml$/, "") }; });
        renderList();
      })
      .catch(function () { ENTRIES = apiList; renderList(); });
  }

  function renderList() {
    var q = (searchEl.value || "").toLowerCase().trim();
    var rows = ENTRIES.filter(function (e) {
      if (!q) return true;
      return [e.titleEn, e.settlement, e.region, e.textType, e.objectType, e.file].join(" ").toLowerCase().indexOf(q) !== -1;
    });
    rows.sort(sorter(sortEl ? sortEl.value : "title"));
    var total = rows.length;
    var pages = Math.max(1, Math.ceil(total / PER));
    if (PAGE >= pages) PAGE = 0;
    if (!total) {
      listEl.innerHTML = '<div class="catalog-empty">No records' + (q ? " match “" + esc(q) + "”." : ". <a href=\"editor.html\">Add the first one →</a>") + "</div>";
      if (pagerEl) pagerEl.innerHTML = "";
      return;
    }
    listEl.innerHTML = rows.slice(PAGE * PER, PAGE * PER + PER).map(rowHtml).join("");
    renderPager(total, pages);
  }

  function sorter(key) {
    return function (a, b) {
      if (key === "date") return String(a.date || "").localeCompare(String(b.date || ""));
      if (key === "place") return String(a.settlement || "").localeCompare(String(b.settlement || ""));
      return String(a.titleEn || a.file).localeCompare(String(b.titleEn || b.file));
    };
  }

  function renderPager(total, pages) {
    if (!pagerEl) return;
    var html = "";
    if (pages > 1) {
      html += '<button data-pg="first"' + (PAGE === 0 ? " disabled" : "") + ">|&lt;</button>";
      for (var i = 0; i < pages; i++) html += '<button data-pg="' + i + '" class="' + (i === PAGE ? "on" : "") + '">' + (i + 1) + "</button>";
      html += '<button data-pg="last"' + (PAGE === pages - 1 ? " disabled" : "") + ">&gt;|</button>";
    }
    html += '<span class="register-count">Found ' + total + " item" + (total === 1 ? "" : "s") + "</span>";
    pagerEl.innerHTML = html;
    Array.prototype.forEach.call(pagerEl.querySelectorAll("button[data-pg]"), function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-pg");
        PAGE = v === "first" ? 0 : v === "last" ? pages - 1 : parseInt(v, 10);
        renderList();
      });
    });
  }

  function rowHtml(e) {
    var id = e.file.replace(/\.xml$/, "");
    var tags = [e.objectType, e.textType, e.material].filter(Boolean)
      .map(function (t) { return '<span class="catalog-tag">' + esc(t) + "</span>"; }).join("");
    var meta = [e.settlement, e.region, e.date].filter(Boolean).join(" · ");
    return '<div class="catalog-item"><div class="catalog-monument"><div class="catalog-info">' +
      '<span class="catalog-filename">' + esc(e.file) + "</span>" +
      '<div class="catalog-title"><a href="viewer.html?id=' + encodeURIComponent(id) + '">' + esc(e.titleEn || id) + "</a></div>" +
      (meta ? '<span class="catalog-meta">' + esc(meta) + "</span>" : "") +
      (tags ? '<div class="catalog-tags">' + tags + "</div>" : "") +
      "</div><div class=\"catalog-actions\">" +
      '<a class="btn small" href="viewer.html?id=' + encodeURIComponent(id) + '">View</a>' +
      '<button class="btn small" data-edit="' + esc(e.file) + '">Edit</button>' +
      "</div></div></div>";
  }

  listenEdit();
  function listenEdit() {
    document.addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest("[data-edit]");
      if (!b) return;
      openInEditor(b.getAttribute("data-edit"));
    });
  }

  function recordUrl(file) { return "records/" + file; }

  function openInEditor(file) {
    fetch(recordUrl(file)).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(function (xml) {
      var state = parseRecord(file, xml);
      sessionStorage.setItem("edep_preload", JSON.stringify(state));
      window.location.href = "editor.html";
    }).catch(function (e) { toast("Could not load " + file + ": " + e.message, true); });
  }

  // ---- XML -> flat editor state (reverses generator.js) ------------------
  function parseRecord(file, xml) {
    var doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) return { filename: file.replace(/\.xml$/, "") };
    var ser = new XMLSerializer();
    function q(name) { return doc.getElementsByTagNameNS(NS, name); }
    function first(name) { return q(name)[0]; }
    function txt(el) { return el ? el.textContent.trim() : ""; }
    function attr(el, a) { return el && el.getAttribute(a) || ""; }
    function idno(type) {
      var ids = q("idno");
      for (var i = 0; i < ids.length; i++) if (ids[i].getAttribute("type") === type) return txt(ids[i]);
      return "";
    }
    function titleLang(lang) {
      var ts = q("title");
      for (var i = 0; i < ts.length; i++) {
        if (ts[i].parentNode.localName === "titleStmt") {
          var l = ts[i].getAttribute("xml:lang");
          if ((lang === "en" && l !== "la") || (lang === "la" && l === "la")) return txt(ts[i]);
        }
      }
      return "";
    }
    function divType(type) {
      var divs = q("div");
      for (var i = 0; i < divs.length; i++) if (divs[i].getAttribute("type") === type) return divs[i];
      return null;
    }
    function divsType(type) {
      var out = [], divs = q("div");
      for (var i = 0; i < divs.length; i++) if (divs[i].getAttribute("type") === type) out.push(divs[i]);
      return out;
    }
    function innerAb(div) {
      var ab = div.getElementsByTagNameNS(NS, "ab")[0];
      if (!ab) return "";
      var s = "";
      for (var n = ab.firstChild; n; n = n.nextSibling) s += ser.serializeToString(n);
      // Line structure is carried by <lb/> elements, not source newlines, so
      // collapse all pretty-print whitespace to single spaces for a clean
      // Leiden+ rendering on load.
      return s.replace(/\s+xmlns="http:\/\/www\.tei-c\.org\/ns\/1\.0"/g, "")
              .replace(/\s*\n\s*/g, " ").replace(/[ \t]{2,}/g, " ").trim();
    }

    var st = { filename: file.replace(/\.xml$/, "") };
    st.titleEn = titleLang("en");
    st.titleLa = titleLang("la");
    st.summary = txt(first("summary"));
    var ed = (function () { var es = q("editor"); return es.length ? txt(es[0]) : ""; })();
    st.editor = ed;
    st.edh = idno("EDH"); st.edcs = idno("EDCS"); st.edr = idno("EDR");
    st.tm = idno("TM"); st.phi = idno("PHI"); st.cil = idno("CIL");
    st.wikidata = idno("Wikidata"); st.idURI = idno("URI");
    st.inventory = idno("inventory");
    st.country = txt(first("country")); st.region = txt(first("region")); st.settlement = txt(first("settlement"));
    st.repository = txt(first("repository"));

    var material = first("material"), objectType = first("objectType");
    st.material = txt(material); st.materialRef = attr(material, "ref");
    st.objectType = txt(objectType); st.objectTypeRef = attr(objectType, "ref");
    var dims = q("dimensions");
    for (var d = 0; d < dims.length; d++) {
      if (dims[d].getAttribute("type") === "letterHeight") {
        var lh = dims[d].getElementsByTagNameNS(NS, "height")[0];
        st.letterMin = attr(lh, "min"); st.letterMax = attr(lh, "max");
      } else {
        st.heightCm = txt(dims[d].getElementsByTagNameNS(NS, "height")[0]);
        st.widthCm = txt(dims[d].getElementsByTagNameNS(NS, "width")[0]);
        st.depthCm = txt(dims[d].getElementsByTagNameNS(NS, "depth")[0]);
      }
    }
    st.condition = txt(first("condition"));
    var layout = first("layout");
    if (layout) { st.layoutColumns = attr(layout, "columns"); st.layoutLines = attr(layout, "writtenLines"); st.layoutNote = txt(layout); }
    var handNote = first("handNote");
    if (handNote) { st.script = txt(handNote); st.scriptRef = attr(handNote, "ref"); }

    var rs = q("rs");
    for (var r = 0; r < rs.length; r++) if (rs[r].getAttribute("type") === "textType") { st.textType = txt(rs[r]); st.textTypeRef = attr(rs[r], "ref"); }

    var origDate = first("origDate");
    if (origDate) {
      st.whenISO = attr(origDate, "when"); st.notBefore = attr(origDate, "notBefore"); st.notAfter = attr(origDate, "notAfter");
      st.datingMethod = (attr(origDate, "datingMethod") || "").replace(/^#/, "");
      st.dateText = txt(origDate);
    }
    var origPlace = first("origPlace");
    if (origPlace) {
      st.origPlaceRef = attr(origPlace, "ref");
      var op = txt(origPlace), m = op.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      if (m) { st.origPlace = m[1].trim(); st.province = m[2].trim(); } else { st.origPlace = op; }
    }
    var geo = first("geo");
    if (geo) { var g = txt(geo).split(/\s+/); st.lat = g[0] || ""; st.long = g[1] || ""; }
    var prov = first("provenance");
    if (prov) { st.provenanceType = attr(prov, "type"); st.provenanceText = txt(prov.getElementsByTagNameNS(NS, "p")[0]); }

    // editions
    var edition = divType("edition");
    var texts = [];
    if (edition) {
      var textparts = [];
      var kids = edition.childNodes;
      for (var k = 0; k < kids.length; k++) if (kids[k].nodeType === 1 && kids[k].localName === "div" && kids[k].getAttribute("type") === "textpart") textparts.push(kids[k]);
      if (textparts.length) {
        textparts.forEach(function (tp) {
          texts.push({ lang: tp.getAttribute("xml:lang") || "la", label: txt(tp.getElementsByTagNameNS(NS, "head")[0]), editionMode: "leiden", editionXml: innerAb(tp) });
        });
      } else {
        texts.push({ lang: edition.getAttribute("xml:lang") || "la", editionMode: "leiden", editionXml: innerAb(edition) });
      }
    }
    st.texts = texts.length ? texts : [{ lang: "la", editionMode: "leiden" }];

    // translations
    divsType("translation").forEach(function (t) {
      var lang = t.getAttribute("xml:lang"), ps = t.getElementsByTagNameNS(NS, "p");
      var body = []; for (var i = 0; i < ps.length; i++) body.push(txt(ps[i]));
      if (lang === "de") st.translationDe = body.join("\n\n"); else st.translationEn = body.join("\n\n");
    });
    // apparatus
    var apps = q("app"), appLines = [];
    for (var a = 0; a < apps.length; a++) { var loc = apps[a].getAttribute("loc"); appLines.push((loc ? loc + ": " : "") + txt(apps[a])); }
    if (appLines.length) st.apparatus = appLines.join("\n");
    // commentary
    var comm = divType("commentary"); if (comm) st.commentaryText = txt(comm.getElementsByTagNameNS(NS, "p")[0]);
    // bibliography
    var bibls = q("bibl"), bl = []; for (var b = 0; b < bibls.length; b++) bl.push(txt(bibls[b]));
    if (bl.length) st.bibliography = bl.join("\n");
    // licence
    var lic = first("licence"); if (lic) { st.licence = txt(lic); st.licenceTarget = attr(lic, "target"); }
    // revision
    var change = first("change"); if (change) { st.changeWhen = attr(change, "when"); st.changeWho = attr(change, "who"); st.changeNote = txt(change); }
    var rev = first("revisionDesc"); if (rev) st.status = attr(rev, "status");

    return st;
  }

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function showError(m) { listEl.innerHTML = '<div class="catalog-empty">' + esc(m) + "</div>"; }
  function toast(msg, err) { var e = document.getElementById("toast"); if (!e) return; e.textContent = msg; e.className = "show" + (err ? " toast-error" : ""); setTimeout(function () { e.className = ""; }, err ? 5000 : 2500); }
})();
