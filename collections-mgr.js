/* collections-mgr.js — user-defined inscription collections (labels/groups).
 * Collections live in localStorage only (no server round-trip).
 * A collection is just a display name; inscriptions are tagged with it in the
 * records index so the catalog can filter by collection.
 *
 * On the editor page this module also injects a collection picker into the
 * toolbar so the user can choose (or create) a collection before saving.
 *
 * API (window.EpiColMgr):
 *   list()         → [{id, name}, …]      all collections, in creation order
 *   add(name)      → id                   create a new collection, return its id
 *   remove(id)     → void                 delete a collection
 *   rename(id, nm) → void                 rename in place
 *   selected()     → {id, name} | null    currently chosen collection (or null)
 *   select(id)     → void                 persist the choice across sessions
 */
(function () {
  "use strict";

  var KEY = "edep_user_cols";   // localStorage array of {id, name}
  var SEL = "edep_col_sel";     // localStorage: selected collection id

  function all() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; }
  }
  function save(arr) { localStorage.setItem(KEY, JSON.stringify(arr)); }

  function slug(name) {
    return (name || "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "collection";
  }

  function add(name) {
    var arr = all();
    var base = slug(name), id = base, n = 2;
    while (arr.some(function (c) { return c.id === id; })) { id = base + "-" + n++; }
    arr.push({ id: id, name: name.trim() });
    save(arr);
    return id;
  }

  function remove(id) { save(all().filter(function (c) { return c.id !== id; })); }

  function rename(id, newName) {
    save(all().map(function (c) { return c.id === id ? { id: id, name: newName.trim() } : c; }));
  }

  function selected() {
    var id = localStorage.getItem(SEL) || "";
    var arr = all();
    for (var i = 0; i < arr.length; i++) { if (arr[i].id === id) return arr[i]; }
    return null;
  }

  function select(id) { localStorage.setItem(SEL, id || ""); }

  window.EpiColMgr = { list: all, add: add, remove: remove, rename: rename, selected: selected, select: select };

  // ---- Editor toolbar injection -------------------------------------------
  // Only runs on editor.html (where #btn-save-github exists).

  document.addEventListener("DOMContentLoaded", function () {
    var saveBtn = document.getElementById("btn-save-github");
    if (!saveBtn) return;   // not the editor page

    // Build picker <select> element
    var wrap = document.createElement("span");
    wrap.className = "col-picker-wrap";
    wrap.title = "Select the collection this inscription belongs to";

    var label = document.createElement("span");
    label.className = "col-picker-label";
    label.textContent = "Collection:";

    var sel = document.createElement("select");
    sel.id = "col-picker";
    sel.className = "col-picker";
    sel.setAttribute("aria-label", "Collection");

    var newOpt = document.createElement("option");
    newOpt.value = "__new__";
    newOpt.textContent = "+ New collection…";

    function rebuild() {
      // preserve selection
      var cur = localStorage.getItem(SEL) || "";
      while (sel.options.length) sel.remove(0);
      // "none" option
      var none = document.createElement("option");
      none.value = "";
      none.textContent = "—  no collection  —";
      sel.appendChild(none);
      // user collections
      all().forEach(function (c) {
        var o = document.createElement("option");
        o.value = c.id; o.textContent = c.name;
        sel.appendChild(o);
      });
      sel.appendChild(newOpt);
      sel.value = cur;
    }
    rebuild();

    sel.addEventListener("change", function () {
      if (sel.value === "__new__") {
        var name = (prompt("New collection name:") || "").trim();
        if (!name) { sel.value = localStorage.getItem(SEL) || ""; return; }
        var id = add(name);
        rebuild();
        sel.value = id;
        select(id);
      } else {
        select(sel.value);
      }
    });

    wrap.appendChild(label);
    wrap.appendChild(sel);

    // Insert before the save button
    saveBtn.parentNode.insertBefore(wrap, saveBtn);
  });
})();
