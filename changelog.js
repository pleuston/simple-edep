/* changelog.js — GitHub commit log for simple-edep (the "Log" category).
 * Reads owner/repo/branch/path/token from the same localStorage keys as
 * github.js, so it reflects whatever repository the editor saves into (the
 * default public pleuston/simple-edep, or a signed-in user's own repo).
 * Exports window.EpiChangelog with fetchRecords(), fetchAll(), timeAgo(). */
(function () {
  "use strict";

  var LS = {
    token:  "edep_gh_token", owner: "edep_gh_owner",
    repo:   "edep_gh_repo",  branch: "edep_gh_branch", path: "edep_gh_path"
  };
  var DEF = { owner: "pleuston", repo: "simple-edep", branch: "main", path: "records/" };

  function cfg() {
    return {
      token:  localStorage.getItem(LS.token)  || "",
      owner:  localStorage.getItem(LS.owner)  || DEF.owner,
      repo:   localStorage.getItem(LS.repo)   || DEF.repo,
      branch: localStorage.getItem(LS.branch) || DEF.branch,
      path:   (localStorage.getItem(LS.path)  || DEF.path).replace(/\/+$/, "")
    };
  }

  function ghHeaders(token) {
    var h = { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (token) h["Authorization"] = "Bearer " + token;
    return h;
  }

  function commitsUrl(c, path, n) {
    return "https://api.github.com/repos/" + c.owner + "/" + c.repo +
      "/commits?sha=" + encodeURIComponent(c.branch) +
      "&per_page=" + (n || 100) +
      (path ? "&path=" + encodeURIComponent(path) : "");
  }

  function ghFetch(url, token) {
    return fetch(url, { headers: ghHeaders(token) })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (j) { return Array.isArray(j) ? j : []; })
      .catch(function () { return []; });
  }

  function timeAgo(iso) {
    var t = new Date(iso);
    if (!iso || isNaN(t)) return "";
    var s = (Date.now() - t) / 1000;
    if (s < 60)        return "just now";
    if (s < 3600)      return Math.floor(s / 60) + " min ago";
    if (s < 86400)     return Math.floor(s / 3600) + " hr ago";
    if (s < 86400 * 30) return Math.floor(s / 86400) + " d ago";
    return t.toISOString().slice(0, 10);
  }

  /* Commits touching the record-XML path (the edit/save history) */
  function fetchRecords(limit) {
    var c = cfg();
    return ghFetch(commitsUrl(c, c.path || "records", limit || 100), c.token);
  }

  /* Every commit in the save repository */
  function fetchAll(limit) {
    var c = cfg();
    return ghFetch(commitsUrl(c, "", limit || 200), c.token);
  }

  window.EpiChangelog = { fetchRecords: fetchRecords, fetchAll: fetchAll, timeAgo: timeAgo, cfg: cfg };
})();
