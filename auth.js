/* auth.js — GitHub-identity session helper.
 * Identity is established at login.html via GET /user with the stored PAT.
 * localStorage holds the identity across browser restarts;
 * sessionStorage holds the live session (cleared when the tab/browser closes).
 *
 * NOTE: the whole site is public to browse AND to edit. Signing in lets you
 * save records straight to your GitHub repo; guests can still contribute via
 * the editor's "Submit as guest" flow (see guest.js). Gating is therefore off
 * for every page — the list below is kept so a page can be re-gated if needed. */
(function () {
  var UNGATED = ["login.html", "index.html", "catalog.html", "viewer.html",
                 "map.html", "docs.html", "dev.html", "about.html", "people.html",
                 "bibliography.html", "photos.html", "logs.html", "editor.html",
                 "favorites.html", ""];
  var USERNAME_KEY = "edep_gh_username";
  var SESSION_KEY  = "edep_authed";
  var LOGIN        = "login.html";

  var page = window.location.pathname.split("/").pop() || "index.html";
  var gated = UNGATED.indexOf(page) === -1;

  function redirect() {
    window.location.replace(LOGIN + "?r=" + encodeURIComponent(window.location.href));
  }

  if (gated) {
    var username = localStorage.getItem(USERNAME_KEY);
    if (!username) { redirect(); return; }
    if (sessionStorage.getItem(SESSION_KEY) !== username) { redirect(); return; }
  }

  // Mark active link in the secondary (right-side) nav
  document.addEventListener("DOMContentLoaded", function () {
    var secLink = document.querySelector('.sitenav-right a[href="' + page + '"]');
    if (secLink) secLink.classList.add('active');
  });

  // Patch the topbar account control (and legacy sign-out button) after DOM loads
  document.addEventListener("DOMContentLoaded", function () {
    var u = localStorage.getItem(USERNAME_KEY);
    var av = localStorage.getItem("edep_gh_avatar") || "";
    var name = localStorage.getItem("edep_gh_name") || u || "";

    // EDEP-style account link: person icon + "Login" / "@username"
    var acct = document.querySelector("[data-account]");
    if (acct) {
      var label = acct.querySelector(".account-label");
      if (u) {
        if (label) label.textContent = "@" + u;
        acct.removeAttribute("href");
        acct.title = name + " · click to sign out";
        acct.onclick = function (e) { e.preventDefault(); EpiAuth.signOut(); };
        // swap the generic person icon for the user's GitHub avatar (epiwen-style)
        var icon = acct.querySelector("svg");
        if (icon && av) {
          var img = document.createElement("img");
          img.src = av; img.alt = "@" + u; img.className = "account-avatar"; img.width = 20; img.height = 20;
          icon.parentNode.replaceChild(img, icon);
        }
      } else {
        if (label) label.textContent = "Login";
        acct.setAttribute("href", LOGIN);
      }
    }

    // legacy sign-out button (editor toolbar)
    var btn = document.querySelector("[data-signout]");
    if (btn) {
      if (!u) { btn.textContent = "Sign in"; btn.onclick = function () { window.location.href = LOGIN; }; }
      else {
        var img = av ? '<img src="' + av + '" width="18" height="18" alt="" style="border-radius:50%;vertical-align:middle;margin-right:.3rem;display:inline-block"> ' : "";
        btn.innerHTML = img + "@" + u;
        btn.title = name + " · click to sign out";
        btn.onclick = function () { EpiAuth.signOut(); };
      }
    }
  });
})();

window.EpiAuth = {
  getUser: function () {
    return {
      username: localStorage.getItem("edep_gh_username") || "",
      avatar:   localStorage.getItem("edep_gh_avatar")   || "",
      name:     localStorage.getItem("edep_gh_name")     || "",
      token:    localStorage.getItem("edep_gh_token")    || ""
    };
  },
  isSignedIn: function () {
    var u = localStorage.getItem("edep_gh_username");
    return !!u && sessionStorage.getItem("edep_authed") === u;
  },
  /* full=true clears stored identity + token (switch account);
     full=false (default) keeps identity, just ends the session. */
  signOut: function (full) {
    sessionStorage.removeItem("edep_authed");
    if (full) {
      ["edep_gh_username", "edep_gh_avatar", "edep_gh_name",
       "edep_gh_token", "edep_gh_owner", "edep_gh_repo",
       "edep_gh_branch", "edep_gh_path"
      ].forEach(function (k) { localStorage.removeItem(k); });
    }
    window.location.href = "login.html";
  }
};
