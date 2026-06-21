/* github.js — direct save to GitHub via Contents API.
 * Provides EpiGitHub.save(xml, filename) and EpiGitHub.showSettings().
 * Settings (PAT, owner, repo, branch, path) live in localStorage.
 * The token is stored client-side only and never sent anywhere except
 * the GitHub API endpoint in the fetch call below. */
(function () {
  "use strict";

  var MODAL_ID = "gh-settings-modal";
  var LS = {
    token:  "edep_gh_token",
    owner:  "edep_gh_owner",
    repo:   "edep_gh_repo",
    branch: "edep_gh_branch",
    path:   "edep_gh_path"
  };
  var DEFAULTS = {
    owner:  "pleuston",
    repo:   "simple-edep",
    branch: "main",
    path:   "records/"
  };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function getSettings() {
    return {
      token:  localStorage.getItem(LS.token)  || "",
      owner:  localStorage.getItem(LS.owner)  || DEFAULTS.owner,
      repo:   localStorage.getItem(LS.repo)   || DEFAULTS.repo,
      branch: localStorage.getItem(LS.branch) || DEFAULTS.branch,
      path:   localStorage.getItem(LS.path)   || DEFAULTS.path
    };
  }

  function putSettings(s) {
    Object.keys(LS).forEach(function (k) { localStorage.setItem(LS[k], s[k]); });
  }

  function hasToken() { return !!localStorage.getItem(LS.token); }

  // ---- Settings modal --------------------------------------------------------

  function buildModalHtml(s) {
    return '<div id="' + MODAL_ID + '" class="modal-overlay" hidden' +
        ' role="dialog" aria-modal="true" aria-labelledby="gh-modal-heading">' +
      '<div class="modal-box" style="max-width:480px">' +
        '<button class="modal-close" id="gh-modal-close" aria-label="Close">&#x2715;</button>' +
        '<h2 id="gh-modal-heading" class="modal-title">GitHub save settings</h2>' +
        '<p class="modal-desc">Generate a <a href="https://github.com/settings/tokens/new?scopes=public_repo&amp;description=simple-edep" target="_blank" rel="noopener">personal access token</a> (classic, <code>public_repo</code> scope — or <code>repo</code> for private). Stored only in this browser — never transmitted elsewhere.</p>' +
        '<div class="gh-form">' +
          '<label class="gh-label">Token' +
            '<input type="password" id="gh-s-token" class="gh-input" autocomplete="off"' +
            ' value="' + esc(s.token) + '" placeholder="github_pat_…"/>' +
          '</label>' +
          '<label class="gh-label">Owner / org' +
            '<input type="text" id="gh-s-owner" class="gh-input" value="' + esc(s.owner) + '"/>' +
          '</label>' +
          '<label class="gh-label">Repository' +
            '<input type="text" id="gh-s-repo" class="gh-input" value="' + esc(s.repo) + '"/>' +
          '</label>' +
          '<label class="gh-label">Branch' +
            '<input type="text" id="gh-s-branch" class="gh-input" value="' + esc(s.branch) + '"/>' +
          '</label>' +
          '<label class="gh-label">Records path' +
            '<input type="text" id="gh-s-path" class="gh-input"' +
            ' value="' + esc(s.path) + '" placeholder="records/"/>' +
          '</label>' +
        '</div>' +
        '<div class="gh-actions">' +
          '<button class="btn primary" id="gh-s-save">Save</button>' +
          '<button class="btn" id="gh-s-cancel">Cancel</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  var _injected = false;
  function injectModal() {
    if (_injected) return;
    _injected = true;
    var d = document.createElement("div");
    d.innerHTML = buildModalHtml(getSettings());
    document.body.appendChild(d.firstElementChild);

    document.getElementById("gh-modal-close").addEventListener("click", hideSettings);
    document.getElementById("gh-s-cancel").addEventListener("click", hideSettings);
    document.getElementById("gh-s-save").addEventListener("click", function () {
      putSettings({
        token:  document.getElementById("gh-s-token").value.trim(),
        owner:  document.getElementById("gh-s-owner").value.trim(),
        repo:   document.getElementById("gh-s-repo").value.trim(),
        branch: document.getElementById("gh-s-branch").value.trim(),
        path:   document.getElementById("gh-s-path").value.trim()
      });
      hideSettings();
      toast("Settings saved");
    });
    document.getElementById(MODAL_ID).addEventListener("click", function (e) {
      if (e.target === this) hideSettings();
    });
  }

  function showSettings() {
    injectModal();
    var s = getSettings();
    document.getElementById("gh-s-token").value  = s.token;
    document.getElementById("gh-s-owner").value  = s.owner;
    document.getElementById("gh-s-repo").value   = s.repo;
    document.getElementById("gh-s-branch").value = s.branch;
    document.getElementById("gh-s-path").value   = s.path;
    document.getElementById(MODAL_ID).hidden = false;
    document.body.style.overflow = "hidden";
    document.getElementById("gh-s-token").focus();
  }

  function hideSettings() {
    var el = document.getElementById(MODAL_ID);
    if (el) el.hidden = true;
    document.body.style.overflow = "";
  }

  // ---- Index helpers ---------------------------------------------------------

  function extractMeta(xml, filename) {
    function pick(re) {
      var m = xml.match(re);
      return m ? m[1].replace(/<[^>]*>/g, "").trim() : "";
    }
    var title = pick(/<title[^>]*>([\s\S]*?)<\/title>/);
    var settlement = pick(/<settlement>([\s\S]*?)<\/settlement>/) ||
                     pick(/<placeName type="modern">([\s\S]*?)<\/placeName>/);
    var region  = pick(/<placeName type="region">([\s\S]*?)<\/placeName>/);
    var country = pick(/<country[^>]*>([\s\S]*?)<\/country>/);
    var textType   = pick(/<rs type="textType"[^>]*>([\s\S]*?)<\/rs>/) ||
                     pick(/<term ref="[^"]*typeins[^"]*"[^>]*>([\s\S]*?)<\/term>/);
    var objectType = pick(/<objectType[^>]*>([\s\S]*?)<\/objectType>/);
    var material   = pick(/<material[^>]*>([\s\S]*?)<\/material>/);
    var date       = pick(/<origDate[^>]*>([\s\S]*?)<\/origDate>/);
    var geo = pick(/<geo>([\s\S]*?)<\/geo>/);
    var lat = "", lng = "";
    if (geo) { var gp = geo.split(/\s+/); lat = gp[0] || ""; lng = gp[1] || ""; }
    var nb = "", na = "", dm = xml.match(/notBefore-custom="([^"]+)"[^>]*notAfter-custom="([^"]+)"/);
    if (dm) { nb = parseInt(dm[1], 10) || ""; na = parseInt(dm[2], 10) || ""; }
    var col = window.EpiColMgr ? EpiColMgr.selected() : null;
    return { file: filename, titleEn: title, settlement: settlement, region: region,
             country: country, date: date, textType: textType,
             objectType: objectType, material: material, lat: lat, lng: lng, nb: nb, na: na,
             collection: col ? col.name : "" };
  }

  var PENDING_KEY = "edep_pending_entries";
  function cacheEntryLocally(meta) {
    try {
      var arr = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
      var found = false;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].file === meta.file) { arr[i] = meta; found = true; break; }
      }
      if (!found) arr.push(meta);
      localStorage.setItem(PENDING_KEY, JSON.stringify(arr));
    } catch (e) {}
  }

  function updateLocalIndex(meta, s, headers) {
    var indexUrl = "https://api.github.com/repos/" + s.owner + "/" + s.repo +
                   "/contents/data/records-index.json?ref=" + encodeURIComponent(s.branch);
    fetch(indexUrl, { headers: headers })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (existing) {
        if (!existing || !existing.content) return;
        var index = JSON.parse(atob(existing.content.replace(/\s/g, "")));
        var found = false;
        for (var i = 0; i < index.length; i++) {
          if (index[i].file === meta.file) { index[i] = meta; found = true; break; }
        }
        if (!found) index.push(meta);
        var putUrl = "https://api.github.com/repos/" + s.owner + "/" + s.repo +
                     "/contents/data/records-index.json";
        return fetch(putUrl, {
          method: "PUT",
          headers: Object.assign({ "Content-Type": "application/json" }, headers),
          body: JSON.stringify({
            message: "Update index: " + meta.file,
            content: b64(JSON.stringify(index, null, 2)),
            sha: existing.sha,
            branch: s.branch
          })
        });
      })
      .catch(function () {}); // best-effort; don't surface index errors to the user
  }

  // ---- GitHub Contents API save ----------------------------------------------

  function b64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function setBtnState(busy) {
    var btn = document.getElementById("btn-save-github");
    if (!btn) return;
    btn.disabled = busy;
    btn.textContent = busy ? "Saving…" : "② Save to GitHub";
  }

  function toast(msg, isErr) {
    var el = document.getElementById("toast");
    if (!el) { if (isErr) alert(msg); return; }
    el.textContent = msg;
    el.className = "show" + (isErr ? " toast-error" : "");
    setTimeout(function () { el.className = ""; }, isErr ? 6000 : 3000);
  }

  function save(xml, filename, onDone) {
    if (!filename) { toast("Set a file name before saving", true); return; }
    if (!xml)      { toast("Nothing to save — fill the form first", true); return; }

    var s = getSettings();
    if (!s.token) { showSettings(); return; }

    filename = filename.replace(/\.xml$/i, "") + ".xml";
    var relPath  = s.path.replace(/\/+$/, "") + "/" + filename;
    relPath = relPath.replace(/^\/+/, "");
    var apiUrl   = "https://api.github.com/repos/" + s.owner + "/" + s.repo + "/contents/" + relPath;
    var headers  = {
      "Authorization":        "Bearer " + s.token,
      "Accept":               "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };

    setBtnState(true);
    var isNew = true;

    fetch(apiUrl + "?ref=" + encodeURIComponent(s.branch), { headers: headers })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (existing) {
        isNew = !existing;
        var body = {
          message: (existing ? "Update" : "Add") + " inscription: " + filename,
          content: b64(xml),
          branch:  s.branch
        };
        if (existing && existing.sha) body.sha = existing.sha;
        return fetch(apiUrl, {
          method: "PUT",
          headers: Object.assign({ "Content-Type": "application/json" }, headers),
          body: JSON.stringify(body)
        });
      })
      .then(function (r) {
        if (!r.ok) {
          return r.json().then(function (e) {
            throw new Error(e.message || "HTTP " + r.status);
          });
        }
        return r.json();
      })
      .then(function () {
        toast((isNew ? "Added" : "Updated") + ": " + filename);
        try { sessionStorage.setItem("edep_fresh:" + filename, xml); } catch (e) {}
        setBtnState(false);
        var meta = extractMeta(xml, filename);
        updateLocalIndex(meta, s, headers);
        cacheEntryLocally(meta);
        if (onDone) onDone();
      })
      .catch(function (err) {
        toast("GitHub error: " + err.message, true);
        setBtnState(false);
      });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") hideSettings();
  });

  window.EpiGitHub = {
    save:         save,
    showSettings: showSettings,
    hideSettings: hideSettings,
    hasToken:     hasToken,
    getSettings:  getSettings
  };
})();
