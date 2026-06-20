# simple-edep

**A static, client-side EpiDoc editor for Roman/Latin epigraphy.**

Encode inscriptions as [EpiDoc](https://epidoc.stoa.org/)/TEI XML in the browser with a live
**Leiden+ → EpiDoc** editor, and commit them straight to GitHub with your own personal access
token. No server, no database — just HTML, JavaScript, and the GitHub Contents API.

🔗 **Live site:** https://pleuston.github.io/simple-edep/

Modelled on the [epiwen](https://pleuston.github.io/epiwen/) framework; the Leiden engine is
[jinn-codemirror](https://github.com/JinnElements/jinn-codemirror) (vendored, no CDN).

## Features

- **Live Leiden+ ↔ EpiDoc editor** — type with Leiden conventions and get EpiDoc XML
  automatically; paste from **EDCS** or **PHI** and convert with one click.
- **Full Roman EpiDoc form** — object & support, dimensions and letter heights, layout & script,
  EDH text type, Roman dating (`origDate`), find spot with coordinates, apparatus, translation,
  commentary, bibliography, and cross-reference IDs (EDH, EDCS, EDR, Trismegistos, PHI, CIL).
- **Save to GitHub** — commits to `records/*.xml` via the Contents API using a personal access token
  stored only in your browser. Copy/Download for manual commits too.
- **Catalogue** — browse, search and re-edit (XML → form round-trip preserves the Leiden markup).
- **Reading view & find-spot map** — rendered text with Leiden display conventions; Leaflet map of
  find spots.

## Project layout

| Path | Contents |
| --- | --- |
| `index.html` | Landing page |
| `login.html`, `auth.js` | GitHub token sign-in / session gate |
| `editor.html`, `app.js` | Metadata form + the embedded Leiden editor |
| `generator.js` | Pure EpiDoc/TEI serializer (Node-requireable, unit-tested) |
| `reading.js` | EpiDoc → HTML reading renderer |
| `catalog.html`, `catalog.js` | Browse / search / round-trip into the editor |
| `viewer.html` | Reading view + facsimile image |
| `map.html`, `map.js` | Leaflet find-spot map |
| `vocab.js` | Controlled vocabularies (object types, materials, text types, …) |
| `github.js`, `data.js` | GitHub Contents API save / read |
| `records/*.xml` | The inscription records |
| `data/records-index.json` | Generated summary index (catalogue + map) |
| `vendor/` | jinn-codemirror bundle + `tei.json`, Leaflet |
| `scripts/` | `make-seeds.js`, `build-index.js`, `test-generator.js` |

## Develop locally

```sh
python3 -m http.server 8000   # then open http://localhost:8000/
node scripts/test-generator.js   # unit-test the serializer
node scripts/build-index.js      # rebuild data/records-index.json from records/
```

## Saving

Sign in at `login.html` with a GitHub [personal access token](https://github.com/settings/tokens/new?scopes=public_repo&description=simple-edep)
(`public_repo` scope). The editor's **② Save to GitHub** commits the current record to `records/`.
The token never leaves your browser except in the request to `api.github.com`.

## Licence

Code: MIT. Records: CC BY 4.0 unless stated otherwise. jinn-codemirror is MIT (JinnTec GmbH).
