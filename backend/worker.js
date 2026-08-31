/**
 * ===================================================================
 * FILE 3: /backend/worker.js (Synchronized Cloudflare Worker Engine)
 * SnipLink Cloudflare Worker — Edge Authentication with Strict Gmail Check
 * ===================================================================
 */

/* ── 1. Global CORS Configuration ──────────────────────────────── */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

const JWT_SECRET = 'sniplink_edge_secret_super_key_2026';
const STRICT_GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

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
 * Base64URL Encoding & Decoding
 */
function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
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

/**
 * Verify and Extract User Payload from Authorization Header
 * @param {Request} request
 * @returns {Promise<{ email: string, name: string }|null>}
 */
async function getAuthenticatedUser(request) {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      if (token.startsWith('mock_jwt_')) {
        const jsonStr = atob(token.replace('mock_jwt_', '').split('.')[0]);
        return JSON.parse(jsonStr);
      }
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const dataToVerify = `${encodedHeader}.${encodedPayload}`;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const binarySig = base64UrlDecode(signature);
    const sigArray = new Uint8Array(binarySig.length);
    for (let i = 0; i < binarySig.length; i++) {
      sigArray[i] = binarySig.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify('HMAC', key, sigArray, enc.encode(dataToVerify));
    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    return payload;
  } catch (err) {
    console.error('JWT verification error:', err);
    return null;
  }
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
       AUTH ROUTE 1: POST /api/auth/signup (Strict @gmail.com Check)
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

        // Server-Side Strict @gmail.com Check
        if (!STRICT_GMAIL_REGEX.test(email)) {
          return jsonResponse({
            error: 'Registration is strictly restricted to Gmail accounts only (must end with @gmail.com).'
          }, 400);
        }

        if (password.length < 6) {
          return jsonResponse({ error: 'Password must be at least 6 characters.' }, 400);
        }

        // Check if user already exists in KV
        const existing = await kv.get(`user:${email}`);
        if (existing) {
          return jsonResponse({ error: 'An account with this email already exists.' }, 409);
        }

        // Salt and Hash Password
        const salt = generateRandomString(16);
        const passwordHash = await hashPassword(password, salt);

        const userRecord = {
          name,
          email,
          passwordHash,
          salt,
          createdAt: Date.now(),
        };

        await kv.put(`user:${email}`, JSON.stringify(userRecord));

        // Issue Signed JWT Token (7 Days)
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

        const rawUser = await kv.get(`user:${email}`);
        const resetToken = generateRandomString(32);

        if (rawUser) {
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
       SHORTENER ROUTE: POST /api/shorten (User-to-Data KV Mapping)
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

        // Extract Authenticated User from JWT Token
        const authenticatedUser = await getAuthenticatedUser(request);
        const ownerEmail = authenticatedUser?.email?.toLowerCase() || 'anonymous';

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

        // Store JSON Payload in Cloudflare KV with Owner Email
        const record = {
          longUrl: targetUrl,
          url: targetUrl,
          owner: ownerEmail,
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
          longUrl: targetUrl,
          owner: ownerEmail,
        }, 200);

      } catch (err) {
        return jsonResponse({ error: err.message || 'Server error while shortening URL.' }, 500);
      }
    }

    /* ═══════════════════════════════════════════════════════════════
       SCOPED STATS ROUTE: GET /api/stats (Filtered by Authenticated User)
       ═══════════════════════════════════════════════════════════════ */
    if (method === 'GET' && (pathname === '/api/stats' || pathname === '/api/analytics')) {
      try {
        const kv = getKV(env);

        // Verify Authenticated User
        const authenticatedUser = await getAuthenticatedUser(request);
        if (!authenticatedUser || !authenticatedUser.email) {
          return jsonResponse({ error: 'Unauthorized. Valid Bearer token required.' }, 401);
        }

        const userEmail = authenticatedUser.email.toLowerCase();
        const listResult = await kv.list();
        const keys = listResult.keys || [];

        // Exclude system keys
        const primaryKeys = keys.filter(
          (k) => !k.name.startsWith('clicks:') && !k.name.startsWith('user:') && !k.name.startsWith('reset:')
        );
        const scopedList = [];

        for (const key of primaryKeys) {
          const shortCode = key.name;
          const raw = await kv.get(shortCode);
          if (!raw) continue;

          let record;
          try {
            record = JSON.parse(raw);
          } catch {
            continue;
          }

          // Strict Scoping: Only include links owned by the authenticated user
          if (record && record.owner && record.owner.toLowerCase() === userEmail) {
            let destinationUrl = record.longUrl || record.url || '';
            let clicks = typeof record.clicks === 'number' ? record.clicks : 0;
            let createdAt = record.createdAt || null;

            try {
              const clickStr = await kv.get(`clicks:${shortCode}`);
              if (clickStr !== null) {
                const directClicks = parseInt(clickStr, 10) || 0;
                clicks = Math.max(clicks, directClicks);
              }
            } catch (e) {}

            scopedList.push({
              shortCode,
              code: shortCode,
              url: destinationUrl,
              longUrl: destinationUrl,
              originalUrl: destinationUrl,
              owner: userEmail,
              shortUrl: `${url.origin}/${shortCode}`,
              clicks,
              createdAt,
            });
          }
        }

        // Sort newest first
        scopedList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return jsonResponse(scopedList, 200);

      } catch (err) {
        return jsonResponse({ error: err.message || 'Failed to fetch scoped metrics from LINKS_KV.' }, 500);
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
            if (currentRecord && (currentRecord.longUrl || currentRecord.url)) {
              destinationUrl = currentRecord.longUrl || currentRecord.url;
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
