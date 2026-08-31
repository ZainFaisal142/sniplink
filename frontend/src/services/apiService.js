/**
 * ===================================================================
 * FILE 3: /frontend/src/services/apiService.js
 * Central API Bridge with Scoped JWT Authorization Headers
 * ===================================================================
 */

import { getToken, getUser } from './authService';

const ENDPOINTS_TO_TRY = [
  import.meta.env.VITE_API_BASE,
  'https://link-router.zain.workers.dev',
  'https://sniplink.zainfaisal107.workers.dev',
].filter(Boolean);

const STORAGE_KEY = 'sniplink_local_records';

/**
 * Get stored records from LocalStorage
 * @returns {Array}
 */
export function getLocalRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const user = getUser();
      const ownerEmail = user?.email || 'demo@sniplink.com';
      const initial = [
        {
          code: 'origin',
          shortCode: 'origin',
          url: 'https://www.useorigin.com',
          longUrl: 'https://www.useorigin.com',
          owner: ownerEmail,
          clicks: 342,
          createdAt: Date.now() - 86400000 * 2,
        },
        {
          code: 'github',
          shortCode: 'github',
          url: 'https://github.com',
          longUrl: 'https://github.com',
          owner: ownerEmail,
          clicks: 128,
          createdAt: Date.now() - 86400000,
        },
        {
          code: 'react',
          shortCode: 'react',
          url: 'https://react.dev',
          longUrl: 'https://react.dev',
          owner: ownerEmail,
          clicks: 89,
          createdAt: Date.now() - 3600000 * 4,
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Save records to LocalStorage
 * @param {Array} records
 */
export function saveLocalRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }
}

/**
 * Generate 6-character random alphanumeric code
 */
function generateLocalCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 1. Shorten URL via Cloudflare Worker API with JWT Authorization Header
 * @param {string} longUrl
 * @returns {Promise<{ shortCode: string, code: string, shortUrl: string, originalUrl: string }>}
 */
export async function shortenUrl(longUrl) {
  const trimmedUrl = (longUrl || '').trim();
  const token = getToken();
  const user = getUser();
  const owner = user?.email || 'guest';

  // Construct request headers with Bearer Token if logged in
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  for (const endpoint of ENDPOINTS_TO_TRY) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${endpoint}/api/shorten`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: trimmedUrl }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const code = data.shortCode || data.code;
        const shortUrl = data.shortUrl || `${endpoint}/${code}`;

        // Save scoped record locally for instant UI responsiveness
        const records = getLocalRecords();
        const existingIdx = records.findIndex((r) => (r.code || r.shortCode) === code);
        const item = {
          code,
          shortCode: code,
          url: trimmedUrl,
          longUrl: trimmedUrl,
          owner: data.owner || owner,
          shortUrl,
          clicks: Number(data.clicks) || 0,
          createdAt: Date.now(),
        };

        if (existingIdx >= 0) {
          records[existingIdx] = item;
        } else {
          records.unshift(item);
        }
        saveLocalRecords(records);

        return {
          shortCode: code,
          code,
          shortUrl,
          originalUrl: trimmedUrl,
        };
      }
    } catch (err) {
      console.warn(`Shorten attempt on ${endpoint} failed:`, err.message);
    }
  }

  // Resilient Local Storage Fallback
  const records = getLocalRecords();
  const shortCode = generateLocalCode(6);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const newRecord = {
    code: shortCode,
    shortCode,
    url: trimmedUrl,
    longUrl: trimmedUrl,
    owner,
    clicks: 0,
    createdAt: Date.now(),
  };

  records.unshift(newRecord);
  saveLocalRecords(records);

  return {
    shortCode,
    code: shortCode,
    shortUrl: `${origin}/r/${shortCode}`,
    originalUrl: trimmedUrl,
  };
}

/**
 * 2. Fetch User-Scoped Stats via Cloudflare Worker API with JWT Authorization Header
 * @returns {Promise<{ totalLinks: number, totalClicks: number, links: Array }>}
 */
export async function fetchStats() {
  const token = getToken();
  const user = getUser();
  const userEmail = user?.email?.toLowerCase();

  // Construct request headers with Bearer Token
  const headers = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  for (const endpoint of ENDPOINTS_TO_TRY) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${endpoint}/api/stats`, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const links = Array.isArray(data) ? data : (Array.isArray(data.links) ? data.links : []);

        // The backend returns user-scoped links. Cache/merge with local store:
        const local = getLocalRecords();
        const merged = [...links];
        for (const loc of local) {
          const locCode = loc.code || loc.shortCode;
          const isUserOwned = !userEmail || (loc.owner && loc.owner.toLowerCase() === userEmail);
          if (isUserOwned && !merged.some((m) => (m.code || m.shortCode) === locCode)) {
            merged.push(loc);
          }
        }
        saveLocalRecords(merged);

        return {
          totalLinks: merged.length,
          totalClicks: merged.reduce((sum, item) => sum + (Number(item.clicks) || 0), 0),
          links: merged,
        };
      }
    } catch (err) {
      console.warn(`Stats fetch from ${endpoint} failed:`, err.message);
    }
  }

  // Fallback: Return strictly user-scoped local records
  const local = getLocalRecords();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const scopedLocal = local.filter((r) => {
    if (!userEmail) return true;
    return !r.owner || r.owner.toLowerCase() === userEmail;
  });

  const formatted = scopedLocal.map((r) => ({
    shortCode: r.shortCode || r.code,
    code: r.code || r.shortCode,
    url: r.url || r.longUrl || r.originalUrl,
    longUrl: r.longUrl || r.url || r.originalUrl,
    originalUrl: r.url || r.longUrl || r.originalUrl,
    owner: r.owner || userEmail || 'user',
    clicks: Number(r.clicks) || 0,
    createdAt: r.createdAt,
    shortUrl: r.shortUrl || `${origin}/r/${r.code || r.shortCode}`,
  }));

  return {
    totalLinks: formatted.length,
    totalClicks: formatted.reduce((sum, item) => sum + (Number(item.clicks) || 0), 0),
    links: formatted,
  };
}

/**
 * Click increment handler for local route simulation
 */
export function recordClickAndGetUrl(code) {
  const records = getLocalRecords();
  const item = records.find((r) => r.code === code || r.shortCode === code);
  if (item) {
    item.clicks = (item.clicks || 0) + 1;
    saveLocalRecords(records);
    return item.url || item.longUrl;
  }
  return null;
}
