/* data.js — read access to the records in the public repo.
 *
 * All inscription records live in records/*.xml in the same public repo
 * (pleuston/simple-edep). Because the repo is PUBLIC, reads work without a
 * token; a token (if present) is sent only to raise the rate limit.
 *
 * Exposes window.EpiData:
 *   EpiData.text(path)  -> Promise<string>      raw file contents (XML)
 *   EpiData.json(path)  -> Promise<any>         parsed JSON file
 *   EpiData.list(path)  -> Promise<array|null>  directory listing (null on 404)
 */
(function () {
  "use strict";
  var OWNER  = "pleuston", REPO = "simple-edep", BRANCH = "main";

  // The owner/repo/branch can be overridden by the user's GitHub settings, so a
  // fork works without code edits.
  function cfg(key, def) { return localStorage.getItem("edep_gh_" + key) || def; }
  function owner()  { return cfg("owner",  OWNER); }
  function repo()   { return cfg("repo",   REPO); }
  function branch() { return cfg("branch", BRANCH); }

  function token() {
    return (window.EpiAuth ? EpiAuth.getUser().token : "") ||
           localStorage.getItem("edep_gh_token") || "";
  }
  function headers(raw) {
    var h = {
      "Accept": raw ? "application/vnd.github.raw" : "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    var t = token();
    if (t) h["Authorization"] = "Bearer " + t;
    return h;
  }
  function url(path) {
    var p = String(path).replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
    return "https://api.github.com/repos/" + owner() + "/" + repo() + "/contents/" + p +
      "?ref=" + encodeURIComponent(branch());
  }
  function get(path) {
    return fetch(url(String(path).split("?")[0]), { headers: headers(true) });
  }
  function text(path) {
    return get(path).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + " — " + path);
      return r.text();
    });
  }
  function json(path) {
    return text(path).then(function (t) { return JSON.parse(t); });
  }
  function list(path) {
    return fetch(url(path), { headers: headers(false) }).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  window.EpiData = {
    owner: owner, repo: repo, branch: branch,
    token: token, headers: headers, url: url,
    fetch: get, text: text, json: json, list: list
  };
})();
