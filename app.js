/*
 * app.js — Roman inscription editor: schema-driven metadata form + the live
 * Leiden+/EpiDoc editor (jinn-epidoc-editor web component).
 *
 * Split-ownership model: the form/state owns all metadata; each text's
 * transcription is owned by a <jinn-epidoc-editor>, which converts Leiden+ to
 * EpiDoc XML live. Its converted fragment is captured into state.texts[i].editionXml
 * and injected verbatim by generator.js.
 */
(function () {
  "use strict";

  var TEI_NS = "http://www.tei-c.org/ns/1.0";

  var state = {
    authority: "simple-edep",
    langIdent: "la", langLabel: "Latin",
    status: "draft",
    licence: "CC BY 4.0", licenceTarget: "https://creativecommons.org/licenses/by/4.0/",
    texts: [{ lang: "la", editionMode: "leiden" }]
  };

  // ---- form schema -------------------------------------------------------
  var SECTIONS = [
    { title: "Identity & IDs", fields: [
      { key: "filename", label: "File name", ph: "rom_001" },
      { row2: [ { key: "titleEn", label: "Title (English)" },
                { key: "titleLa", label: "Heading (Latin)", ph: "D M" } ] },
      { key: "summary", label: "Short description", type: "textarea" },
      { key: "editor", label: "Editor" },
      { row: [ { key: "edh",  label: "EDH no.",  ph: "HD000001" },
               { key: "edcs", label: "EDCS no.", ph: "EDCS-0000001" },
               { key: "edr",  label: "EDR no.",  ph: "EDR000001" } ] },
      { row: [ { key: "tm",  label: "Trismegistos", ph: "TM no." },
               { key: "phi", label: "PHI no." },
               { key: "cil", label: "CIL / AE" } ] },
      { row2: [ { key: "wikidata", label: "Wikidata", ph: "Q12345" },
                { key: "idURI", label: "Stable URI", ph: "https://…" } ] }
    ]},
    { title: "Object & support", fields: [
      { row2: [ { key: "objectType", label: "Object type", type: "vocabRef", vocab: "OBJECT_TYPES", refKey: "objectTypeRef" },
                { key: "material",   label: "Material",    type: "vocabRef", vocab: "MATERIALS",    refKey: "materialRef" } ] },
      { row: [ { key: "heightCm", label: "Height (cm)", type: "number" },
               { key: "widthCm",  label: "Width (cm)",  type: "number" },
               { key: "depthCm",  label: "Depth (cm)",  type: "number" } ] },
      { row2: [ { key: "letterMin", label: "Letter h. min (cm)", type: "number" },
                { key: "letterMax", label: "Letter h. max (cm)", type: "number" } ] },
      { key: "condition", label: "Condition" }
    ]},
    { title: "Layout & lettering", fields: [
      { row2: [ { key: "layoutColumns", label: "Columns", type: "number" },
                { key: "layoutLines",   label: "Written lines", type: "number" } ] },
      { key: "layoutNote", label: "Layout note", type: "textarea" },
      { row2: [ { key: "script", label: "Script", type: "datalist", list: "SCRIPTS" },
                { key: "decoration", label: "Decoration / iconography" } ] }
    ]},
    { title: "Text type & dating", fields: [
      { key: "textType", label: "Text type", type: "vocabRef", vocab: "TEXT_TYPES", refKey: "textTypeRef" },
      { row: [ { key: "whenISO",   label: "Date (when)", ph: "0150" },
               { key: "notBefore", label: "Not before",  ph: "0100" },
               { key: "notAfter",  label: "Not after",   ph: "0200" } ] },
      { key: "datingMethod", label: "Dating method", type: "select", vocab: "DATING_METHODS" },
      { key: "dateText", label: "Date as expressed", ph: "e.g. under Antoninus Pius; cos. ..." },
      { row2: [ { key: "origPlace", label: "Ancient place", ph: "Mogontiacum" },
                { key: "province", label: "Roman province", type: "datalist", list: "PROVINCES" } ] },
      { key: "origPlaceRef", label: "Place URI (Pleiades / TM Geo)", ph: "https://pleiades.stoa.org/places/…" }
    ]},
    { title: "Find spot & provenance", fields: [
      { row: [ { key: "country", label: "Country" },
               { key: "region",  label: "Region" },
               { key: "settlement", label: "Settlement" } ] },
      { row2: [ { key: "lat",  label: "Latitude",  type: "number" },
                { key: "long", label: "Longitude", type: "number" } ] },
      { key: "provenanceType", label: "Provenance type", type: "select", vocab: "PROVENANCE_TYPES" },
      { key: "provenanceText", label: "Find circumstances", type: "textarea" },
      { row2: [ { key: "repository", label: "Repository" },
                { key: "inventory",  label: "Inventory no." } ] }
    ]},
    { title: "Transcription", custom: "texts" },
    { title: "Translation", fields: [
      { key: "translationEn", label: "Translation (English)", type: "textarea" },
      { key: "translationDe", label: "Translation (German)", type: "textarea" }
    ]},
    { title: "Apparatus & commentary", fields: [
      { key: "apparatus", label: "Apparatus (one per line — “line: note”)", type: "textarea", mono: true },
      { key: "commentaryText", label: "Commentary", type: "textarea" }
    ]},
    { title: "Bibliography", fields: [
      { key: "bibliography", label: "Bibliography (one reference per line)", type: "textarea" }
    ]},
    { title: "Publication & revision", fields: [
      { key: "licence", label: "Licence", type: "vocabRef", vocab: "LICENCES", refKey: "licenceTarget" },
      { key: "facsimileUrl", label: "Image URL (facsimile)", ph: "https://… .jpg" },
      { row2: [ { key: "changeWhen", label: "Date changed", ph: "2026-06-20" },
                { key: "changeWho", label: "Changed by" } ] },
      { key: "changeNote", label: "Revision note" },
      { key: "status", label: "Status", type: "select", options: [
          { value: "draft", label: "draft" }, { value: "reviewed", label: "reviewed" }, { value: "final", label: "final" } ] }
    ]}
  ];

  // ---- rendering ---------------------------------------------------------
  var formEl;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function render() {
    formEl.innerHTML = "";
    SECTIONS.forEach(function (sec) {
      formEl.appendChild(el("div", "section-title", sec.title));
      if (sec.custom === "texts") { renderTexts(); return; }
      sec.fields.forEach(function (f) {
        if (f.row || f.row2) {
          var wrap = el("div", "field " + (f.row2 ? "row2" : "row"));
          (f.row || f.row2).forEach(function (sub) { wrap.appendChild(fieldControl(sub, true)); });
          formEl.appendChild(wrap);
        } else {
          formEl.appendChild(fieldControl(f));
        }
      });
    });
  }

  function fieldControl(f, inRow) {
    var wrap = el("div", inRow ? "" : "field");
    wrap.appendChild(el("span", "label", f.label));
    var ctrl;
    if (f.type === "textarea") {
      ctrl = el("textarea" + (f.mono ? "" : ""));
      if (f.mono) ctrl.className = "mono";
      ctrl.value = state[f.key] || "";
    } else if (f.type === "select") {
      ctrl = document.createElement("select");
      ctrl.appendChild(opt("", "—"));
      var arr = f.vocab ? V[f.vocab] : f.options;
      arr.forEach(function (o) { ctrl.appendChild(opt(o.value, o.label)); });
      ctrl.value = state[f.key] || "";
    } else if (f.type === "vocabRef") {
      ctrl = document.createElement("select");
      ctrl.appendChild(opt("", "—"));
      V[f.vocab].forEach(function (o, i) { ctrl.appendChild(opt(String(i), o.en)); });
      // preselect by stored label
      var arr = V[f.vocab];
      for (var i = 0; i < arr.length; i++) if (arr[i].en === state[f.key]) ctrl.value = String(i);
      ctrl.addEventListener("change", function () {
        var o = arr[parseInt(ctrl.value, 10)];
        if (o) { state[f.key] = o.en; state[f.refKey] = o.ref; }
        else { state[f.key] = ""; state[f.refKey] = ""; }
        update();
      });
      wrap.appendChild(ctrl);
      return wrap;
    } else if (f.type === "datalist") {
      ctrl = document.createElement("input");
      var listId = "dl-" + f.key;
      ctrl.setAttribute("list", listId);
      ctrl.value = state[f.key] || "";
      var dl = document.createElement("datalist");
      dl.id = listId;
      V[f.list].forEach(function (s) { var o = document.createElement("option"); o.value = s; dl.appendChild(o); });
      wrap.appendChild(ctrl);
      wrap.appendChild(dl);
      bindInput(ctrl, f);
      return wrap;
    } else {
      ctrl = document.createElement("input");
      ctrl.type = f.type === "number" ? "number" : "text";
      if (f.ph) ctrl.placeholder = f.ph;
      ctrl.value = state[f.key] || "";
    }
    wrap.appendChild(ctrl);
    bindInput(ctrl, f);
    return wrap;
  }

  function bindInput(ctrl, f) {
    var ev = ctrl.tagName === "SELECT" ? "change" : "input";
    ctrl.addEventListener(ev, function () { state[f.key] = ctrl.value; update(); });
  }
  function opt(value, label) { var o = document.createElement("option"); o.value = value; o.textContent = label; return o; }

  // ---- texts (Leiden editors) -------------------------------------------
  function renderTexts() {
    state.texts.forEach(function (tx, i) {
      var box = el("div", "textblock");
      var head = el("div", "textblock-head");
      head.appendChild(el("span", null, "Text " + (i + 1) + (state.texts.length > 1 ? "" : "")));
      if (state.texts.length > 1) {
        var rm = el("button", "btn small", "Remove");
        rm.type = "button";
        rm.addEventListener("click", function () { state.texts.splice(i, 1); render(); update(); });
        head.appendChild(rm);
      }
      box.appendChild(head);

      // optional face/locus label for multi-text objects
      var lf = el("div", "field");
      lf.appendChild(el("span", "label", "Face / locus (optional)"));
      var li = document.createElement("input");
      li.value = tx.label || ""; li.placeholder = "e.g. front, side a";
      li.addEventListener("input", function () { tx.label = li.value; update(); });
      lf.appendChild(li);
      box.appendChild(lf);

      box.appendChild(renderEditionEditor(tx, i));
      formEl.appendChild(box);
    });
    var add = el("button", "btn", "+ Add another text / face");
    add.id = "btn-add-text"; add.type = "button";
    add.addEventListener("click", function () { state.texts.push({ lang: "la", editionMode: "leiden" }); render(); update(); });
    formEl.appendChild(add);
  }

  function renderEditionEditor(tx, i) {
    var w = el("div", "field edition-editor");
    var bar = el("div", "edition-mode-bar");
    bar.appendChild(el("span", "label", "Transcription — Leiden+ → EpiDoc"));
    var toggle = el("button", "btn small", tx.editionMode === "plain" ? "Switch to Leiden+ editor" : "Switch to plain text");
    toggle.type = "button";
    toggle.addEventListener("click", function () {
      if (tx.editionMode === "plain") { tx.editionMode = "leiden"; }
      else { tx.editionMode = "plain"; tx.editionText = plainFromXml(tx.editionXml) || tx.editionText || ""; tx.editionXml = ""; }
      render(); update();
    });
    bar.appendChild(toggle);
    w.appendChild(bar);

    if (tx.editionMode === "plain") {
      var ta = el("textarea", "mono");
      ta.placeholder = "One source line per line; <lb/> added automatically.";
      ta.value = tx.editionText || "";
      ta.style.minHeight = "8rem";
      ta.addEventListener("input", function () { tx.editionText = ta.value; tx.editionXml = ""; update(); });
      w.appendChild(ta);
      return w;
    }

    var ed = document.createElement("jinn-epidoc-editor");
    ed.id = "edition-editor-" + i;
    ed.setAttribute("mode", "leiden_plus");
    ed.setAttribute("mode-select", "");
    ed.setAttribute("show-leiden", "");
    ed.setAttribute("unwrap", "");
    ed.appendChild(leidenToolbar());
    ed.appendChild(xmlToolbar());

    // Fullscreen / distraction-free editing (upstream edep #39)
    var fs = el("button", "btn small", "⤢ Fullscreen");
    fs.type = "button";
    fs.addEventListener("click", function () { toggleFullscreen(ed, fs); });
    bar.appendChild(fs);

    // Direct XML-pane edits re-dispatch the component's own 'update' (Element).
    ed.addEventListener("update", function (e) {
      var s = captureEdition(e.detail && e.detail.content);
      if (s) { tx.editionXml = s; update(); }
    });
    w.appendChild(ed);

    // The Leiden→EpiDoc conversion surfaces on the INNER leiden editor's
    // 'update' event (the component suppresses re-emission when it sets its own
    // XML). Capture it there — this is the live source of truth. The inner
    // editor is created asynchronously, so poll until it (and its view) exist.
    whenLeidenReady(ed, function (leiden) {
      tx._leiden = leiden || null;
      if (!leiden) return;
      leiden.addEventListener("update", function (e) {
        tx.editionXml = captureEdition(e.detail && e.detail.content);
        update();
      });
      hydrateEditor(leiden, tx);
    });
    return w;
  }

  function whenLeidenReady(ed, cb) {
    // Poll with setTimeout (NOT requestAnimationFrame — rAF is paused in
    // backgrounded/headless tabs). The inner leiden editor and its CodeMirror
    // view are created asynchronously by the component.
    var go = function () {
      var tries = 0;
      (function poll() {
        var leiden = ed.shadowRoot && ed.shadowRoot.querySelector("jinn-codemirror");
        if (leiden && leiden._editor) { cb(leiden); return; }
        if (tries++ > 200) { cb(leiden || null); return; }
        setTimeout(poll, 40);
      })();
    };
    if (window.customElements) customElements.whenDefined("jinn-epidoc-editor").then(go);
    else setTimeout(go, 50);
  }

  // Load an existing edition into the Leiden editor (XML → Leiden+, async).
  // Pass the whole <ab> ELEMENT (not childNodes): the component's xml2leidenPlus
  // returns '' for non-Element nodes, so passing a NodeList drops all text
  // nodes. Passing the <ab> element walks the full subtree. It renders as a
  // "<= … =>" section wrapper, which we strip once converted (the component
  // re-wraps bare content in <ab> on its own).
  function toggleFullscreen(ed, btn) {
    var on = ed.classList.toggle("editor-fullscreen");
    document.body.classList.toggle("has-fullscreen-editor", on);
    if (btn) btn.textContent = on ? "⤢ Exit fullscreen" : "⤢ Fullscreen";
    ensureFsHint();
    if (on) { try { var leiden = ed.shadowRoot && ed.shadowRoot.querySelector("jinn-codemirror"); if (leiden && leiden._editor) leiden._editor.focus(); } catch (e) {} }
  }
  function exitFullscreen() {
    var f = document.querySelector("jinn-epidoc-editor.editor-fullscreen");
    if (!f) return false;
    f.classList.remove("editor-fullscreen");
    document.body.classList.remove("has-fullscreen-editor");
    return true;
  }
  function ensureFsHint() {
    if (document.querySelector(".edition-fs-hint")) return;
    document.body.appendChild(el("div", "edition-fs-hint", "Press Esc to exit fullscreen"));
  }

  function hydrateEditor(leiden, tx) {
    if (!leiden) return;
    if (tx.editionXml && tx.editionXml.trim()) {
      var ab = parseAbElement(tx.editionXml);
      if (ab) {
        try {
          leiden.value = ab;
          // strip the <= … => ab markers after the async content set applies
          setTimeout(function () { stripAbMarkers(leiden); }, 120);
          setTimeout(function () { stripAbMarkers(leiden); }, 360);
        } catch (e) {}
      }
    } else if (tx.editionText) {
      try { leiden.content = tx.editionText; } catch (e) {}
    }
  }
  function stripAbMarkers(leiden) {
    try {
      var view = leiden._editor;
      if (!view) return;
      var doc = view.state.doc.toString();
      var stripped = doc.replace(/^\s*<=\s*/, "").replace(/\s*=>\s*$/, "");
      if (stripped !== doc) view.dispatch({ changes: { from: 0, to: doc.length, insert: stripped } });
    } catch (e) {}
  }
  function parseAbElement(frag) {
    var doc = new DOMParser().parseFromString('<ab xmlns="' + TEI_NS + '">' + frag + "</ab>", "application/xml");
    return doc.getElementsByTagName("parsererror").length ? null : doc.documentElement;
  }
  // Normalize whatever the editor hands back (string '<ab>…</ab>' or DOM) to the
  // inner-<ab> EpiDoc XML string the generator injects.
  function captureEdition(content) {
    if (content == null) return "";
    if (typeof content === "string") {
      var s = content.trim();
      if (!s) return "";
      var xmlStr = s.indexOf("xmlns") >= 0 ? s : s.replace(/^<ab>/, '<ab xmlns="' + TEI_NS + '">');
      var doc = new DOMParser().parseFromString(xmlStr, "application/xml");
      if (doc.getElementsByTagName("parsererror").length) return clean(s);
      return innerEditionXml(doc.documentElement, new XMLSerializer());
    }
    return serializeEditionDetail({ content: content });
  }

  function tbBtn(cmd, params, mode, label, title) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("data-command", cmd);
    if (params != null) b.setAttribute("data-params", params);
    if (mode) b.setAttribute("data-mode", mode);
    if (title) b.title = title;
    b.textContent = label;
    return b;
  }
  function leidenToolbar() {
    var h = document.createElement("h5"); h.setAttribute("slot", "leiden-header"); h.textContent = "Leiden+";
    var bar = document.createElement("div"); bar.setAttribute("slot", "leiden-toolbar");
    [
      tbBtn("expan", null, "leiden_plus", "(a(bc))", "Expand abbreviation → <expan>"),
      tbBtn("snippet", "($|_|)", "leiden_plus", "( )", "Abbreviation parentheses"),
      tbBtn("snippet", "[$|_|]", "leiden_plus", "[ ]", "Lost / supplied [ … ]"),
      tbBtn("snippet", "<$|_|>", "leiden_plus", "< >", "Editorial addition < … >"),
      tbBtn("snippet", "{$|_|}", "leiden_plus", "{ }", "Superfluous { … }"),
      tbBtn("erasure", null, "leiden_plus", "〚 〛", "Erasure (rasura)"),
      tbBtn("unclear", null, "leiden_plus", "ạ", "Unclear (underdot)"),
      tbBtn("snippet", "[.$|1:3|]", "leiden_plus", "[.n]", "Gap, n lost characters"),
      tbBtn("fixNewlines", null, "leiden_plus", "↩", "Add missing line numbers")
    ].forEach(function (b) { bar.appendChild(b); });
    var sep = document.createElement("span"); sep.className = "sep"; bar.appendChild(sep);
    var imp1 = tbBtn("convert", null, "edcs", "Import EDCS", "Paste EDCS text, then click to convert to Leiden+");
    var imp2 = tbBtn("convert", null, "phi", "Import PHI", "Paste PHI text, then click to convert to Leiden+");
    bar.appendChild(imp1); bar.appendChild(imp2);
    var frag = document.createDocumentFragment(); frag.appendChild(h); frag.appendChild(bar);
    return frag;
  }
  function xmlToolbar() {
    var h = document.createElement("h5"); h.setAttribute("slot", "xml-header"); h.textContent = "EpiDoc XML";
    var bar = document.createElement("div"); bar.setAttribute("slot", "xml-toolbar");
    [
      tbBtn("selectElement", null, null, "<|>", "Select element at cursor"),
      tbBtn("encloseWith", null, null, "<…>", "Enclose selection in element"),
      tbBtn("removeEnclosing", null, null, "<x>", "Remove enclosing tags"),
      tbBtn("snippet", '<supplied reason="lost">$|_|</supplied>', null, "supplied", "Insert <supplied>"),
      tbBtn("snippet", "<expan><abbr>$|1|</abbr><ex>$|_|</ex></expan>", null, "expan", "Insert <expan>"),
      tbBtn("snippet", '<gap reason="lost" quantity="$|1|" unit="character"/>', null, "gap", "Insert <gap>")
    ].forEach(function (b) { bar.appendChild(b); });
    var frag = document.createDocumentFragment(); frag.appendChild(h); frag.appendChild(bar);
    return frag;
  }

  // ---- web-component glue ------------------------------------------------
  // serialize an 'update' detail (or a value getter) to the inner-<ab> XML string
  function serializeEditionDetail(detail) {
    var content = detail && detail.content !== undefined ? detail.content : detail;
    if (content == null) return "";
    var ser = new XMLSerializer();
    if (content.nodeType) return innerEditionXml(content, ser);
    if (typeof content.length === "number") {
      var out = "";
      for (var k = 0; k < content.length; k++) out += ser.serializeToString(content[k]);
      return clean(out);
    }
    return clean(String(content));
  }
  function innerEditionXml(node, ser) {
    var name = node.localName;
    if (name === "div") {
      var ab = node.getElementsByTagName("ab")[0] || node.getElementsByTagNameNS(TEI_NS, "ab")[0];
      if (ab) return serializeChildren(ab, ser);
      return serializeChildren(node, ser);
    }
    if (name === "ab") return serializeChildren(node, ser);
    if (node.nodeType === 11) return serializeChildren(node, ser); // fragment
    return clean(ser.serializeToString(node));
  }
  function serializeChildren(node, ser) {
    var out = "";
    for (var n = node.firstChild; n; n = n.nextSibling) out += ser.serializeToString(n);
    return clean(out);
  }
  function clean(xml) { return String(xml).replace(/\s+xmlns="http:\/\/www\.tei-c\.org\/ns\/1\.0"/g, ""); }

  function plainFromXml(xml) {
    if (!xml) return "";
    var doc = new DOMParser().parseFromString('<ab xmlns="' + TEI_NS + '">' + xml + "</ab>", "application/xml");
    if (doc.getElementsByTagName("parsererror").length) return "";
    var lines = [], cur = "";
    (function walk(node) {
      for (var n = node.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 1 && n.localName === "lb") { if (cur.trim()) lines.push(cur.trim()); cur = ""; }
        else if (n.nodeType === 3) cur += n.nodeValue;
        else if (n.nodeType === 1) walk(n);
      }
    })(doc.documentElement);
    if (cur.trim()) lines.push(cur.trim());
    return lines.join("\n");
  }

  function syncEditionsFromComponents() {
    // The inner-leiden 'update' listener keeps tx.editionXml fresh; this is a
    // last-resort fill only when the listener hasn't captured anything yet.
    state.texts.forEach(function (tx, i) {
      if (tx.editionMode === "plain") return;
      if (tx.editionXml && tx.editionXml.trim()) return;
      var ed = document.getElementById("edition-editor-" + i);
      if (!ed) return;
      try { var v = ed.value; if (v != null) { var s = serializeEditionDetail({ content: v }); if (s) tx.editionXml = s; } }
      catch (e) {}
    });
  }

  // ---- output ------------------------------------------------------------
  var _view = "xml";
  function cleanState() {
    var d = {};
    Object.keys(state).forEach(function (k) { if (k[0] !== "_") d[k] = state[k]; });
    return d;
  }
  function build() { return EpiDocGen.buildEpiDoc(cleanState()); }

  function update() {
    var xml = build();
    document.getElementById("out").textContent = xml;
    var v = document.getElementById("validity");
    var doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) { v.textContent = "✗ not well-formed"; v.className = "validity bad"; }
    else { v.textContent = "✓ well-formed"; v.className = "validity ok"; }
    if (_view === "read") {
      var rd = document.getElementById("preview-read");
      if (rd && window.EpiDocReader) rd.innerHTML = EpiDocReader.render(xml);
    }
    refreshSaveTarget();
  }

  function refreshSaveTarget() {
    var t = document.getElementById("save-target");
    if (!t || !window.EpiGitHub) return;
    var s = EpiGitHub.getSettings();
    t.textContent = s.owner + "/" + s.repo + " · " + (s.path || "records/");
  }

  // ---- example & reset ---------------------------------------------------
  function example() {
    state = {
      authority: "simple-edep", langIdent: "la", langLabel: "Latin", status: "draft",
      licence: "CC BY 4.0", licenceTarget: "https://creativecommons.org/licenses/by/4.0/",
      filename: "demo_altar",
      titleEn: "Funerary altar of Iulia Secunda",
      titleLa: "D M",
      summary: "Marble funerary altar dedicated to the Manes of Iulia Secunda.",
      editor: "simple-edep",
      edh: "HD000000", cil: "CIL XIII 0000",
      objectType: "Altar", objectTypeRef: "https://www.eagle-network.eu/voc/typeobject/lod/2.html",
      material: "Marble", materialRef: "http://vocab.getty.edu/aat/300011443",
      heightCm: "78", widthCm: "42", depthCm: "30",
      letterMin: "2", letterMax: "3.5",
      condition: "Intact, lightly weathered.",
      layoutColumns: "1", layoutLines: "5", layoutNote: "Five lines, centred on the front face.",
      script: "Capitalis monumentalis",
      textType: "Epitaph (funerary)", textTypeRef: "https://www.eagle-network.eu/voc/typeins/lod/92.html",
      whenISO: "0150", notBefore: "0100", notAfter: "0200",
      datingMethod: "lettering", dateText: "2nd century CE (letter forms).",
      origPlace: "Mogontiacum", province: "Germania Superior",
      origPlaceRef: "https://pleiades.stoa.org/places/109169",
      country: "Germany", region: "Rheinland-Pfalz", settlement: "Mainz",
      lat: "49.9929", long: "8.2473",
      provenanceType: "found", provenanceText: "Found re-used in the late-antique city wall.",
      repository: "Landesmuseum Mainz", inventory: "S 137",
      texts: [{ lang: "la", editionMode: "leiden",
        editionXml: '<lb n="1"/><expan><abbr>D</abbr></expan> <expan><abbr>M</abbr></expan>\n' +
                    '<lb n="2"/>Iulia\n<lb n="3"/>Secunda\n<lb n="4"/>vixit ann<supplied reason="lost">is</supplied>\n' +
                    '<lb n="5"/><expan><abbr>h</abbr><ex>ic</ex></expan> <expan><abbr>s</abbr><ex>ita</ex></expan> <expan><abbr>e</abbr><ex>st</ex></expan>' }],
      translationEn: "To the Spirits of the Departed. Iulia Secunda lived [..] years. She lies here.",
      apparatus: "4: ANN for ann(is)",
      commentaryText: "A standard provincial funerary formula (D M … h s e).",
      bibliography: "CIL XIII 0000\nAE 2026, 1",
      changeWhen: today(), status: "draft", changeNote: "Demo record."
    };
    render(); update();
  }
  function today() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return ""; } }

  function reset() {
    state = { authority: "simple-edep", langIdent: "la", langLabel: "Latin", status: "draft",
      licence: "CC BY 4.0", licenceTarget: "https://creativecommons.org/licenses/by/4.0/",
      texts: [{ lang: "la", editionMode: "leiden" }] };
    render(); update();
  }

  // ---- round-trip from catalog ------------------------------------------
  function preloadFromSession() {
    var raw0 = sessionStorage.getItem("edep_preload");
    if (!raw0) return false;
    sessionStorage.removeItem("edep_preload");
    try {
      var loaded = JSON.parse(raw0);
      state = Object.assign({ authority: "simple-edep", status: "draft", texts: [{ lang: "la", editionMode: "leiden" }] }, loaded);
      if (!state.texts || !state.texts.length) state.texts = [{ lang: "la", editionMode: "leiden" }];
      state.texts.forEach(function (tx) { if (!tx.editionMode) tx.editionMode = "leiden"; });
      render(); update();
      return true;
    } catch (e) { return false; }
  }

  // ---- buttons -----------------------------------------------------------
  function wire() {
    document.getElementById("btn-example").addEventListener("click", example);
    document.getElementById("btn-reset").addEventListener("click", reset);
    document.getElementById("btn-gh-settings").addEventListener("click", function () { EpiGitHub.showSettings(); });
    document.getElementById("btn-copy").addEventListener("click", function () {
      syncEditionsFromComponents();
      var xml = build();
      navigator.clipboard.writeText(xml).then(function () { toast("XML copied"); }, function () { toast("Copy failed", true); });
    });
    document.getElementById("btn-download").addEventListener("click", function () {
      syncEditionsFromComponents();
      var xml = build(), name = (state.filename || "inscription").replace(/\.xml$/i, "") + ".xml";
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
      a.download = name; a.click(); URL.revokeObjectURL(a.href);
    });
    document.getElementById("btn-save-github").addEventListener("click", function () {
      if (window.EpiAuth && !EpiAuth.isSignedIn()) { window.location.href = "login.html?r=" + encodeURIComponent(location.href); return; }
      syncEditionsFromComponents();
      EpiGitHub.save(build(), state.filename || "inscription");
    });
    document.getElementById("btn-view-xml").addEventListener("click", function () { setView("xml"); });
    document.getElementById("btn-view-read").addEventListener("click", function () { setView("read"); });
  }
  function setView(v) {
    _view = v;
    document.getElementById("btn-view-xml").classList.toggle("active", v === "xml");
    document.getElementById("btn-view-read").classList.toggle("active", v === "read");
    document.getElementById("preview-xml").style.display = v === "xml" ? "" : "none";
    document.getElementById("preview-read").style.display = v === "read" ? "" : "none";
    update();
  }
  function toast(msg, err) {
    var elx = document.getElementById("toast");
    if (!elx) return;
    elx.textContent = msg; elx.className = "show" + (err ? " toast-error" : "");
    setTimeout(function () { elx.className = ""; }, err ? 5000 : 2500);
  }

  // ---- init --------------------------------------------------------------
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") exitFullscreen();
  });

  document.addEventListener("DOMContentLoaded", function () {
    formEl = document.getElementById("form");
    wire();
    if (!preloadFromSession()) { render(); update(); }
  });
})();
