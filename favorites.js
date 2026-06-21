/* favorites.js — personal saved inscriptions and user-made collections.
 *
 * Everything is per-browser in localStorage (key "edep_fav_v1"); no sign-in or
 * server needed. A "favorite" is the default starred list; users can also create
 * any number of named collections and file inscriptions into them.
 *
 * Each saved item is a slim record: { id, col, title, place, date }.
 *
 * Surfaced as a star button (data-fav, built by EpiFav.button()) on catalogue
 * rows, the reading panel, and the viewer; clicking it opens a "Save to…"
 * popover with Favorites + every collection + an inline "new collection" field.
 * The Favorites page (favorites.html) lists and manages everything.
 */
(function () {
  "use strict";
  var KEY = "edep_fav_v1", FAV = "__fav";

  function read() {
    try { var d = JSON.parse(localStorage.getItem(KEY) || "{}"); return { fav: d.fav || [], colls: d.colls || [] }; }
    catch (e) { return { fav: [], colls: [] }; }
  }
  function write(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); }
    catch (e) { return false; }
    try { document.dispatchEvent(new CustomEvent("epifav:change")); } catch (e) {}
    return true;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function same(a, id, col) { return a.id === id && (a.col || "local") === (col || "local"); }
  function keyOf(it) { return (it.col || "local") + ":" + it.id; }

  // ---- list accessors -------------------------------------------------------
  function listById(d, lid) { return lid === FAV ? d.fav : ((d.colls.filter(function (c) { return c.id === lid; })[0] || {}).items || null); }
  function inList(lid, id, col) { var l = listById(read(), lid); return !!(l && l.some(function (x) { return same(x, id, col); })); }
  function savedAnywhere(id, col) {
    var d = read();
    if (d.fav.some(function (x) { return same(x, id, col); })) return true;
    return d.colls.some(function (c) { return (c.items || []).some(function (x) { return same(x, id, col); }); });
  }

  function toggleInList(lid, item) {
    var d = read(), l = lid === FAV ? d.fav : (d.colls.filter(function (c) { return c.id === lid; })[0] || {}).items;
    if (!l) return false;
    var i = -1, j; for (j = 0; j < l.length; j++) if (same(l[j], item.id, item.col)) { i = j; break; }
    if (i >= 0) l.splice(i, 1); else l.unshift(slim(item));
    write(d); return i < 0;   // true if now added
  }
  function slim(it) { return { id: it.id, col: it.col || "local", title: it.title || it.id, place: it.place || "", date: it.date || "" }; }

  // ---- collections ----------------------------------------------------------
  function collections() { return read().colls; }
  function createCollection(name) {
    name = (name || "").trim(); if (!name) return null;
    var d = read(), c = { id: "c" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name: name, items: [] };
    d.colls.push(c); write(d); return c;
  }
  function renameCollection(cid, name) { var d = read(); d.colls.forEach(function (c) { if (c.id === cid) c.name = (name || "").trim() || c.name; }); write(d); }
  function deleteCollection(cid) { var d = read(); d.colls = d.colls.filter(function (c) { return c.id !== cid; }); write(d); }

  // ---- star button + refresh ------------------------------------------------
  function button(item) {
    return '<button type="button" class="fav-btn' + (savedAnywhere(item.id, item.col) ? " saved" : "") + '" data-fav' +
      ' data-id="' + esc(item.id) + '" data-col="' + esc(item.col || "local") + '"' +
      ' data-title="' + esc(item.title || item.id) + '" data-place="' + esc(item.place || "") + '" data-date="' + esc(item.date || "") + '"' +
      ' title="Save to favorites / a collection" aria-label="Save">' + star() + "</button>";
  }
  function star() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 18l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95z"/></svg>'; }
  function itemFromBtn(b) {
    return { id: b.getAttribute("data-id"), col: b.getAttribute("data-col") || "local",
      title: b.getAttribute("data-title"), place: b.getAttribute("data-place"), date: b.getAttribute("data-date") };
  }
  function refresh(root) {
    (root || document).querySelectorAll("[data-fav]").forEach(function (b) {
      b.classList.toggle("saved", savedAnywhere(b.getAttribute("data-id"), b.getAttribute("data-col") || "local"));
    });
  }

  // ---- "Save to…" popover ---------------------------------------------------
  var pop = null, popBtn = null;
  function closePop() { if (pop) { pop.remove(); pop = null; popBtn = null; document.removeEventListener("click", onDoc, true); document.removeEventListener("keydown", onKey, true); } }
  function onDoc(e) { if (pop && !pop.contains(e.target) && e.target !== popBtn && !popBtn.contains(e.target)) closePop(); }
  function onKey(e) { if (e.key === "Escape") closePop(); }

  function openMenu(btn) {
    closePop();
    var item = itemFromBtn(btn);
    popBtn = btn;
    pop = document.createElement("div");
    pop.className = "fav-pop";
    render(item);
    document.body.appendChild(pop);
    var r = btn.getBoundingClientRect();
    var top = r.bottom + 6, left = Math.min(r.left, window.innerWidth - 250);
    if (top + pop.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - pop.offsetHeight - 6);
    pop.style.top = top + "px"; pop.style.left = Math.max(8, left) + "px";
    setTimeout(function () { document.addEventListener("click", onDoc, true); document.addEventListener("keydown", onKey, true); }, 0);

    function render(item) {
      var d = read();
      var rows = '<label class="fav-pop-row"><input type="checkbox" data-list="' + FAV + '"' + (inList(FAV, item.id, item.col) ? " checked" : "") + '> <span class="fav-pop-star">★</span> Favorites</label>';
      rows += d.colls.map(function (c) {
        return '<label class="fav-pop-row"><input type="checkbox" data-list="' + esc(c.id) + '"' + (inList(c.id, item.id, item.col) ? " checked" : "") + '> ' + esc(c.name) + "</label>";
      }).join("");
      pop.innerHTML = '<div class="fav-pop-title">Save to…</div>' + rows +
        '<form class="fav-pop-new"><input type="text" placeholder="New collection…" maxlength="60"><button type="submit">Add</button></form>';
      pop.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        cb.addEventListener("change", function () { toggleInList(cb.getAttribute("data-list"), item); btn.classList.toggle("saved", savedAnywhere(item.id, item.col)); });
      });
      var form = pop.querySelector(".fav-pop-new");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var name = form.querySelector("input").value;
        var c = createCollection(name);
        if (c) { toggleInList(c.id, item); btn.classList.add("saved"); render(item); }
      });
    }
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-fav]") : null;
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (pop && popBtn === b) { closePop(); return; }
    openMenu(b);
  });

  window.EpiFav = {
    FAV: FAV, read: read, button: button, refresh: refresh,
    savedAnywhere: savedAnywhere, toggleInList: toggleInList, inList: inList,
    collections: collections, createCollection: createCollection, renameCollection: renameCollection, deleteCollection: deleteCollection,
    listById: function (lid) { return listById(read(), lid); }, esc: esc
  };
})();
