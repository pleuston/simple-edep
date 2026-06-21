/* recordview.js — render an inscription (reading + IIIF photo frame) into a set
 * of host elements. Shared by the standalone viewer and the catalogue's
 * right-side reading panel. The photo frame is an OpenSeadragon IIIF deep-zoom
 * viewer with three size presets (S/M/L). heidICON images are hotlinked. */
(function () {
  "use strict";
  var seq = 0, _photos = null, _photosP = null;

  function getPhotos() {
    if (_photos) return Promise.resolve(_photos);
    if (_photosP) return _photosP;
    _photosP = EpiCollections.getJSON(EpiCollections.get("edh").photos).then(function (a) { _photos = a || []; return _photos; });
    return _photosP;
  }

  // opts: { id, col, reading, imageHost, thumbs, credit }
  function load(opts) {
    var url = EpiCollections.recordUrl(opts.id + ".xml", opts.col);
    if (opts.imageHost) opts.imageHost.innerHTML = '<div class="viewer-noimage">Loading…</div>';
    if (opts.thumbs) opts.thumbs.innerHTML = "";
    if (opts.credit) opts.credit.innerHTML = "";
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(function (xml) {
        if (opts.reading) opts.reading.innerHTML = EpiDocReader.render(xml);
        loadPhotos(xml, opts);
      })
      .catch(function (e) { if (opts.reading) opts.reading.innerHTML = "<p>Could not load record: " + esc(e.message) + "</p>"; });
  }

  function loadPhotos(xml, opts) {
    var host = opts.imageHost; if (!host) return;
    if (opts.col !== "edh") { fallbackGraphic(xml, opts); return; }
    getPhotos().then(function (all) {
      var photos = all.filter(function (p) { return p.hd === opts.id && p.iiif; });
      if (!photos.length) { fallbackGraphic(xml, opts); return; }
      var oid = "osd-" + (++seq);
      host.innerHTML =
        '<div class="img-frame size-m">' +
          '<div class="img-presets" role="group" aria-label="image size">' +
            '<button type="button" data-size="s">S</button>' +
            '<button type="button" data-size="m" class="on">M</button>' +
            '<button type="button" data-size="l">L</button>' +
          '</div><div id="' + oid + '" class="osd"></div></div>';
      if (opts.credit) opts.credit.innerHTML =
        'Photo: Epigraphische Fotothek Heidelberg / <a href="' + esc(photos[0].detail || "https://heidicon.ub.uni-heidelberg.de/") + '" target="_blank" rel="noopener">heidICON</a> (Free Access)';
      var osd = OpenSeadragon({ id: oid, prefixUrl: "vendor/openseadragon/images/", showNavigator: false, tileSources: photos[0].iiif + "/info.json" });
      osd.addHandler("open-failed", function () { imgFallback(photos[0], opts); });
      wirePresets(host, osd);
      renderThumbs(photos, osd, opts.thumbs);
    }).catch(function () { fallbackGraphic(xml, opts); });
  }

  function wirePresets(host, osd) {
    var frame = host.querySelector(".img-frame");
    Array.prototype.forEach.call(host.querySelectorAll(".img-presets button"), function (b) {
      b.addEventListener("click", function () {
        frame.className = "img-frame size-" + b.getAttribute("data-size");
        Array.prototype.forEach.call(host.querySelectorAll(".img-presets button"), function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        setTimeout(function () { try { osd.viewport.goHome(true); } catch (e) {} }, 80);
      });
    });
  }

  function renderThumbs(photos, osd, thumbs) {
    if (!thumbs) return;
    if (photos.length < 2) { thumbs.innerHTML = ""; return; }
    thumbs.innerHTML = photos.map(function (p, i) {
      return '<img class="iiif-thumb' + (i === 0 ? " on" : "") + '" data-i="' + i + '" src="' + esc(p.thumb || p.iiif + "/full/!120,120/0/default.jpg") + '" alt="">';
    }).join("");
    Array.prototype.forEach.call(thumbs.querySelectorAll(".iiif-thumb"), function (el) {
      el.addEventListener("click", function () {
        var i = +el.getAttribute("data-i");
        osd.open(photos[i].iiif + "/info.json");
        Array.prototype.forEach.call(thumbs.querySelectorAll(".iiif-thumb"), function (x) { x.classList.remove("on"); });
        el.classList.add("on");
      });
    });
  }

  function imgFallback(p, opts) {
    opts.imageHost.innerHTML = '<div class="img-frame size-m"><img class="viewer-image" src="' + esc(p.iiif + "/full/!1200,1200/0/default.jpg") + '" alt=""></div>';
  }
  function fallbackGraphic(xml, opts) {
    var m = xml.match(/<graphic url="([^"#][^"]*)"/);
    if (m) opts.imageHost.innerHTML = '<img class="viewer-image" src="' + m[1].replace(/"/g, "&quot;") + '" alt="">';
    else opts.imageHost.innerHTML = '<div class="viewer-noimage">No image for this record.</div>';
    if (opts.credit) opts.credit.innerHTML = "";
  }

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  window.RecordView = { load: load };
})();
