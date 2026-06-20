/* bibliography.js — searchable, paginated bibliography from data/bibliography.json
 * (imported from the EDH BibTeX export, CC BY-SA). */
(function () {
  "use strict";
  var listEl, searchEl, pagerEl, ENTRIES = [], PAGE = 0, PER = 25;

  document.addEventListener("DOMContentLoaded", function () {
    listEl = document.getElementById("bib-list");
    searchEl = document.getElementById("bib-search");
    pagerEl = document.getElementById("bib-pager");
    searchEl.addEventListener("input", function () { PAGE = 0; render(); });
    fetch("data/bibliography.json").then(function (r) { return r.ok ? r.json() : []; })
      .then(function (b) { ENTRIES = b || []; render(); })
      .catch(function () { listEl.innerHTML = '<div class="catalog-empty">Could not load the bibliography.</div>'; });
  });

  function render() {
    var q = (searchEl.value || "").toLowerCase().trim();
    var rows = !q ? ENTRIES : ENTRIES.filter(function (e) {
      return (e.author + " " + e.title + " " + e.journal + " " + e.year).toLowerCase().indexOf(q) !== -1;
    });
    var total = rows.length, pages = Math.max(1, Math.ceil(total / PER));
    if (PAGE >= pages) PAGE = 0;
    if (!total) { listEl.innerHTML = '<div class="catalog-empty">No entries match “' + esc(q) + '”.</div>'; pagerEl.innerHTML = ""; return; }
    listEl.innerHTML = rows.slice(PAGE * PER, PAGE * PER + PER).map(citeHtml).join("");
    renderPager(total, pages);
  }

  function nodot(s) { return String(s).replace(/[.\s]+$/, ""); }
  function citeHtml(e) {
    var parts = [];
    if (e.author) parts.push("<span class=\"bib-author\">" + esc(nodot(e.author)) + "</span>");
    if (e.title) parts.push("<em>" + esc(nodot(e.title)) + "</em>");
    var tail = [e.journal, e.number, e.year ? "(" + esc(e.year) + ")" : "", e.pages].filter(Boolean).map(esc).join(" ");
    if (tail) parts.push(tail);
    return '<div class="catalog-item"><div class="catalog-monument"><div class="catalog-info">' +
      '<div class="bib-cite">' + parts.join(". ") + ".</div>" +
      (e.note ? '<span class="catalog-meta">' + esc(e.note) + "</span>" : "") +
      "</div></div></div>";
  }

  function renderPager(total, pages) {
    function btn(pg, label, on, dis) { return '<button data-pg="' + pg + '"' + (on ? ' class="on"' : "") + (dis ? " disabled" : "") + ">" + label + "</button>"; }
    var html = "";
    if (pages > 1) {
      html += btn("first", "|&lt;", false, PAGE === 0) + btn(Math.max(0, PAGE - 1), "&lt;", false, PAGE === 0);
      var start = Math.max(0, PAGE - 2), end = Math.min(pages - 1, PAGE + 2);
      if (start > 0) html += '<span class="reg-ell">…</span>';
      for (var i = start; i <= end; i++) html += btn(i, i + 1, i === PAGE, false);
      if (end < pages - 1) html += '<span class="reg-ell">…</span>';
      html += btn(Math.min(pages - 1, PAGE + 1), "&gt;", false, PAGE === pages - 1) + btn("last", "&gt;|", false, PAGE === pages - 1);
    }
    html += '<span class="register-count">' + (pages > 1 ? "Page " + (PAGE + 1) + " / " + pages + " · " : "Found ") + total.toLocaleString() + " entries</span>";
    pagerEl.innerHTML = html;
    Array.prototype.forEach.call(pagerEl.querySelectorAll("button[data-pg]"), function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-pg");
        PAGE = v === "first" ? 0 : v === "last" ? pages - 1 : parseInt(v, 10);
        render(); window.scrollTo(0, 0);
      });
    });
  }

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
})();
