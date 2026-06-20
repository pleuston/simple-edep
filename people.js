/* people.js — register of persons named in the inscriptions.
 * Reads data/people-index.json (a maintained authority register) and links each
 * person to the inscription(s) they appear in. */
(function () {
  "use strict";
  var listEl, searchEl, countEl, PEOPLE = [];

  document.addEventListener("DOMContentLoaded", function () {
    listEl = document.getElementById("ppl-list");
    searchEl = document.getElementById("ppl-search");
    countEl = document.getElementById("ppl-count");
    searchEl.addEventListener("input", render);
    fetch("data/people-index.json").then(function (r) { return r.ok ? r.json() : []; })
      .then(function (p) { PEOPLE = (p || []).slice().sort(byName); render(); })
      .catch(function () { listEl.innerHTML = '<div class="catalog-empty">No people register found.</div>'; });
  });

  function byName(a, b) { return (a.name || "").localeCompare(b.name || ""); }

  function render() {
    var q = (searchEl.value || "").toLowerCase().trim();
    var rows = PEOPLE.filter(function (p) {
      if (!q) return true;
      return [p.name, p.role, p.place, p.date].join(" ").toLowerCase().indexOf(q) !== -1;
    });
    countEl.textContent = "· " + rows.length + (rows.length === 1 ? " person" : " people");
    if (!rows.length) { listEl.innerHTML = '<div class="catalog-empty">No people' + (q ? " match “" + esc(q) + "”." : ".") + "</div>"; return; }
    listEl.innerHTML = rows.map(rowHtml).join("");
  }

  function rowHtml(p) {
    var refs = (p.inscriptions || []).map(function (f) {
      var id = String(f).replace(/\.xml$/, "");
      return '<a class="catalog-tag" href="viewer.html?id=' + encodeURIComponent(id) + '">' + esc(id) + "</a>";
    }).join(" ");
    var meta = [p.role, p.place, p.date].filter(Boolean).join(" · ");
    return '<div class="catalog-item"><div class="catalog-monument"><div class="catalog-info">' +
      '<div class="catalog-title">' + esc(p.name) + "</div>" +
      (meta ? '<span class="catalog-meta">' + esc(meta) + "</span>" : "") +
      (refs ? '<div class="catalog-tags">' + refs + "</div>" : "") +
      "</div></div></div>";
  }

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
})();
