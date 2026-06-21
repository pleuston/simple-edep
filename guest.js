/* guest.js — prompts unsigned-in visitors to create a GitHub account.
 * Replaces the previous anonymous-relay / pull-request submission flow.
 * Saving requires a GitHub token; this modal explains how to get one. */
(function () {
  "use strict";

  var MODAL_ID = "guest-modal", injected = false;

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  function injectModal() {
    if (injected) return; injected = true;
    var loginHref = "login.html?r=" + encodeURIComponent(location.href);
    var html =
      '<div id="' + MODAL_ID + '" class="modal-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="guest-modal-title">' +
        '<div class="modal-box" style="max-width:460px">' +
          '<button class="modal-close" id="guest-close" aria-label="Close">&#x2715;</button>' +
          '<h2 class="modal-title" id="guest-modal-title">Sign in to save</h2>' +
          '<p class="modal-desc">Saving inscriptions to the corpus requires a free GitHub account. ' +
            'Sign up in under a minute — then generate a personal access token and sign in here to ' +
            'commit records directly.</p>' +
          '<div class="gh-actions" style="flex-direction:column;align-items:stretch;gap:.5rem">' +
            '<a class="btn primary btn-wide" href="https://github.com/signup" target="_blank" rel="noopener" style="margin-top:0;text-align:center">Create a free GitHub account ↗</a>' +
            '<a class="btn btn-wide" id="guest-signin" href="' + esc(loginHref) + '" style="margin-top:0;text-align:center">Already have one? Sign in →</a>' +
          '</div>' +
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

  function open() {
    injectModal();
    var loginHref = "login.html?r=" + encodeURIComponent(location.href);
    var si = document.getElementById("guest-signin");
    if (si) si.href = loginHref;
    document.getElementById(MODAL_ID).hidden = false;
    document.body.style.overflow = "hidden";
  }

  window.EpiGuest = { open: open };
})();
