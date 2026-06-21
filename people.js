/* people.js — register of persons from the EDH collection (edh_data_pers),
 * searchable and filterable by sex, social state, and occupation. */
(function () {
  "use strict";
  var listEl, searchEl, pagerEl, PEOPLE = [], PAGE = 0, PER = 60;
  var fSex, fStatus, fRole;

  document.addEventListener("DOMContentLoaded", function () {
    listEl   = document.getElementById("ppl-list");
    searchEl = document.getElementById("ppl-search");
    pagerEl  = document.getElementById("ppl-count");
    fSex     = document.getElementById("ppl-sex");
    fStatus  = document.getElementById("ppl-status");
    fRole    = document.getElementById("ppl-role");

    var dt;
    function rerender() { PAGE = 0; render(); }
    searchEl.addEventListener("input", function () { clearTimeout(dt); dt = setTimeout(rerender, 180); });
    fSex.addEventListener("change", rerender);
    fStatus.addEventListener("change", rerender);
    fRole.addEventListener("change", rerender);

    var rst = document.getElementById("ppl-reset");
    if (rst) rst.addEventListener("click", function () {
      searchEl.value = ""; fSex.value = ""; fStatus.value = ""; fRole.value = "";
      rerender();
    });

    // resolve a person to their inscription in the right-side reading panel
    listEl.addEventListener("click", function (ev) {
      var a = ev.target.closest ? ev.target.closest('a[href^="viewer.html"]') : null;
      if (!a || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      ev.preventDefault();
      var u = new URL(a.getAttribute("href"), location.href);
      var id = (u.searchParams.get("id") || "").replace(/[^A-Za-z0-9_\-.]/g, "");
      var col = (u.searchParams.get("col") || "edh").replace(/[^a-z]/g, "");
      Array.prototype.forEach.call(listEl.querySelectorAll(".ppl-row.selected"), function (x) { x.classList.remove("selected"); });
      var item = a.closest(".ppl-row"); if (item) item.classList.add("selected");
      RecordPanel.open(id, col, {});
    });

    listEl.innerHTML = '<div class="catalog-loading">Loading the persons register…</div>';
    EpiCollections.getJSON(EpiCollections.get("edh").people)
      .then(function (p) {
        PEOPLE = (p || []).sort(byName);
        populateFilters();
        render();
      })
      .catch(function () { listEl.innerHTML = '<div class="catalog-empty">Could not load the persons register.</div>'; });
  });

  function byName(a, b) { return (a.name || "").localeCompare(b.name || ""); }

  function populateFilters() {
    var sexes = {}, statuses = {}, roles = {};
    PEOPLE.forEach(function (p) {
      if (p.gender) sexes[p.gender] = true;
      if (p.status) statuses[p.status] = true;
      if (p.role)   roles[p.role] = true;
    });
    var SEX_LABEL = { M: "Male", W: "Female", F: "Female" };
    fill(fSex, Object.keys(sexes).sort(), function (v) { return SEX_LABEL[v] || v; });
    fill(fStatus, Object.keys(statuses).sort());
    fill(fRole, Object.keys(roles).sort());
  }

  function fill(sel, vals, labelFn) {
    vals.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v; o.textContent = labelFn ? labelFn(v) : v;
      sel.appendChild(o);
    });
  }

  function matches(p) {
    var q = (searchEl.value || "").toLowerCase().trim();
    if (q && (p.name + " " + p.role + " " + (p.hd || "")).toLowerCase().indexOf(q) === -1) return false;
    if (fSex.value && p.gender !== fSex.value) return false;
    if (fStatus.value && p.status !== fStatus.value) return false;
    if (fRole.value && p.role !== fRole.value) return false;
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
    listEl.innerHTML = '<div class="ppl-list">' +
      rows.slice(PAGE * PER, PAGE * PER + PER).map(rowHtml).join("") +
      '</div>';
    renderPager(total, pages);
  }

  function rowHtml(p) {
    var chips = [p.role, p.status, genderLabel(p.gender)].filter(Boolean).join(" · ");
    var nameHtml = p.hd
      ? '<a class="ppl-name" href="viewer.html?id=' + encodeURIComponent(p.hd) + '&col=edh">' + esc(p.name) + "</a>"
      : '<span class="ppl-name">' + esc(p.name) + "</span>";
    var tags = "";
    if (p.hd) {
      if (window.EpiAuth && EpiAuth.isSignedIn()) {
        tags += '<a class="btn small ppl-edit" href="editor.html?id=' + encodeURIComponent(p.hd) + '&col=edh">Edit</a>';
      }
      tags += '<a class="catalog-tag ppl-hd" href="viewer.html?id=' + encodeURIComponent(p.hd) + '&col=edh">' + esc(p.hd) + "</a>";
    }
    if (p.pir) tags += '<span class="catalog-tag">PIR ' + esc(p.pir) + "</span>";
    return '<div class="ppl-row">' + nameHtml +
      (chips ? '<span class="ppl-chips">' + esc(chips) + "</span>" : "") +
      (tags ? '<span class="ppl-tags">' + tags + "</span>" : "") +
      "</div>";
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
