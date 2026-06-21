/* worker.js — anonymous guest-submission relay for simple-edep.
 *
 * Lets visitors contribute an EpiDoc record WITHOUT their own GitHub token:
 * the browser POSTs the XML here, and this Worker — which alone holds a write
 * token (the secret GH_TOKEN, never exposed to the client) — commits it into a
 * public `submissions/` folder of the target repository.
 *
 * Why a Worker and not a token in the page: a token shipped in static JS is
 * extractable by anyone and is auto-revoked by GitHub secret scanning. Keeping
 * it in a Worker secret is the only safe way to allow keyless guest saves.
 *
 * Abuse model: a public anonymous write endpoint is inherently abusable by
 * direct (non-browser) clients. This Worker rejects cross-site browser writes
 * (Origin enforcement), bounds the body before parsing, and — when the RL KV is
 * bound — enforces a per-IP AND a global daily ceiling. For a public deployment
 * you SHOULD bind RL (see README) and consider Cloudflare Turnstile / WAF rate
 * limiting. Submissions land in an isolated submissions/ folder for moderation.
 *
 * Deploy: see README.md. Set the secret with `wrangler secret put GH_TOKEN`.
 */

const CONFIG = {
  owner:  "pleuston",
  repo:   "simple-edep",
  branch: "main",
  dir:    "submissions",
  maxBytes: 256 * 1024,                          // reject anything over 256 KB
  allowOrigins: ["https://pleuston.github.io"],  // plus localhost (for testing)
  perIpPerHour: 20,                              // enforced only if the RL KV is bound
  maxPerDay: 300,                                // global ceiling, also needs RL
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const originOk = isAllowedOrigin(origin);
    const cors = corsHeaders(origin, originOk);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST")    return json({ error: "POST only." }, 405, cors);

    // A present-but-disallowed Origin means a drive-by site is trying to drive a
    // write — reject it. (Non-browser clients can omit/spoof Origin, so this is
    // paired with the rate limit below and downstream moderation.)
    if (origin && !originOk) return json({ error: "Forbidden origin." }, 403, cors);

    // Fast-reject an oversized declared length, then read the body with a hard
    // streaming cap so memory is bounded even when Content-Length is absent
    // (chunked) or spoofed — never buffer more than maxBytes.
    const declared = +(request.headers.get("Content-Length") || 0);
    if (declared > CONFIG.maxBytes) return json({ error: "Submission too large." }, 413, cors);
    let raw;
    try { raw = await readCapped(request, CONFIG.maxBytes); } catch { return json({ error: "Unreadable body." }, 400, cors); }
    if (raw == null) return json({ error: "Submission too large." }, 413, cors);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid JSON body." }, 400, cors); }

    // honeypot: bots fill hidden fields a human never sees
    if (body.website) return json({ error: "Rejected." }, 400, cors);

    const xml = String(body.xml || "");
    if (!xml)                       return json({ error: "Empty submission." }, 400, cors);
    if (xml.length > CONFIG.maxBytes) return json({ error: "Submission too large." }, 413, cors);
    if (!/<TEI[\s>]/.test(xml) || !/<\/TEI>/.test(xml))
      return json({ error: "Not a TEI/EpiDoc document." }, 400, cors);

    if (!env.GH_TOKEN) return json({ error: "Relay is not configured (missing token)." }, 500, cors);

    // per-IP AND global daily ceiling (only if a KV namespace named RL is bound)
    if (env.RL) {
      const ip = request.headers.get("CF-Connecting-IP") || "anon";
      const day = new Date().toISOString().slice(0, 10);
      const gKey = "gl:" + day, ipKey = "rl:" + ip;
      const gl = +((await env.RL.get(gKey)) || 0);
      if (gl >= CONFIG.maxPerDay)   return json({ error: "Daily submission limit reached — try again tomorrow." }, 429, cors);
      const n = +((await env.RL.get(ipKey)) || 0);
      if (n >= CONFIG.perIpPerHour) return json({ error: "Rate limit reached — try again later." }, 429, cors);
      await env.RL.put(ipKey, String(n + 1), { expirationTtl: 3600 });
      await env.RL.put(gKey, String(gl + 1), { expirationTtl: 172800 });
    }

    // sanitize id → a collision-proof filename inside submissions/
    const id = (String(body.id || "").replace(/\.xml$/i, "").replace(/[^A-Za-z0-9_\-]/g, "").slice(0, 60)) || "inscription";
    const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15); // YYYYMMDDTHHMMSS
    const rand = crypto.randomUUID().split("-")[0];                            // 8 hex chars
    const path = `${CONFIG.dir}/${id}-${stamp}-${rand}.xml`;

    const apiUrl = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`;
    const put = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        "Authorization": "Bearer " + env.GH_TOKEN,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "simple-edep-guest-relay",
      },
      body: JSON.stringify({
        message: `Guest submission: ${id}`,
        content: b64(xml),
        branch: CONFIG.branch,
      }),
    });

    if (!put.ok) {
      const detail = (await put.text()).slice(0, 300);
      return json({ error: "GitHub rejected the commit.", detail }, 502, cors);
    }
    const data = await put.json();
    return json({
      ok: true,
      path,
      html_url: data.content && data.content.html_url,
      commit:   data.commit && data.commit.html_url,
    }, 201, cors);
  },
};

// Read the request body, aborting as soon as it exceeds `cap` bytes (returns
// null), so an attacker cannot force us to buffer a huge payload before the
// size check. Works without a Content-Length (chunked/streamed) request.
async function readCapped(request, cap) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  let received = 0;
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > cap) { try { await reader.cancel(); } catch (e) {} return null; }
    chunks.push(value);
  }
  const buf = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
  return new TextDecoder().decode(buf);
}

function isAllowedOrigin(origin) {
  return CONFIG.allowOrigins.indexOf(origin) !== -1 || /^http:\/\/localhost(:\d+)?$/.test(origin);
}

function corsHeaders(origin, ok) {
  return {
    "Access-Control-Allow-Origin": ok ? origin : CONFIG.allowOrigins[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ "Content-Type": "application/json" }, cors),
  });
}

// UTF-8-safe base64 for the GitHub Contents API
function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
