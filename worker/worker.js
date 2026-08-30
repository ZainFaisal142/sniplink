/**
 * ===================================================================
 * Sniplink — Cloudflare Worker (Serverless Backend)
 * ===================================================================
 * 
 * Production-ready serverless backend for Sniplink URL shortener.
 * Uses Cloudflare KV ('URL_DB') for high-speed edge lookups, click
 * tracking, and redirection.
 * 
 * Features:
 *  1. Global CORS preflight (OPTIONS 200) & CORS headers on all API responses.
 *  2. POST /api/shorten   -> Validates URL, generates 6-char slug, saves to KV,
 *                            initializes clicks:shortCode to '0', returns { shortCode }.
 *  3. GET /api/analytics -> Lists KV keys, filters out 'clicks:', gathers URLs
 *                            and click counts, returns clean JSON array for Dashboard.
 *  4. GET /:shortCode    -> Non-blocking click increment via ctx.waitUntil(),
 *                            instant 302 redirect to destination URL,
 *                            or 302 redirect to https://sniplink-zain.vercel.app/404.
 */

/* ── Global CORS Headers ───────────────────────────────────────── */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Helper to build JSON Response with CORS headers.
 * @param {any} data
 * @param {number} status
 * @returns {Response}
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

/**
 * Handle CORS preflight (OPTIONS) request.
 * Returns 200 OK with the required CORS headers.
 * @returns {Response}
 */
function handleCorsPreflight() {
  return new Response(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

/**
 * Generates a cryptographically secure 6-character alphanumeric short code.
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
 * Retrieves the KV namespace instance (bound as URL_DB).
 * @param {object} env
 * @returns {KVNamespace}
 */
function getKV(env) {
  const kv = env?.URL_DB || env?.LINKS_KV || (typeof URL_DB !== 'undefined' ? URL_DB : null);
  if (!kv) {
    throw new Error('KV namespace binding "URL_DB" not found. Please ensure it is bound in wrangler.toml or Cloudflare dashboard.');
  }
  return kv;
}

/* ── Main Worker Export ────────────────────────────────────────── */
export default {
  /**
   * Main Fetch Handler
   * @param {Request} request
   * @param {object} env - Cloudflare Worker environment bindings
   * @param {ExecutionContext} ctx - Execution context for background tasks (waitUntil)
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method.toUpperCase();

    // 1. Global CORS Preflight Handling
    if (method === 'OPTIONS') {
      return handleCorsPreflight();
    }

    /* ── 2. API Endpoint: POST /api/shorten ──────────────────────── */
    if (method === 'POST' && pathname === '/api/shorten') {
      try {
        const kv = getKV(env);
        let body;
        
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: 'Invalid JSON payload in request body.' }, 400);
        }

        const targetUrl = (body?.url || body?.longUrl || '').trim();

        // Validate presence of URL
        if (!targetUrl) {
          return jsonResponse({ error: 'Target URL is required.' }, 400);
        }

        // Validate format (http / https)
        if (!isValidUrl(targetUrl)) {
          return jsonResponse({ error: 'Invalid URL format. Must start with http:// or https://' }, 400);
        }

        // Generate unique 6-character random alphanumeric short code
        let shortCode = '';
        let attempts = 0;
        do {
          shortCode = generateShortCode(6);
          const existing = await kv.get(shortCode);
          if (!existing) break;
          attempts++;
        } while (attempts < 5);

        if (attempts >= 5) {
          return jsonResponse({ error: 'Failed to generate unique short code. Please try again.' }, 500);
        }

        // Store mapping in Cloudflare KV: Key = shortCode, Value = targetUrl
        await kv.put(shortCode, targetUrl);

        // Initialize click counter for this link in KV: Key = 'clicks:shortCode', Value = '0'
        await kv.put(`clicks:${shortCode}`, '0');

        // Return 200 OK JSON response containing the generated shortCode
        return jsonResponse({
          shortCode,
          shortUrl: `${url.origin}/${shortCode}`,
          originalUrl: targetUrl,
        }, 200);

      } catch (err) {
        return jsonResponse({ error: err.message || 'Internal server error while shortening URL.' }, 500);
      }
    }

    /* ── 3. API Endpoint: GET /api/analytics ─────────────────────── */
    if (method === 'GET' && (pathname === '/api/analytics' || pathname === '/api/stats')) {
      try {
        const kv = getKV(env);

        // List all keys from Cloudflare KV
        const listResult = await kv.list();
        const keys = listResult.keys || [];

        // Filter out click-metadata keys starting with "clicks:"
        const linkKeys = keys.filter((k) => !k.name.startsWith('clicks:'));

        // Retrieve long URL and corresponding click count for each key
        const analyticsList = [];

        for (const key of linkKeys) {
          const shortCode = key.name;
          const rawValue = await kv.get(shortCode);
          if (!rawValue) continue;

          // Retrieve click count from 'clicks:shortCode'
          const clicksStr = await kv.get(`clicks:${shortCode}`);
          const clicks = clicksStr !== null ? parseInt(clicksStr, 10) || 0 : 0;

          let originalUrl = rawValue;
          try {
            // Handle if value was stored as JSON or plain string
            const parsed = JSON.parse(rawValue);
            if (parsed && parsed.url) {
              originalUrl = parsed.url;
            }
          } catch {
            originalUrl = rawValue;
          }

          analyticsList.push({
            shortCode,
            code: shortCode,
            slug: shortCode,
            originalUrl,
            url: originalUrl,
            shortUrl: `${url.origin}/${shortCode}`,
            clicks,
          });
        }

        // Return clean JSON array representing all shortened links and global clicks
        // Also includes wrapper for versatile frontend consumption
        return jsonResponse(analyticsList, 200);

      } catch (err) {
        return jsonResponse({ error: err.message || 'Failed to retrieve analytics from Cloudflare KV.' }, 500);
      }
    }

    /* ── 4. Redirection Route: GET /:shortCode ───────────────────── */
    if (method === 'GET' && pathname.length > 1 && !pathname.startsWith('/api/')) {
      const shortCode = pathname.slice(1); // Strip leading slash

      try {
        const kv = getKV(env);

        // Query Cloudflare KV for the matching long URL destination
        const rawDestination = await kv.get(shortCode);

        if (rawDestination) {
          let destinationUrl = rawDestination;
          try {
            const parsed = JSON.parse(rawDestination);
            if (parsed && parsed.url) {
              destinationUrl = parsed.url;
            }
          } catch {
            destinationUrl = rawDestination;
          }

          // Asynchronously increment click count in the background using ctx.waitUntil
          const incrementTask = async () => {
            try {
              const currentClicksStr = await kv.get(`clicks:${shortCode}`);
              const currentClicks = currentClicksStr !== null ? parseInt(currentClicksStr, 10) || 0 : 0;
              await kv.put(`clicks:${shortCode}`, String(currentClicks + 1));
            } catch (clickErr) {
              console.error(`Failed to increment clicks for ${shortCode}:`, clickErr);
            }
          };

          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(incrementTask());
          } else {
            incrementTask();
          }

          // Immediately perform a fast 302 Redirect to destination URL
          return Response.redirect(destinationUrl, 302);
        } else {
          // Short code not found in KV -> 302 Redirect to frontend's branded 404 page
          return Response.redirect('https://sniplink-zain.vercel.app/404', 302);
        }

      } catch (err) {
        // Fallback on error -> redirect to 404 page
        return Response.redirect('https://sniplink-zain.vercel.app/404', 302);
      }
    }

    // Default root / fallback response
    if (pathname === '/' || pathname === '') {
      return jsonResponse({
        service: 'Sniplink Edge API',
        status: 'operational',
        endpoints: {
          shorten: 'POST /api/shorten',
          analytics: 'GET /api/analytics',
          redirect: 'GET /:shortCode',
        },
      }, 200);
    }

    // Fallback 404 for unhandled API routes
    return jsonResponse({ error: 'Endpoint not found.' }, 404);
  },
};
