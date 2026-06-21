/* photos.js — searchable, paginated gallery of EDH (heidICON) photographs.
 * Thumbnails and IIIF images are hotlinked from the heidICON server (Free
 * Access); each tile links to the inscription it documents and to heidICON. */
(function () {
  "use strict";
  var gridEl, searchEl, pagerEl, PHOTOS = [], PAGE = 0, PER = 60;

  document.addEventListener("DOMContentLoaded", function () {
    gridEl = document.getElementById("ph-grid");
    searchEl = document.getElementById("ph-search");
    pagerEl = document.getElementById("ph-count");
    var dt;
    searchEl.addEventListener("input", function () { clearTimeout(dt); dt = setTimeout(function () { PAGE = 0; render(); }, 180); });
    EpiCollections.getJSON(EpiCollections.get("edh").photos)
      .then(function (p) { PHOTOS = p || []; render(); })
      .catch(function () { gridEl.innerHTML = '<div class="catalog-empty">Could not load the photo database.</div>'; });
  });

  function render() {
    var q = (searchEl.value || "").toLowerCase().trim();
    var rows = !q ? PHOTOS : PHOTOS.filter(function (p) {
      return (p.place + " " + p.hd + " " + p.cil + " " + p.f).toLowerCase().indexOf(q) !== -1;
    });
    var total = rows.length, pages = Math.max(1, Math.ceil(total / PER));
    if (PAGE >= pages) PAGE = 0;
    if (!total) { gridEl.innerHTML = '<div class="catalog-empty">No photos match “' + esc(q) + '”.</div>'; pagerEl.innerHTML = ""; return; }
    gridEl.innerHTML = rows.slice(PAGE * PER, PAGE * PER + PER).map(tileHtml).join("");
    renderPager(total, pages);
  }

  function tileHtml(p) {
    var cap = [p.place, p.year].filter(Boolean).join(" · ");
    var link = p.hd ? "viewer.html?id=" + encodeURIComponent(p.hd) + "&col=edh" : (p.detail || "#");
    var ext = p.hd ? "" : ' target="_blank" rel="noopener"';
    var img = p.thumb || (p.iiif ? p.iiif + "/full/!200,200/0/default.jpg" : "");
    return '<a class="photo-tile" href="' + esc(link) + '"' + ext + '>' +
      (img ? '<img loading="lazy" src="' + esc(img) + '" alt="' + esc(p.place || p.f) + '">' : '<div class="photo-noimg">no image</div>') +
      '<span class="photo-cap">' + esc(p.hd || p.f) + (cap ? " · " + esc(cap) : "") + "</span></a>";
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
    html += '<span class="register-count">' + (pages > 1 ? "Page " + (PAGE + 1) + " / " + pages + " · " : "Found ") + total.toLocaleString() + " photos</span>";
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
