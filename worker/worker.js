/**
 * Sniplink — Cloudflare Worker (Serverless Backend)
 * 
 * Handles URL shortening, redirects, click tracking, and stats.
 * Requires a Cloudflare KV namespace bound as `LINKS_KV`.
 * 
 * Routes:
 *   POST /api/shorten  — Shorten a URL
 *   GET  /api/stats    — Retrieve all links with click counts
 *   GET  /:shortCode   — Redirect to destination URL
 */

/* ── Helpers ───────────────────────────────────────────────────── */

/**
 * Generate a cryptographically random alphanumeric short code.
 * @param {number} length 
 * @returns {string}
 */
function generateCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

/**
 * Validate that a string is a well-formed http/https URL.
 * @param {string} str
 * @returns {boolean}
 */
function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Create a JSON Response with CORS headers.
 * @param {object} body 
 * @param {number} status 
 * @returns {Response}
 */
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * Handle CORS preflight requests.
 * @returns {Response}
 */
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/* ── Main Handler ──────────────────────────────────────────────── */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions();
    }

    /* ── POST /api/shorten ────────────────────────────────────── */
    if (method === 'POST' && pathname === '/api/shorten') {
      try {
        const body = await request.json();
        const longUrl = (body.url || '').trim();

        if (!longUrl) {
          return jsonResponse({ error: 'URL is required.' }, 400);
        }

        if (!isValidUrl(longUrl)) {
          return jsonResponse({ error: 'Invalid URL. Must start with http:// or https://' }, 400);
        }

        // Generate a unique code (retry on collision)
        let code;
        let attempts = 0;
        do {
          code = generateCode(6);
          const existing = await env.LINKS_KV.get(code);
          if (!existing) break;
          attempts++;
        } while (attempts < 5);

        if (attempts >= 5) {
          return jsonResponse({ error: 'Could not generate a unique code. Try again.' }, 500);
        }

        // Store in KV: value is JSON with URL and click counter
        const record = {
          url: longUrl,
          clicks: 0,
          createdAt: new Date().toISOString(),
        };

        await env.LINKS_KV.put(code, JSON.stringify(record));

        const shortUrl = `${url.origin}/${code}`;

        return jsonResponse({
          shortUrl,
          code,
          originalUrl: longUrl,
        }, 201);

      } catch (err) {
        return jsonResponse({ error: 'Invalid request body.' }, 400);
      }
    }

    /* ── GET /api/stats ───────────────────────────────────────── */
    if (method === 'GET' && pathname === '/api/stats') {
      try {
        const list = await env.LINKS_KV.list();
        const links = [];

        for (const key of list.keys) {
          const raw = await env.LINKS_KV.get(key.name);
          if (!raw) continue;

          try {
            const record = JSON.parse(raw);
            links.push({
              code: key.name,
              url: record.url,
              clicks: record.clicks || 0,
              shortUrl: `${url.origin}/${key.name}`,
              createdAt: record.createdAt || null,
            });
          } catch {
            // Legacy plain-text value (just the URL string)
            links.push({
              code: key.name,
              url: raw,
              clicks: 0,
              shortUrl: `${url.origin}/${key.name}`,
              createdAt: null,
            });
          }
        }

        // Sort by newest first
        links.sort((a, b) => {
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

        return jsonResponse({
          totalLinks: links.length,
          totalClicks: links.reduce((s, l) => s + l.clicks, 0),
          links,
        });

      } catch (err) {
        return jsonResponse({ error: 'Failed to fetch stats.' }, 500);
      }
    }

    /* ── GET /:shortCode (Redirect) ───────────────────────────── */
    if (method === 'GET' && pathname.length > 1 && !pathname.startsWith('/api/')) {
      const code = pathname.slice(1); // remove leading /

      try {
        const raw = await env.LINKS_KV.get(code);

        if (!raw) {
          // Short code not found — redirect to frontend 404
          return Response.redirect(`${url.origin}/#/404`, 302);
        }

        let destinationUrl;

        try {
          const record = JSON.parse(raw);
          destinationUrl = record.url;

          // Increment click counter (non-blocking)
          record.clicks = (record.clicks || 0) + 1;
          env.LINKS_KV.put(code, JSON.stringify(record)).catch(() => {});
        } catch {
          // Legacy plain-text value
          destinationUrl = raw;
        }

        // SEO-friendly 301 permanent redirect
        return Response.redirect(destinationUrl, 301);

      } catch (err) {
        return jsonResponse({ error: 'Redirect failed.' }, 500);
      }
    }

    /* ── Fallback ─────────────────────────────────────────────── */
    return jsonResponse({ error: 'Not found.' }, 404);
  },
};
