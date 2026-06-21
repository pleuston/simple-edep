/* guest.js — let visitors contribute a record WITHOUT their own GitHub token.
 *
 * Two routes, surfaced in a small modal from the editor's save button when the
 * user is not signed in:
 *   1. Submit anonymously  → POST to a Cloudflare Worker relay (see
 *      cloudflare-worker/) which commits to the public submissions/ folder.
 *   2. Propose as a pull request → opens GitHub's prefilled new-file page; the
 *      visitor submits under their own GitHub login. No relay, no secret.
 *
 * The relay URL is set in DEFAULT_ENDPOINT below (or localStorage
 * "edep_guest_endpoint"). If unset, route 1 explains it isn't configured and
 * route 2 still works.
 */
(function () {
  "use strict";

  // ↓↓↓ after deploying the Worker, put its URL here (or set the localStorage key)
  var DEFAULT_ENDPOINT = "";
  var TARGET = { owner: "pleuston", repo: "simple-edep", branch: "main", dir: "submissions" };
  var PR_URL_MAX = 6000;     // GitHub's prefilled-URL value is length-limited

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function endpoint() { return (localStorage.getItem("edep_guest_endpoint") || DEFAULT_ENDPOINT || "").replace(/\/+$/, ""); }
  function cleanId(id) { return String(id || "").replace(/\.xml$/i, "").replace(/[^A-Za-z0-9_\-]/g, "").slice(0, 60) || "inscription"; }
  function prTooLong(xml) { return String(xml || "").length > PR_URL_MAX; }

  function submit(xml, id) {
    var ep = endpoint();
    if (!ep) return Promise.reject(new Error("Anonymous submission isn’t set up on this site yet — use “Propose as a pull request,” or sign in to save directly."));
    return fetch(ep, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cleanId(id), xml: xml, website: "" })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || !j.ok) throw new Error(j.error || ("Submission failed (HTTP " + r.status + ")."));
        return j;
      });
    });
  }

  function prUrl(xml, id) {
    var path = TARGET.dir + "/" + cleanId(id) + ".xml";
    return "https://github.com/" + TARGET.owner + "/" + TARGET.repo + "/new/" + TARGET.branch +
      "?filename=" + encodeURIComponent(path) + "&value=" + encodeURIComponent(xml);
  }

  // ---- modal ----------------------------------------------------------------
  var MODAL_ID = "guest-modal", injected = false;
  function injectModal() {
    if (injected) return; injected = true;
    var html =
      '<div id="' + MODAL_ID + '" class="modal-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="guest-modal-title">' +
        '<div class="modal-box" style="max-width:520px">' +
          '<button class="modal-close" id="guest-close" aria-label="Close">✕</button>' +
          '<h2 class="modal-title" id="guest-modal-title">Submit your inscription</h2>' +
          '<p class="modal-desc">You’re not signed in. Your inscription can still be contributed to the public ' +
            '<code>' + esc(TARGET.dir) + '/</code> folder of <code>' + esc(TARGET.owner + "/" + TARGET.repo) + '</code>, ' +
            'where it’s reviewed before becoming part of the corpus. ' +
            '<a href="login.html" id="guest-signin">Sign in</a> to save directly instead.</p>' +
          '<label class="gh-label" style="display:block;margin-bottom:.8rem">File name' +
            '<input type="text" id="guest-id" class="gh-input" style="width:100%;box-sizing:border-box" placeholder="inscription">' +
          '</label>' +
          '<div class="gh-actions" style="flex-direction:column;align-items:stretch;gap:.5rem">' +
            '<button class="btn primary btn-wide" id="guest-anon" type="button" style="margin-top:0">Submit anonymously →</button>' +
            '<a class="btn btn-wide" id="guest-pr" target="_blank" rel="noopener" style="margin-top:0">Propose as a pull request ↗</a>' +
          '</div>' +
          '<p id="guest-result" class="login-error" aria-live="polite" style="margin-top:.9rem"></p>' +
        '</div>' +
      '</div>';
    var d = document.createElement("div");
    d.innerHTML = html;
    document.body.appendChild(d.firstElementChild);
    document.getElementById("guest-close").addEventListener("click", hide);
    document.getElementById(MODAL_ID).addEventListener("click", function (e) { if (e.target === this) hide(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
  }
  function hide() { var m = document.getElementById(MODAL_ID); if (m) m.hidden = true; document.body.style.overflow = ""; }

  function open(xml, id) {
    injectModal();
    var m = document.getElementById(MODAL_ID);
    var result = document.getElementById("guest-result"); result.textContent = ""; result.className = "login-error";
    var idInput = document.getElementById("guest-id"); idInput.value = cleanId(id);

    var anon = document.getElementById("guest-anon");
    var pr = document.getElementById("guest-pr");
    anon.disabled = false; anon.textContent = "Submit anonymously →";

    // PR route: prefilled new-file page (disabled if the record is too big for a URL)
    function refreshPr() {
      if (prTooLong(xml)) {
        pr.removeAttribute("href"); pr.classList.add("disabled");
        pr.title = "Too large for the prefilled-URL route — use anonymous submission or sign in.";
      } else {
        pr.setAttribute("href", prUrl(xml, idInput.value)); pr.classList.remove("disabled"); pr.title = "";
      }
    }
    idInput.oninput = refreshPr; refreshPr();

    anon.onclick = function () {
      result.textContent = ""; result.className = "login-error";
      anon.disabled = true; anon.textContent = "Submitting…";
      submit(xml, idInput.value).then(function (j) {
        result.className = "login-ok";
        result.innerHTML = "Submitted. " + (j.html_url ? '<a href="' + esc(j.html_url) + '" target="_blank" rel="noopener">View your submission ↗</a>' : "Thank you!");
        anon.textContent = "Submitted ✓";
      }).catch(function (err) {
        result.className = "login-error"; result.textContent = err.message;
        anon.disabled = false; anon.textContent = "Submit anonymously →";
      });
    };

    document.getElementById("guest-signin").setAttribute("href", "login.html?r=" + encodeURIComponent(location.href));
    m.hidden = false; document.body.style.overflow = "hidden";
  }

  window.EpiGuest = { open: open, submit: submit, prUrl: prUrl, prTooLong: prTooLong, endpoint: endpoint, cleanId: cleanId, target: TARGET };
})();
