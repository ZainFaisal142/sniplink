/**
 * ===================================================================
 * FILE 6: /backend/worker.js (and /worker/worker.js)
 * SnipLink Cloudflare Worker — Edge URL Shortener + Authentication Engine
 * ===================================================================
 */

/* ── 1. Global CORS Configuration ──────────────────────────────── */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

const JWT_SECRET = 'sniplink_edge_secret_super_key_2026';

/**
 * Creates a JSON response with full CORS headers.
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
 */
function handleCorsPreflight() {
  return new Response(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

/**
 * Generates a cryptographically secure random string.
 */
function generateRandomString(length = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, (b) => chars[b % chars.length]).join('');
}

/**
 * Validates that a string is a valid HTTP/HTTPS URL.
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
 */
function getKV(env) {
  const kv = env?.LINKS_KV || env?.URL_DB || (typeof LINKS_KV !== 'undefined' ? LINKS_KV : null);
  if (!kv) {
    throw new Error('KV namespace binding "LINKS_KV" not found. Please ensure it is bound in wrangler.toml.');
  }
  return kv;
}

/* ── 2. Cryptographic & JWT Edge Helpers ────────────────────────── */

/**
 * Hash password with salt using Web Crypto SHA-256
 */
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${password}:${salt}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Base64URL Encoding
 */
function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generate HMAC-SHA256 Signed JWT Token
 */
async function generateJWT(payload, secret = JWT_SECRET) {
  const enc = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(dataToSign));
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureStr = String.fromCharCode.apply(null, signatureArray);
  const encodedSignature = base64UrlEncode(signatureStr);

  return `${dataToSign}.${encodedSignature}`;
}

/* ── 3. Main Cloudflare Worker Module ──────────────────────────── */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method.toUpperCase();

    // 1. Handle Global CORS Preflight
    if (method === 'OPTIONS') {
      return handleCorsPreflight();
    }

    /* ═══════════════════════════════════════════════════════════════
       AUTH ROUTE 1: POST /api/auth/signup
       ═══════════════════════════════════════════════════════════════ */
    if (method === 'POST' && pathname === '/api/auth/signup') {
      try {
        const kv = getKV(env);
        let body;

        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
        }

        const name = (body?.name || '').trim();
        const email = (body?.email || '').trim().toLowerCase();
        const password = body?.password || '';

        // Validation
        if (!name) {
          return jsonResponse({ error: 'Full name is required.' }, 400);
        }
        if (!email || !email.includes('@') || !email.includes('.')) {
          return jsonResponse({ error: 'A valid email address is required.' }, 400);
        }
        if (password.length < 6) {
          return jsonResponse({ error: 'Password must be at least 6 characters.' }, 400);
        }

        // Check if user already exists
        const existing = await kv.get(`user:${email}`);
        if (existing) {
          return jsonResponse({ error: 'An account with this email already exists.' }, 409);
        }

        // Secure Salt & Hash
        const salt = generateRandomString(16);
        const passwordHash = await hashPassword(password, salt);

        const userRecord = {
          name,
          email,
          passwordHash,
          salt,
          createdAt: Date.now(),
        };

        // Store user in KV
        await kv.put(`user:${email}`, JSON.stringify(userRecord));

        // Generate JWT Token (7 Days)
        const exp = Math.floor(Date.now() / 1000) + 86400 * 7;
        const token = await generateJWT({ email, name, exp });

        return jsonResponse({
          success: true,
          message: 'Account created successfully.',
          token,
          user: { name, email },
        }, 201);

      } catch (err) {
        return jsonResponse({ error: err.message || 'Server error during signup.' }, 500);
      }
    }

    /* ═══════════════════════════════════════════════════════════════
       AUTH ROUTE 2: POST /api/auth/login
       ═══════════════════════════════════════════════════════════════ */
    if (method === 'POST' && pathname === '/api/auth/login') {
      try {
        const kv = getKV(env);
        let body;

        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
        }

        const email = (body?.email || '').trim().toLowerCase();
        const password = body?.password || '';
        const rememberMe = Boolean(body?.rememberMe);

        if (!email || !password) {
          return jsonResponse({ error: 'Email and password are required.' }, 400);
        }

        const rawUser = await kv.get(`user:${email}`);
        if (!rawUser) {
          return jsonResponse({ error: 'Invalid email or password.' }, 401);
        }

        const user = JSON.parse(rawUser);
        const incomingHash = await hashPassword(password, user.salt);

        if (incomingHash !== user.passwordHash) {
          return jsonResponse({ error: 'Invalid email or password.' }, 401);
        }

        // Generate JWT Token (30 Days if rememberMe, else 7 Days)
        const durationDays = rememberMe ? 30 : 7;
        const exp = Math.floor(Date.now() / 1000) + 86400 * durationDays;
        const token = await generateJWT({ email: user.email, name: user.name, exp });

        return jsonResponse({
          success: true,
          message: 'Signed in successfully.',
          token,
          user: { name: user.name, email: user.email },
        }, 200);

      } catch (err) {
        return jsonResponse({ error: err.message || 'Server error during login.' }, 500);
      }
    }

    /* ═══════════════════════════════════════════════════════════════
       AUTH ROUTE 3: POST /api/auth/reset-request
       ═══════════════════════════════════════════════════════════════ */
    if (method === 'POST' && pathname === '/api/auth/reset-request') {
      try {
        const kv = getKV(env);
        let body;

        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
        }

        const email = (body?.email || '').trim().toLowerCase();
        if (!email || !email.includes('@')) {
          return jsonResponse({ error: 'Valid email is required.' }, 400);
        }

        // Check if user exists (or proceed silently for privacy)
        const rawUser = await kv.get(`user:${email}`);
        const resetToken = generateRandomString(32);

        if (rawUser) {
          // Store reset token in KV with 1-hour expiration
          const resetData = {
            email,
            expiresAt: Date.now() + 3600 * 1000,
          };
          await kv.put(`reset:${resetToken}`, JSON.stringify(resetData), { expirationTtl: 3600 });
        }

        const resetLink = `https://sniplink-zain.vercel.app/reset-password?token=${resetToken}`;

        return jsonResponse({
          success: true,
          message: "Check your inbox! We've sent a recovery link.",
          resetToken,
          resetLink,
        }, 200);

      } catch (err) {
        return jsonResponse({ error: err.message || 'Server error during reset request.' }, 500);
      }
    }

    /* ═══════════════════════════════════════════════════════════════
       AUTH ROUTE 4: POST /api/auth/reset-confirm
       ═══════════════════════════════════════════════════════════════ */
    if (method === 'POST' && pathname === '/api/auth/reset-confirm') {
      try {
        const kv = getKV(env);
        let body;

        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
        }

        const token = (body?.token || '').trim();
        const newPassword = body?.newPassword || '';

        if (!token) {
          return jsonResponse({ error: 'Reset token is required.' }, 400);
        }
        if (newPassword.length < 6) {
          return jsonResponse({ error: 'Password must be at least 6 characters.' }, 400);
        }

        const rawReset = await kv.get(`reset:${token}`);
        if (!rawReset) {
          return jsonResponse({ error: 'Invalid or expired password reset token.' }, 400);
        }

        const resetData = JSON.parse(rawReset);
        if (Date.now() > resetData.expiresAt) {
          await kv.delete(`reset:${token}`);
          return jsonResponse({ error: 'Reset token has expired. Please request a new link.' }, 400);
        }

        const rawUser = await kv.get(`user:${resetData.email}`);
        if (!rawUser) {
          return jsonResponse({ error: 'User record not found.' }, 404);
        }

        const user = JSON.parse(rawUser);
        const salt = generateRandomString(16);
        const passwordHash = await hashPassword(newPassword, salt);

        user.passwordHash = passwordHash;
        user.salt = salt;
        user.updatedAt = Date.now();

        await kv.put(`user:${resetData.email}`, JSON.stringify(user));
        await kv.delete(`reset:${token}`);

        return jsonResponse({
          success: true,
          message: 'Password updated successfully.',
        }, 200);

      } catch (err) {
        return jsonResponse({ error: err.message || 'Server error during password reset.' }, 500);
      }
    }

    /* ═══════════════════════════════════════════════════════════════
       SHORTENER ROUTE: POST /api/shorten
       ═══════════════════════════════════════════════════════════════ */
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

        if (!targetUrl) {
          return jsonResponse({ error: 'URL is required.' }, 400);
        }
        if (!isValidUrl(targetUrl)) {
          return jsonResponse({ error: 'Invalid URL format. Must start with http:// or https://' }, 400);
        }

        let shortCode = '';
        let attempts = 0;
        do {
          shortCode = generateRandomString(6);
          const existing = await kv.get(shortCode);
          if (!existing) break;
          attempts++;
        } while (attempts < 5);

        if (attempts >= 5) {
          return jsonResponse({ error: 'Could not generate a unique short code. Please try again.' }, 500);
        }

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

    /* ═══════════════════════════════════════════════════════════════
       STATS ROUTE: GET /api/stats (and /api/analytics)
       ═══════════════════════════════════════════════════════════════ */
    if (method === 'GET' && (pathname === '/api/stats' || pathname === '/api/analytics')) {
      try {
        const kv = getKV(env);
        const listResult = await kv.list();
        const keys = listResult.keys || [];

        // Exclude auxiliary keys like clicks:*, user:*, reset:*
        const primaryKeys = keys.filter(
          (k) => !k.name.startsWith('clicks:') && !k.name.startsWith('user:') && !k.name.startsWith('reset:')
        );
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

        aggregatedList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return jsonResponse(aggregatedList, 200);

      } catch (err) {
        return jsonResponse({ error: err.message || 'Failed to fetch metrics from LINKS_KV.' }, 500);
      }
    }

    /* ═══════════════════════════════════════════════════════════════
       DYNAMIC REDIRECTOR: GET /:shortCode
       ═══════════════════════════════════════════════════════════════ */
    if (method === 'GET' && pathname.length > 1 && !pathname.startsWith('/api/')) {
      const shortCode = pathname.slice(1);

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

          return Response.redirect(destinationUrl, 302);
        } else {
          return Response.redirect('https://sniplink-zain.vercel.app/404', 302);
        }

      } catch (err) {
        return Response.redirect('https://sniplink-zain.vercel.app/404', 302);
      }
    }

    // Root Welcome Endpoint
    if (pathname === '/' || pathname === '') {
      return jsonResponse({
        service: 'SnipLink Edge API',
        status: 'online',
        endpoints: {
          auth_signup: 'POST /api/auth/signup',
          auth_login: 'POST /api/auth/login',
          auth_reset_request: 'POST /api/auth/reset-request',
          auth_reset_confirm: 'POST /api/auth/reset-confirm',
          shorten: 'POST /api/shorten',
          stats: 'GET /api/stats',
          redirect: 'GET /:shortCode',
        },
      }, 200);
    }

    return jsonResponse({ error: 'Route not found.' }, 404);
  },
};
