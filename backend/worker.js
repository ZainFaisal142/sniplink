/**
 * Sniplink — Cloudflare Worker (Serverless Backend)
 * 
 * Handles URL shortening (with custom slugs), instant redirects,
 * real-time click tracking, and edge analytics.
 * 
 * Works with Cloudflare KV bound as `URL_DB` or `LINKS_KV`.
 * 
 * Routes:
 *   POST /api/shorten    — Shorten a URL (supports optional customSlug, 409 conflict handling)
 *   GET  /api/analytics  — Retrieve live link analytics & real-time clicks from KV
 *   GET  /api/stats      — Alias for /api/analytics
 *   GET  /:slug          — 301 permanent redirect to destination URL & increments clicks
 */

/* ── Helpers ───────────────────────────────────────────────────── */

/**
 * Get the KV namespace binding from env (supports URL_DB or LINKS_KV).
 * @param {object} env 
 * @returns {KVNamespace}
 */
function getKV(env) {
  const kv = env.URL_DB || env.LINKS_KV;
  if (!kv) {
    throw new Error('KV namespace binding not found. Please bind URL_DB or LINKS_KV in wrangler.toml.');
  }
  return kv;
}

/**
 * Generate a cryptographically random 6-character alphanumeric slug.
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
    const parsed = new URL(str);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate that a custom slug contains only alphanumeric characters and hyphens.
 * @param {string} slug
 * @returns {boolean}
 */
function isValidSlug(slug) {
  return /^[a-zA-Z0-9-]+$/.test(slug);
}

/**
 * List of reserved slugs that cannot be used as custom short URLs.
 */
const RESERVED_SLUGS = new Set([
  'api', 'dashboard', 'analytics', 'stats', 'shorten', 'r', '404', 'favicon.ico', 'robots.txt'
]);

/**
 * Create a JSON Response with full CORS headers.
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    // Handle CORS preflight requests
    if (method === 'OPTIONS') {
      return handleOptions();
    }

    /* ── POST /api/shorten ────────────────────────────────────── */
    if (method === 'POST' && pathname === '/api/shorten') {
      try {
        const kv = getKV(env);
        const body = await request.json();
        const longUrl = (body.url || body.longUrl || '').trim();
        const customSlug = (body.customSlug || body.slug || '').trim();

        // 1. Validate destination URL
        if (!longUrl) {
          return jsonResponse({ error: 'Destination URL is required.' }, 400);
        }

        if (!isValidUrl(longUrl)) {
          return jsonResponse({ error: 'Invalid URL. Must start with http:// or https://' }, 400);
        }

        let finalSlug = '';

        // 2. Process Custom Slug if provided
        if (customSlug) {
          // Format validation: alphanumeric and hyphens only
          if (!isValidSlug(customSlug)) {
            return jsonResponse({
              error: 'Custom slug can only contain letters, numbers, and hyphens (no spaces or special symbols).'
            }, 400);
          }

          // Length check
          if (customSlug.length < 2 || customSlug.length > 50) {
            return jsonResponse({
              error: 'Custom slug must be between 2 and 50 characters long.'
            }, 400);
          }

          // Reserved slug check
          if (RESERVED_SLUGS.has(customSlug.toLowerCase())) {
            return jsonResponse({
              error: `The custom slug "${customSlug}" is reserved. Please pick a different one.`
            }, 400);
          }

          // Check if custom slug already exists in Cloudflare KV
          const existing = await kv.get(customSlug);
          if (existing !== null) {
            return jsonResponse({
              error: 'This custom back-half is already taken!'
            }, 409);
          }

          finalSlug = customSlug;
        } else {
          // 3. Fall back to generating secure 6-character random alphanumeric slug
          let attempts = 0;
          do {
            finalSlug = generateCode(6);
            const existing = await kv.get(finalSlug);
            if (existing === null && !RESERVED_SLUGS.has(finalSlug.toLowerCase())) {
              break;
            }
            attempts++;
          } while (attempts < 6);

          if (attempts >= 6) {
            return jsonResponse({ error: 'Could not generate a unique short code. Please try again.' }, 500);
          }
        }

        const now = new Date().toISOString();

        // Save URL in KV (Key = customSlug/slug, Value = Long URL / metadata)
        const record = {
          url: longUrl,
          slug: finalSlug,
          clicks: 0,
          isCustom: Boolean(customSlug),
          createdAt: now,
        };

        // Store primary link record
        await kv.put(finalSlug, JSON.stringify(record));

        // Initialize clicks:slug in KV to "0"
        await kv.put(`clicks:${finalSlug}`, "0");

        const shortUrl = `${url.origin}/${finalSlug}`;

        return jsonResponse({
          success: true,
          shortUrl,
          code: finalSlug,
          slug: finalSlug,
          customSlug: customSlug || null,
          originalUrl: longUrl,
          createdAt: now,
        }, 201);

      } catch (err) {
        return jsonResponse({
          error: err.message || 'Invalid request payload or server error.'
        }, 400);
      }
    }

    /* ── GET /api/analytics & GET /api/stats ───────────────────── */
    if (method === 'GET' && (pathname === '/api/analytics' || pathname === '/api/stats')) {
      try {
        const kv = getKV(env);
        const list = await kv.list();
        const links = [];

        // Filter keys to exclude 'clicks:' tracking prefixes
        const primaryKeys = (list.keys || []).filter((k) => !k.name.startsWith('clicks:'));

        for (const key of primaryKeys) {
          const raw = await kv.get(key.name);
          if (!raw) continue;

          // Retrieve separate click counter if initialized
          const clicksStr = await kv.get(`clicks:${key.name}`);
          let clickCount = clicksStr !== null ? parseInt(clicksStr, 10) || 0 : 0;

          let destinationUrl = raw;
          let createdAt = null;
          let isCustom = false;

          try {
            const record = JSON.parse(raw);
            destinationUrl = record.url || raw;
            if (clicksStr === null && typeof record.clicks === 'number') {
              clickCount = record.clicks;
            }
            createdAt = record.createdAt || null;
            isCustom = Boolean(record.isCustom);
          } catch {
            // Legacy plain text value
            destinationUrl = raw;
          }

          links.push({
            code: key.name,
            slug: key.name,
            url: destinationUrl,
            originalUrl: destinationUrl,
            clicks: clickCount,
            shortUrl: `${url.origin}/${key.name}`,
            isCustom,
            createdAt,
          });
        }

        // Sort by creation date (newest first)
        links.sort((a, b) => {
          if (!a.createdAt && !b.createdAt) return 0;
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        const totalClicks = links.reduce((sum, item) => sum + (item.clicks || 0), 0);

        return jsonResponse({
          success: true,
          totalLinks: links.length,
          totalClicks,
          links,
        });

      } catch (err) {
        return jsonResponse({
          error: err.message || 'Failed to retrieve analytics from Cloudflare KV.'
        }, 500);
      }
    }

    /* ── GET /:slug (Edge 301 Permanent Redirect) ─────────────── */
    if (method === 'GET' && pathname.length > 1 && !pathname.startsWith('/api/')) {
      const slug = pathname.slice(1); // remove leading slash

      try {
        const kv = getKV(env);
        const raw = await kv.get(slug);

        if (!raw) {
          // Slug not found in KV — redirect to frontend 404
          return Response.redirect(`${url.origin}/#/404`, 302);
        }

        let destinationUrl = raw;

        try {
          const record = JSON.parse(raw);
          destinationUrl = record.url || raw;

          // Increment clicks on JSON record
          record.clicks = (record.clicks || 0) + 1;
          kv.put(slug, JSON.stringify(record)).catch(() => {});
        } catch {
          // Plain text value
          destinationUrl = raw;
        }

        // Increment 'clicks:slug' in KV
        try {
          const currentClicksStr = await kv.get(`clicks:${slug}`);
          const currentClicks = currentClicksStr !== null ? parseInt(currentClicksStr, 10) || 0 : 0;
          await kv.put(`clicks:${slug}`, String(currentClicks + 1));
        } catch (e) {
          // Non-blocking counter error handling
        }

        // Return fast 301 permanent redirect
        return Response.redirect(destinationUrl, 301);

      } catch (err) {
        return jsonResponse({ error: 'Edge redirection failed.' }, 500);
      }
    }

    /* ── Fallback 404 ─────────────────────────────────────────── */
    return jsonResponse({ error: 'Endpoint not found.' }, 404);
  },
};
