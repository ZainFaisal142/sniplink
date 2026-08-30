/**
 * ===================================================================
 * FILE 5: /worker/worker.js
 * Cloudflare Worker Serverless Backend with LINKS_KV Storage
 * ===================================================================
 * 
 * Endpoints:
 *  1. OPTIONS (Global) -> Returns 200 with CORS headers
 *  2. POST /api/shorten -> Validates URL, generates 6-char code, stores
 *                          JSON payload { url, clicks: 0, createdAt },
 *                          returns shortCode.
 *  3. GET /api/stats    -> Lists all active keys in LINKS_KV, returns
 *                          aggregated array of link metrics.
 *  4. GET /:shortCode   -> Async increments click count via ctx.waitUntil(),
 *                          performs fast 302 redirect to destination,
 *                          or 302 redirect to frontend 404.
 */

/* ── 1. Global CORS Configuration ──────────────────────────────── */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Creates a JSON response with full CORS headers.
 * @param {any} body
 * @param {number} status
 * @returns {Response}
 */
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

/**
 * Handles CORS Preflight (OPTIONS) requests.
 * @returns {Response}
 */
function handleCorsPreflight() {
  return new Response(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

/**
 * Generates a cryptographically secure 6-character alphanumeric slug.
 * @param {number} length
 * @returns {string}
 */
function generateShortCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, (b) => chars[b % chars.length]).join('');
}

/**
 * Validates that a string is a valid HTTP/HTTPS URL.
 * @param {string} str
 * @returns {boolean}
 */
function isValidUrl(str) {
  try {
    const parsed = new URL(str);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Retrieves the Cloudflare KV namespace instance bound under LINKS_KV or URL_DB.
 * @param {object} env
 * @returns {KVNamespace}
 */
function getKV(env) {
  const kv = env?.LINKS_KV || env?.URL_DB || (typeof LINKS_KV !== 'undefined' ? LINKS_KV : null);
  if (!kv) {
    throw new Error('KV namespace binding "LINKS_KV" not found. Please ensure it is bound in wrangler.toml.');
  }
  return kv;
}

/* ── Main Cloudflare Worker Handler ────────────────────────────── */
export default {
  /**
   * Main Fetch Handler (ES Module Syntax)
   * @param {Request} request
   * @param {object} env - Cloudflare Worker environment bindings
   * @param {ExecutionContext} ctx - Execution context for background tasks
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method.toUpperCase();

    // 1. Handle CORS Preflight Requests
    if (method === 'OPTIONS') {
      return handleCorsPreflight();
    }

    /* ── 2. Endpoint: POST /api/shorten ─────────────────────────── */
    if (method === 'POST' && pathname === '/api/shorten') {
      try {
        const kv = getKV(env);
        let body;

        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
        }

        const targetUrl = (body?.url || body?.longUrl || '').trim();

        // Validate presence of URL
        if (!targetUrl) {
          return jsonResponse({ error: 'URL is required.' }, 400);
        }

        // Validate URL format (http / https)
        if (!isValidUrl(targetUrl)) {
          return jsonResponse({ error: 'Invalid URL format. Must start with http:// or https://' }, 400);
        }

        // Generate unique 6-character alphanumeric shortcode (with collision retries)
        let shortCode = '';
        let attempts = 0;
        do {
          shortCode = generateShortCode(6);
          const existing = await kv.get(shortCode);
          if (!existing) break;
          attempts++;
        } while (attempts < 5);

        if (attempts >= 5) {
          return jsonResponse({ error: 'Could not generate a unique short code. Please try again.' }, 500);
        }

        // Store JSON payload in LINKS_KV
        const record = {
          url: targetUrl,
          clicks: 0,
          createdAt: Date.now(),
        };

        await kv.put(shortCode, JSON.stringify(record));
        await kv.put(`clicks:${shortCode}`, '0');

        return jsonResponse({
          shortCode,
          code: shortCode,
          shortUrl: `${url.origin}/${shortCode}`,
          originalUrl: targetUrl,
        }, 200);

      } catch (err) {
        return jsonResponse({ error: err.message || 'Server error while shortening URL.' }, 500);
      }
    }

    /* ── 3. Endpoint: GET /api/stats (and /api/analytics) ──────── */
    if (method === 'GET' && (pathname === '/api/stats' || pathname === '/api/analytics')) {
      try {
        const kv = getKV(env);

        // List all active keys from LINKS_KV
        const listResult = await kv.list();
        const keys = listResult.keys || [];

        // Filter out auxiliary click-counter keys
        const primaryKeys = keys.filter((k) => !k.name.startsWith('clicks:'));
        const aggregatedList = [];

        for (const key of primaryKeys) {
          const shortCode = key.name;
          const raw = await kv.get(shortCode);
          if (!raw) continue;

          let destinationUrl = raw;
          let clicks = 0;
          let createdAt = null;

          try {
            const record = JSON.parse(raw);
            destinationUrl = record.url || raw;
            clicks = typeof record.clicks === 'number' ? record.clicks : 0;
            createdAt = record.createdAt || null;
          } catch {
            destinationUrl = raw;
          }

          // Check if separate click counter exists and is higher
          try {
            const clickStr = await kv.get(`clicks:${shortCode}`);
            if (clickStr !== null) {
              const directClicks = parseInt(clickStr, 10) || 0;
              clicks = Math.max(clicks, directClicks);
            }
          } catch (e) {}

          aggregatedList.push({
            shortCode,
            code: shortCode,
            url: destinationUrl,
            originalUrl: destinationUrl,
            shortUrl: `${url.origin}/${shortCode}`,
            clicks,
            createdAt,
          });
        }

        // Sort newest first
        aggregatedList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        return jsonResponse(aggregatedList, 200);

      } catch (err) {
        return jsonResponse({ error: err.message || 'Failed to fetch metrics from LINKS_KV.' }, 500);
      }
    }

    /* ── 4. Dynamic Redirector: GET /:shortCode ─────────────────── */
    if (method === 'GET' && pathname.length > 1 && !pathname.startsWith('/api/')) {
      const shortCode = pathname.slice(1); // Remove leading slash

      try {
        const kv = getKV(env);
        const raw = await kv.get(shortCode);

        if (raw) {
          let destinationUrl = raw;
          let currentRecord = null;

          try {
            currentRecord = JSON.parse(raw);
            if (currentRecord && currentRecord.url) {
              destinationUrl = currentRecord.url;
            }
          } catch {
            destinationUrl = raw;
          }

          // Asynchronously increment click count in the background using ctx.waitUntil()
          const incrementClickTask = async () => {
            try {
              if (currentRecord) {
                currentRecord.clicks = (currentRecord.clicks || 0) + 1;
                await kv.put(shortCode, JSON.stringify(currentRecord));
              }
              const clickStr = await kv.get(`clicks:${shortCode}`);
              const count = clickStr !== null ? parseInt(clickStr, 10) || 0 : 0;
              await kv.put(`clicks:${shortCode}`, String(count + 1));
            } catch (err) {
              console.error(`Click increment error for ${shortCode}:`, err);
            }
          };

          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(incrementClickTask());
          } else {
            incrementClickTask();
          }

          // Immediately issue fast HTTP 302 redirect
          return Response.redirect(destinationUrl, 302);
        } else {
          // Short code not found -> 302 redirect to Vercel frontend 404
          return Response.redirect('https://sniplink-zain.vercel.app/404', 302);
        }

      } catch (err) {
        return Response.redirect('https://sniplink-zain.vercel.app/404', 302);
      }
    }

    // Root Welcome Endpoint
    if (pathname === '/' || pathname === '') {
      return jsonResponse({
        service: 'SnipLink Edge Shortener API',
        status: 'online',
        endpoints: {
          shorten: 'POST /api/shorten',
          stats: 'GET /api/stats',
          redirect: 'GET /:shortCode',
        },
      }, 200);
    }

    return jsonResponse({ error: 'Route not found.' }, 404);
  },
};
