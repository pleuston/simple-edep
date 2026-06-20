/* modal.js — shared "How to" workflow modal.
 * Injected once per page; opened by any [data-workflow-modal] button. */
(function () {
  "use strict";
  var ID = "workflow-modal";
  var injected = false;

  function html() {
    return '<div id="' + ID + '" class="modal-overlay" hidden role="dialog" aria-modal="true">' +
      '<div class="modal-box">' +
        '<button class="modal-close" data-close aria-label="Close">&#x2715;</button>' +
        '<h2 class="modal-title">How simple-edep works</h2>' +
        '<div class="workflow-grid">' +
          '<div class="workflow-card"><div class="workflow-num">1</div>' +
            '<h3>Edit an inscription</h3>' +
            '<ol>' +
              '<li>Open the <a href="editor.html">Editor</a> (or “Edit” on a catalogue entry).</li>' +
              '<li>Fill the metadata: object, dating, find spot, IDs.</li>' +
              '<li>Type the text in the <strong>Leiden+ editor</strong> — it converts to EpiDoc XML live. Paste from EDCS / PHI and click <em>Import</em> to auto-convert.</li>' +
            '</ol>' +
          '</div>' +
          '<div class="workflow-card"><div class="workflow-num">2</div>' +
            '<h3>Save to GitHub</h3>' +
            '<ol>' +
              '<li>Sign in with a <a href="https://github.com/settings/tokens/new?scopes=public_repo&description=simple-edep" target="_blank" rel="noopener">personal access token</a> (<code>public_repo</code> scope).</li>' +
              '<li>Click <strong>② Save to GitHub</strong> — it commits the XML straight into <code>records/</code>.</li>' +
              '<li>Or <strong>Copy XML</strong> / <strong>Download</strong> and commit by hand.</li>' +
            '</ol>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function inject() {
    if (injected) return;
    injected = true;
    var d = document.createElement("div");
    d.innerHTML = html();
    document.body.appendChild(d.firstElementChild);
    var el = document.getElementById(ID);
    el.addEventListener("click", function (e) { if (e.target === el || e.target.hasAttribute("data-close")) hide(); });
  }
  function show() { inject(); document.getElementById(ID).hidden = false; }
  function hide() { var el = document.getElementById(ID); if (el) el.hidden = true; }

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-workflow-modal]") : null;
    if (t) { e.preventDefault(); show(); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });

  window.EpiModal = { show: show, hide: hide };
})();
