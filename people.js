/* people.js — register of persons from the EDH collection (edh_data_pers),
 * each linked to the inscription that names them. Searchable + paginated. */
(function () {
  "use strict";
  var listEl, searchEl, pagerEl, PEOPLE = [], PAGE = 0, PER = 40;

  document.addEventListener("DOMContentLoaded", function () {
    listEl = document.getElementById("ppl-list");
    searchEl = document.getElementById("ppl-search");
    pagerEl = document.getElementById("ppl-count");
    var dt;
    searchEl.addEventListener("input", function () { clearTimeout(dt); dt = setTimeout(function () { PAGE = 0; render(); }, 180); });
    listEl.innerHTML = '<div class="catalog-loading">Loading the persons register…</div>';
    EpiCollections.getJSON(EpiCollections.get("edh").people)
      .then(function (p) { PEOPLE = (p || []).sort(byName); render(); })
      .catch(function () { listEl.innerHTML = '<div class="catalog-empty">Could not load the persons register.</div>'; });
  });

  function byName(a, b) { return (a.name || "").localeCompare(b.name || ""); }

  function render() {
    var q = (searchEl.value || "").toLowerCase().trim();
    var rows = !q ? PEOPLE : PEOPLE.filter(function (p) {
      return (p.name + " " + p.role + " " + p.status + " " + p.hd).toLowerCase().indexOf(q) !== -1;
    });
    var total = rows.length, pages = Math.max(1, Math.ceil(total / PER));
    if (PAGE >= pages) PAGE = 0;
    if (!total) { listEl.innerHTML = '<div class="catalog-empty">No people match “' + esc(q) + '”.</div>'; pagerEl.innerHTML = ""; return; }
    listEl.innerHTML = rows.slice(PAGE * PER, PAGE * PER + PER).map(rowHtml).join("");
    renderPager(total, pages);
  }

  function rowHtml(p) {
    var meta = [p.role, p.status, genderLabel(p.gender), p.age].filter(Boolean).join(" · ");
    var tags = [];
    if (p.hd) tags.push('<a class="catalog-tag" href="viewer.html?id=' + encodeURIComponent(p.hd) + '&col=edh">' + esc(p.hd) + "</a>");
    if (p.pir) tags.push('<span class="catalog-tag">PIR ' + esc(p.pir) + "</span>");
    return '<div class="catalog-item"><div class="catalog-monument"><div class="catalog-info">' +
      '<div class="catalog-title">' + (p.hd ? '<a href="viewer.html?id=' + encodeURIComponent(p.hd) + '&col=edh">' + esc(p.name) + "</a>" : esc(p.name)) + "</div>" +
      (meta ? '<span class="catalog-meta">' + esc(meta) + "</span>" : "") +
      (tags.length ? '<div class="catalog-tags">' + tags.join(" ") + "</div>" : "") +
      "</div></div></div>";
  }
  function genderLabel(g) { return g === "M" ? "male" : g === "W" || g === "F" ? "female" : ""; }

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
    html += '<span class="register-count">' + (pages > 1 ? "Page " + (PAGE + 1) + " / " + pages + " · " : "Found ") + total.toLocaleString() + " people</span>";
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
