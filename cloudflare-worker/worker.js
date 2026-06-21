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
 * Deploy: see README.md. Set the secret with `wrangler secret put GH_TOKEN`
 * (a fine-grained PAT with Contents: read & write on the target repo).
 */

const CONFIG = {
  owner:  "pleuston",
  repo:   "simple-edep",
  branch: "main",
  dir:    "submissions",
  maxBytes: 256 * 1024,                       // reject anything over 256 KB
  allowOrigins: ["https://pleuston.github.io"], // plus localhost (for testing)
  perIpPerHour: 20,                            // only enforced if the RL KV is bound
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST")    return json({ error: "POST only." }, 405, cors);

    const declared = +(request.headers.get("Content-Length") || 0);
    if (declared && declared > CONFIG.maxBytes) return json({ error: "Submission too large." }, 413, cors);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400, cors); }

    // honeypot: bots fill hidden fields a human never sees
    if (body.website) return json({ error: "Rejected." }, 400, cors);

    const xml = String(body.xml || "");
    if (!xml)                       return json({ error: "Empty submission." }, 400, cors);
    if (xml.length > CONFIG.maxBytes) return json({ error: "Submission too large." }, 413, cors);
    if (!/<TEI[\s>]/.test(xml) || !/<\/TEI>/.test(xml))
      return json({ error: "Not a TEI/EpiDoc document." }, 400, cors);

    if (!env.GH_TOKEN) return json({ error: "Relay is not configured (missing token)." }, 500, cors);

    // best-effort per-IP rate limit (only if a KV namespace named RL is bound)
    const ip = request.headers.get("CF-Connecting-IP") || "anon";
    if (env.RL) {
      const key = "rl:" + ip;
      const n = +((await env.RL.get(key)) || 0);
      if (n >= CONFIG.perIpPerHour) return json({ error: "Rate limit reached — try again later." }, 429, cors);
      await env.RL.put(key, String(n + 1), { expirationTtl: 3600 });
    }

    // sanitize id → a collision-proof filename inside submissions/
    const id = (String(body.id || "").replace(/\.xml$/i, "").replace(/[^A-Za-z0-9_\-]/g, "").slice(0, 60)) || "inscription";
    const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15); // YYYYMMDDTHHMMSS
    const rand = Math.random().toString(36).slice(2, 7);
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

function corsHeaders(origin) {
  const ok = CONFIG.allowOrigins.indexOf(origin) !== -1 || /^http:\/\/localhost(:\d+)?$/.test(origin);
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
