# simple-edep guest-submission relay (Cloudflare Worker)

This Worker lets visitors submit an EpiDoc record **without their own GitHub
token**. The browser POSTs the XML to the Worker; the Worker — which alone holds
a write token (kept as an encrypted secret, never shipped to the client) —
commits it into the public `submissions/` folder of the target repository.

Without this relay, anonymous "Save as guest" cannot reach GitHub: the write API
requires a credential, and a token embedded in the static site would be
extractable by anyone and auto-revoked by GitHub secret scanning. The Worker is
the safe place for that credential.

## What it does

`POST /` with `{"id": "<name>", "xml": "<TEI…>"}` →
commits `submissions/<id>-<timestamp>-<rand>.xml` and returns
`{ ok, path, html_url, commit }`.

Safeguards: cross-site browser writes are rejected (server-side Origin check);
the body is stream-capped at 256 KB **before** it is parsed; a TEI/EpiDoc shape
check; sanitized, collision-proof filenames; a honeypot field; CORS limited to
the site origin; and — when the `RL` KV namespace is bound — a per-IP hourly
limit plus a global daily ceiling.

> A public, anonymous write endpoint is inherently reachable by direct
> (non-browser) clients, which can spoof/omit the `Origin` header. So **bind the
> `RL` namespace** (step 4) for any public deployment, keep submissions in the
> isolated `submissions/` folder for moderation, and consider adding Cloudflare
> Turnstile or WAF rate-limiting rules for stronger protection.

## Deploy (once)

1. **Install Wrangler** and sign in:
   ```bash
   npm i -g wrangler
   wrangler login
   ```

2. **Create the write token.** A GitHub **fine-grained PAT** scoped to *only* the
   target repo (default `pleuston/simple-edep`) with **Contents: Read and write**.
   Using a dedicated bot/machine account is recommended so guest commits are
   clearly attributed and easy to revoke.

3. **Store it as the Worker secret** (never goes in code or `wrangler.toml`):
   ```bash
   cd cloudflare-worker
   wrangler secret put GH_TOKEN      # paste the PAT when prompted
   ```

4. **Rate limiting (recommended).** Create a KV namespace and uncomment the
   `[[kv_namespaces]]` block in `wrangler.toml` with the returned id. This turns
   on the per-IP hourly limit and the global daily ceiling; without it the relay
   accepts unlimited writes.
   ```bash
   wrangler kv namespace create RL
   ```

5. **Deploy:**
   ```bash
   wrangler deploy
   ```
   Copy the printed URL, e.g. `https://simple-edep-guest-relay.<you>.workers.dev`.

6. **Point the app at it.** Either edit `DEFAULT_ENDPOINT` in `guest.js`, or in
   the browser console on the site:
   ```js
   localStorage.setItem("edep_guest_endpoint", "https://simple-edep-guest-relay.<you>.workers.dev")
   ```

## Configure

Edit `CONFIG` at the top of `worker.js` to change the target `owner`/`repo`/
`branch`, the `submissions` directory, the size cap, the allowed origins, or the
rate limit, then `wrangler deploy` again.

## Note

`guest.js` also offers a second, **zero-infrastructure** route — "Propose as a
GitHub pull request" — which opens GitHub's prefilled new-file page and submits
under the visitor's own GitHub login. That route needs no Worker and no secret,
but requires the visitor to have a GitHub account and only suits smaller records
(URL length limit). The Worker is what enables truly anonymous submission.
