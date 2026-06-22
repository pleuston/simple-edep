/* people.js — register of persons from the EDH collection (edh_data_pers).
 * Filterable by individual name components, sex, social state, and occupation. */
(function () {
  "use strict";
  var listEl, pagerEl, PEOPLE = [], RENDERED = [], PAGE = 0, PER = 60;
  var fPraenomen, fNomen, fCognomen, fSupernomen, fTribus, fOrigo, fSex, fStatus, fRole;

  document.addEventListener("DOMContentLoaded", function () {
    listEl    = document.getElementById("ppl-list");
    pagerEl   = document.getElementById("ppl-count");
    fPraenomen  = document.getElementById("ppl-praenomen");
    fNomen      = document.getElementById("ppl-nomen");
    fCognomen   = document.getElementById("ppl-cognomen");
    fSupernomen = document.getElementById("ppl-supernomen");
    fTribus     = document.getElementById("ppl-tribus");
    fOrigo      = document.getElementById("ppl-origo");
    fSex        = document.getElementById("ppl-sex");
    fStatus     = document.getElementById("ppl-status");
    fRole       = document.getElementById("ppl-role");

    var dt;
    function rerender() { PAGE = 0; render(); }
    function debounced() { clearTimeout(dt); dt = setTimeout(rerender, 180); }

    [fPraenomen, fNomen, fCognomen, fSupernomen, fOrigo].forEach(function (el) {
      el.addEventListener("input", debounced);
    });
    [fTribus, fSex, fStatus, fRole].forEach(function (el) {
      el.addEventListener("change", rerender);
    });

    document.getElementById("ppl-reset").addEventListener("click", function () {
      [fPraenomen, fNomen, fCognomen, fSupernomen, fOrigo].forEach(function (el) { el.value = ""; });
      [fTribus, fSex, fStatus, fRole].forEach(function (el) { el.value = ""; });
      rerender();
    });

    // person name button → open detail in right panel
    listEl.addEventListener("click", function (ev) {
      if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      var nbtn = ev.target.closest ? ev.target.closest("button.ppl-name") : null;
      if (nbtn) {
        var idx = parseInt(nbtn.getAttribute("data-ppl"), 10);
        if (!isNaN(idx)) openPersonPanel(RENDERED[idx], nbtn.closest(".ppl-row"));
      }
    });

    // inscription links inside the right panel → load inscription
    document.addEventListener("click", function (ev) {
      if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      var a = ev.target.closest ? ev.target.closest('#rec-panel a[href^="viewer.html"]') : null;
      if (!a) return;
      ev.preventDefault();
      var u = new URL(a.getAttribute("href"), location.href);
      var id  = (u.searchParams.get("id")  || "").replace(/[^A-Za-z0-9_\-.]/g, "");
      var col = (u.searchParams.get("col") || "edh").replace(/[^a-z]/g, "");
      RecordPanel.open(id, col, {});
    });

    listEl.innerHTML = '<div class="catalog-loading">Loading the persons register…</div>';
    EpiCollections.getJSON(EpiCollections.get("edh").people)
      .then(function (p) {
        PEOPLE = (p || []).sort(byName);
        populateFilters();
        render();
      })
      .catch(function () {
        listEl.innerHTML = '<div class="catalog-empty">Could not load the persons register.</div>';
      });
  });

  function byName(a, b) { return (a.name || "").localeCompare(b.name || ""); }

  var TRIBUS_LABEL = {
    AEM: "Aemilia",  AEL: "Aelia",    ANI: "Aniensis",  ARN: "Arnensis",
    CAM: "Camilia",  CLA: "Claudia",  CLU: "Clustumina",COL: "Collina",
    COR: "Cornelia", ESQ: "Esquilina",FAB: "Fabia",      FAL: "Falerna",
    GAL: "Galeria",  HOR: "Horatia",  LEM: "Lemonia",   MAE: "Maecia",
    MEN: "Menenia",  OUF: "Oufentina",PAL: "Palatina",  PAP: "Papiria",
    POL: "Pollia",   POM: "Pomptina", POP: "Poplilia",  PUB: "Publilia",
    PUP: "Pupinia",  QUI: "Quirina",  ROM: "Romilia",   SAB: "Sabatina",
    SCA: "Scaptia",  SER: "Sergia",   STE: "Stellatina",SUC: "Succusana",
    TER: "Teretina", TRO: "Tromentina",ULP: "Ulpia",    VEL: "Velina",
    VOL: "Voltinia", VOT: "Voturia"
  };

  var STATUS_LABEL = {
    "0": "unknown", "0?": "unknown (?)",
    "1": "ingenuus/a", "1?": "ingenuus/a (?)", "1*": "ingenuus/a (attr.)",
    "2": "libertus/a", "2?": "libertus/a (?)", "2*": "libertus/a (attr.)",
    "3": "servus/a",   "3?": "servus/a (?)",   "3*": "servus/a (attr.)",
    "4": "peregrinus/a","4?": "peregrinus/a (?)","5": "civis Latinus/a",
    "6": "miles",      "6?": "miles (?)",       "6*": "miles (attr.)",
    "7": "eques",      "7?": "eques (?)",       "7*": "eques (attr.)",
    "8": "senatorial order", "9": "not specified", "9?": "not specified (?)"
  };

  var SEX_LABEL = { M: "Male", W: "Female", F: "Female", "M?": "Male (uncertain)", "W?": "Female (uncertain)" };

  /* funktion: Amtsträger / Berufstätige / Kultpersonal / Dienstpersonal
     beruf: J = "Ja, Beruf genannt" (occupation documented in inscription) */
  var ROLE_LABEL = {
    "A": "officeholder (Amtsträger)",
    "A*": "officeholder, attr. (A*)",
    "A*?": "officeholder, attr. uncertain (A*?)",
    "A?": "officeholder, uncertain (A?)",
    "A+": "officeholder + (A+)",
    "B": "professional worker (Berufstätiger)",
    "B*": "professional, attr. (B*)",
    "B?": "professional, uncertain (B?)",
    "C": "cult/religious (Kultpersonal)",
    "C*": "cult/religious, attr. (C*)",
    "C?": "cult/religious, uncertain (C?)",
    "D": "domestic staff (Dienstpersonal)",
    "AC": "officeholder + cult (AC)",
    "A*C*": "officeholder + cult, attr. (A*C*)",
    "A?C": "officeholder (?) + cult (A?C)",
    "J": "occupation documented",
    "J?": "occupation possibly documented (J?)"
  };

  function populateFilters() {
    var tribes = {}, sexes = {}, statuses = {}, roles = {};
    PEOPLE.forEach(function (p) {
      if (p.tribus)  tribes[p.tribus]    = true;
      if (p.gender)  sexes[p.gender]     = true;
      if (p.status)  statuses[p.status]  = true;
      if (p.role)    roles[p.role]       = true;
    });
    fill(fTribus, Object.keys(tribes).sort(), function (v) { return TRIBUS_LABEL[v] ? TRIBUS_LABEL[v] + " (" + v + ")" : v; });
    fill(fSex,    Object.keys(sexes).sort(),  function (v) { return SEX_LABEL[v] || v; });
    fill(fStatus, Object.keys(statuses).sort(statusSort), statusLabel);
    fill(fRole,   Object.keys(roles).sort(), function (v) { return ROLE_LABEL[v] || v; });
  }

  function statusSort(a, b) {
    var ai = parseInt(a, 10), bi = parseInt(b, 10);
    if (!isNaN(ai) && !isNaN(bi)) return ai - bi;
    return a.localeCompare(b);
  }

  function statusLabel(v) {
    if (STATUS_LABEL[v]) return STATUS_LABEL[v] + " (" + v + ")";
    var stripped = v.replace(/[*?]/g, "");
    if (stripped.length >= 2 && /^\d+$/.test(stripped)) {
      var parts = stripped.split("").map(function (d) { return STATUS_LABEL[d] || d; });
      return parts.join(" + ") + " (" + v + ")";
    }
    return v;
  }

  function fill(sel, vals, labelFn) {
    vals.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v; o.textContent = labelFn ? labelFn(v) : v;
      sel.appendChild(o);
    });
  }

  function sub(field, val) {
    if (!val) return true;
    return (field || "").toLowerCase().indexOf(val.toLowerCase()) !== -1;
  }

  function matches(p) {
    if (!sub(p.praenomen,  fPraenomen.value.trim()))  return false;
    if (!sub(p.nomen,      fNomen.value.trim()))      return false;
    if (!sub(p.cognomen,   fCognomen.value.trim()))   return false;
    if (!sub(p.supernomen, fSupernomen.value.trim())) return false;
    if (!sub(p.origo,      fOrigo.value.trim()))      return false;
    if (fTribus.value && p.tribus  !== fTribus.value)  return false;
    if (fSex.value    && p.gender  !== fSex.value)     return false;
    if (fStatus.value && p.status  !== fStatus.value)  return false;
    if (fRole.value   && p.role    !== fRole.value)    return false;
    return true;
  }

  function render() {
    var rows = PEOPLE.filter(matches);
    var total = rows.length, pages = Math.max(1, Math.ceil(total / PER));
    if (PAGE >= pages) PAGE = 0;
    if (!total) {
      listEl.innerHTML = '<div class="catalog-empty">No people match the current filters.</div>';
      pagerEl.innerHTML = ""; return;
    }
    RENDERED = rows.slice(PAGE * PER, PAGE * PER + PER);
    listEl.innerHTML = '<div class="ppl-list">' +
      RENDERED.map(rowHtml).join("") +
      '</div>';
    renderPager(total, pages);
  }

  function rowHtml(p, i) {
    var parts = [p.praenomen, p.nomen, p.cognomen, p.supernomen].filter(Boolean);
    var nameParts = parts.length ? parts.join(" ") : p.name;
    var chips = [p.origo, genderLabel(p.gender)].filter(Boolean).join(" · ");
    var nameHtml = '<button class="ppl-name" data-ppl="' + i + '">' + esc(nameParts) + '</button>';
    var tags = "";
    if (p.hd) {
      tags += '<a class="catalog-tag ppl-hd" href="viewer.html?id=' + encodeURIComponent(p.hd) + '&col=edh">' + esc(p.hd) + "</a>";
    }
    if (p.pir) tags += '<span class="catalog-tag">PIR ' + esc(p.pir) + "</span>";
    return '<div class="ppl-row">' + nameHtml +
      (chips ? '<span class="ppl-chips">' + esc(chips) + "</span>" : "") +
      (tags ? '<span class="ppl-tags">' + tags + "</span>" : "") +
      "</div>";
  }

  function openPersonPanel(p, row) {
    if (!p) return;
    // highlight row
    Array.prototype.forEach.call(listEl.querySelectorAll(".ppl-row.selected"), function (r) { r.classList.remove("selected"); });
    if (row) row.classList.add("selected");

    var panel = document.getElementById("rec-panel");
    var tb = document.querySelector(".topbar");
    if (!panel) return;
    panel.style.top = (tb ? tb.offsetHeight : 56) + "px";

    // header
    var idEl = document.getElementById("rp-id");
    if (idEl) idEl.textContent = p.name || "";

    // fav — not applicable for persons
    var favEl = document.getElementById("rp-fav");
    if (favEl) favEl.innerHTML = "";

    // "Open full" → inscription viewer
    var fullEl = document.getElementById("rp-full");
    if (fullEl) {
      if (p.hd) { fullEl.href = "viewer.html?id=" + encodeURIComponent(p.hd) + "&col=edh"; fullEl.style.display = ""; }
      else fullEl.style.display = "none";
    }

    // clear image/map areas
    ["rp-image", "rp-thumbs", "rp-credit", "rp-map"].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.innerHTML = "";
    });

    // person detail content
    var readEl = document.getElementById("rp-reading");
    if (readEl) readEl.innerHTML = personDetailHtml(p);

    panel.classList.add("open"); panel.setAttribute("aria-hidden", "false");
    document.body.classList.add("rp-open");
  }

  function personDetailHtml(p) {
    var fields = [];
    if (p.praenomen)  fields.push(["Praenomen",  p.praenomen]);
    if (p.nomen)      fields.push(["Nomen",       p.nomen]);
    if (p.cognomen)   fields.push(["Cognomen",    p.cognomen]);
    if (p.supernomen) fields.push(["Supernomen",  p.supernomen]);
    if (p.filiation)  fields.push(["Filiation",   p.filiation]);
    if (p.tribus)     fields.push(["Tribus",      TRIBUS_LABEL[p.tribus] || p.tribus]);
    if (p.origo)      fields.push(["Origo",       p.origo]);
    if (p.gender)     fields.push(["Sex",         SEX_LABEL[p.gender] || p.gender]);
    if (p.status)     fields.push(["Status",      statusLabel(p.status)]);
    if (p.role)       fields.push(["Role",        ROLE_LABEL[p.role] || p.role]);
    if (p.age)        fields.push(["Age",         p.age]);
    if (p.pir)        fields.push(["PIR",         p.pir]);
    var dl = fields.length ? '<dl class="ppl-detail-dl">' +
      fields.map(function (f) { return "<dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd>"; }).join("") +
      "</dl>" : "";
    var actions = [];
    if (p.hd) {
      var q = "id=" + encodeURIComponent(p.hd) + "&col=edh";
      actions.push('<a class="btn small" href="viewer.html?' + q + '">Open inscription ' + esc(p.hd) + " →</a>");
      if (window.EpiAuth && EpiAuth.isSignedIn()) {
        actions.push('<a class="btn small" href="editor.html?' + q + '">Edit</a>');
      }
    }
    if (p.uri) {
      actions.push('<a class="btn small" href="' + esc(p.uri) + '" target="_blank" rel="noopener">External link ↗</a>');
    }
    return dl + (actions.length ? '<div class="ppl-detail-actions">' + actions.join("") + "</div>" : "");
  }

  function genderLabel(g) { return g === "M" ? "male" : g === "W" || g === "F" ? "female" : ""; }

  function renderPager(total, pages) {
    function btn(pg, label, on, dis) {
      return '<button data-pg="' + pg + '"' + (on ? ' class="on"' : "") + (dis ? " disabled" : "") + ">" + label + "</button>";
    }
    var html = "";
    if (pages > 1) {
      html += btn("first", "|&lt;", false, PAGE === 0) + btn(Math.max(0, PAGE - 1), "&lt;", false, PAGE === 0);
      var start = Math.max(0, PAGE - 2), end = Math.min(pages - 1, PAGE + 2);
      if (start > 0) html += '<span class="reg-ell">…</span>';
      for (var i = start; i <= end; i++) html += btn(i, i + 1, i === PAGE, false);
      if (end < pages - 1) html += '<span class="reg-ell">…</span>';
      html += btn(Math.min(pages - 1, PAGE + 1), "&gt;", false, PAGE === pages - 1) + btn("last", "&gt;|", false, PAGE === pages - 1);
    }
    html += '<span class="register-count">' +
      (pages > 1 ? "Page " + (PAGE + 1) + " / " + pages + " · " : "") +
      total.toLocaleString() + " people</span>";
    pagerEl.innerHTML = html;
    Array.prototype.forEach.call(pagerEl.querySelectorAll("button[data-pg]"), function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-pg");
        PAGE = v === "first" ? 0 : v === "last" ? pages - 1 : parseInt(v, 10);
        render(); window.scrollTo(0, 0);
      });
    });
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
