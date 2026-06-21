/* recordview.js — render an inscription (reading + IIIF photo frame + a small
 * find-spot map) into a set of host elements. Shared by the standalone viewer,
 * the catalogue's right-side reading panel, and the people register. The photo
 * frame is an OpenSeadragon IIIF deep-zoom viewer with three size presets
 * (S/M/L); heidICON images are hotlinked. The map is a small Leaflet map placed
 * on the find-spot — coordinates come from the caller (the index), else the
 * record's <geo>, else the EDH Pleiades gazetteer.
 *
 * A monotonic load id (_loadSeq) guards the async photo/map work so that fast
 * record switching, or closing the panel mid-load, can never paint a stale
 * record's image/map into the shared host. */
(function () {
  "use strict";
  var seq = 0, _loadSeq = 0, _photos = null, _photosP = null, _geo = null, _geoP = null, _map = null;

  function getPhotos() {
    if (_photos) return Promise.resolve(_photos);
    if (_photosP) return _photosP;
    _photosP = EpiCollections.getJSON(EpiCollections.get("edh").photos).then(function (a) { _photos = a || []; return _photos; });
    return _photosP;
  }
  // EDH find-spot gazetteer, Pleiades URI -> [lat, lng] (cached; ~4 MB JSON,
  // fetched only for EDH records that arrive without coordinates)
  function getGeo() {
    if (_geo) return Promise.resolve(_geo);
    if (_geoP) return _geoP;
    _geoP = EpiCollections.getJSON(EpiCollections.get("edh").geo).then(function (a) {
      _geo = {}; (a || []).forEach(function (g) { if (g.pleiades) _geo[g.pleiades.replace(/\/$/, "")] = [g.lat, g.lng]; });
      return _geo;
    });
    return _geoP;
  }

  // opts: { id, col, reading, imageHost, thumbs, credit, map, lat, lng }
  function load(opts) {
    clearMap();                       // supersede any in-flight load + drop its map
    var myId = _loadSeq;
    opts._loadId = myId;
    var url = EpiCollections.recordUrl(opts.id + ".xml", opts.col);
    if (opts.imageHost) opts.imageHost.innerHTML = '<div class="viewer-noimage">Loading…</div>';
    if (opts.thumbs) opts.thumbs.innerHTML = "";
    if (opts.credit) opts.credit.innerHTML = "";
    if (opts.map) { opts.map.style.display = "none"; opts.map.innerHTML = ""; }
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(function (xml) {
        if (opts._loadId !== _loadSeq) return;   // a newer load (or a close) superseded us
        if (opts.reading) opts.reading.innerHTML = EpiDocReader.render(xml);
        loadPhotos(xml, opts);
        loadMap(xml, opts);
      })
      .catch(function (e) { if (opts._loadId === _loadSeq && opts.reading) opts.reading.innerHTML = "<p>Could not load record: " + esc(e.message) + "</p>"; });
  }

  function loadPhotos(xml, opts) {
    var host = opts.imageHost; if (!host) return;
    if (opts.col !== "edh") { fallbackGraphic(xml, opts); return; }
    getPhotos().then(function (all) {
      if (opts._loadId !== _loadSeq) return;
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
      osd.addHandler("open-failed", function () { if (opts._loadId === _loadSeq) imgFallback(photos[0], opts); });
      wirePresets(host, osd);
      renderThumbs(photos, osd, opts.thumbs);
    }).catch(function () { if (opts._loadId === _loadSeq) fallbackGraphic(xml, opts); });
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
  // For non-EDH records: embed the first browser-displayable <graphic> (skip
  // .tif), resolving a relative url against the collection's records base, and
  // fall back gracefully if it fails to load. I.Sicily images live on the
  // I.Sicily site, so also surface a link to the source record.
  function fallbackGraphic(xml, opts) {
    var host = opts.imageHost;
    var url = "", re = /<graphic\b[^>]*\burl="([^"#][^"]*)"[^>]*>/g, m, first = "";
    while ((m = re.exec(xml))) { if (!first) first = m[1]; if (!/\.(tif|tiff)$/i.test(m[1])) { url = m[1]; break; } }
    if (!url) url = first;
    if (url) {
      if (!/^https?:\/\//i.test(url)) {
        var c = EpiCollections.get(opts.col);
        url = (c && c.records ? c.records : "") + url.replace(/^.*\//, "");
      }
      host.innerHTML = '<img class="viewer-image" alt="">';
      var img = host.querySelector("img");
      img.onerror = function () { noImage(host); };
      img.src = url;
    } else { noImage(host); }
    if (opts.credit) {
      var uri = (xml.match(/<idno type="URI">([^<]+)<\/idno>/) || [])[1];
      opts.credit.innerHTML = (opts.col === "isic" && uri)
        ? 'Image &amp; record: <a href="' + esc(uri) + '" target="_blank" rel="noopener">I.Sicily ↗</a> (CC BY 4.0)'
        : "";
    }
  }
  function noImage(host) { host.innerHTML = '<div class="viewer-noimage">No image for this record.</div>'; }

  // ---- find-spot map -------------------------------------------------------
  function pick(s, re) { var m = String(s).match(re); return m ? m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : ""; }
  function placeLabel(xml) {
    var modern = pick(xml, /<placeName type="modern"[^>]*>([^<]*)</) || pick(xml, /<settlement[^>]*>([^<]*)</);
    var region = pick(xml, /<placeName type="region"[^>]*>([^<]*)</) || pick(xml, /<placeName type="province"[^>]*>([^<]*)</);
    return [modern, region].filter(Boolean).join(" · ");
  }
  function resolveCoords(xml, opts) {
    if (opts.lat != null && opts.lat !== "" && opts.lng != null && opts.lng !== "")
      return Promise.resolve([parseFloat(opts.lat), parseFloat(opts.lng)]);
    var g = xml.match(/<geo>([^<]+)<\/geo>/);
    if (g) { var p = g[1].split(/[,\s]+/).filter(Boolean); if (p.length >= 2) return Promise.resolve([parseFloat(p[0]), parseFloat(p[1])]); }
    if (opts.col === "edh") {
      var pm = xml.match(/<placeName[^>]*ref="(https:\/\/pleiades\.stoa\.org\/places\/\d+)"[^>]*>/);
      if (pm) return getGeo().then(function (mp) { return mp[pm[1].replace(/\/$/, "")] || null; });
    }
    return Promise.resolve(null);
  }
  function loadMap(xml, opts) {
    var host = opts.map; if (!host || typeof L === "undefined") return;
    resolveCoords(xml, opts).then(function (c) {
      if (opts._loadId !== _loadSeq) return;            // superseded by a newer load or a close
      if (!c || isNaN(c[0]) || isNaN(c[1])) { host.style.display = "none"; host.innerHTML = ""; return; }
      removeMap();
      host.style.display = ""; host.innerHTML = "";
      var m = L.map(host, { scrollWheelZoom: false, attributionControl: true }).setView([c[0], c[1]], 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(m);
      var label = placeLabel(xml);
      var osm = "https://www.openstreetmap.org/?mlat=" + c[0] + "&mlon=" + c[1] + "#map=9/" + c[0] + "/" + c[1];
      L.marker([c[0], c[1]]).addTo(m)
        .bindPopup((label ? "<strong>" + esc(label) + "</strong><br>" : "") +
          '<a href="' + osm + '" target="_blank" rel="noopener">OpenStreetMap ↗</a>');
      _map = m;
      setTimeout(function () { try { m.invalidateSize(); } catch (e) {} }, 60);
      setTimeout(function () { try { m.invalidateSize(); } catch (e) {} }, 320);
    });
  }
  function removeMap() { if (_map) { try { _map.remove(); } catch (e) {} _map = null; } }
  // public: cancel any in-flight load (so its async callbacks bail) and drop the map
  function clearMap() { _loadSeq++; removeMap(); }

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  window.RecordView = { load: load, clearMap: clearMap };
})();
