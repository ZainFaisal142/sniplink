/**
 * ===================================================================
 * FILE 1: /frontend/src/services/apiService.js
 * Central API Service Bridge & Local Edge Simulator Fallback
 * ===================================================================
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'https://sniplink.zainfaisal107.workers.dev';
const STORAGE_KEY = 'sniplink_local_records';

/**
 * Retrieve simulation records from LocalStorage
 * @returns {Array}
 */
function getLocalRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Seed initial starter data for instant local visualization
      const initial = [
        {
          code: 'origin',
          shortCode: 'origin',
          url: 'https://www.useorigin.com',
          clicks: 342,
          createdAt: Date.now() - 86400000 * 2,
        },
        {
          code: 'github',
          shortCode: 'github',
          url: 'https://github.com',
          clicks: 128,
          createdAt: Date.now() - 86400000,
        },
        {
          code: 'react',
          shortCode: 'react',
          url: 'https://react.dev',
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
 * Save simulation records to LocalStorage
 * @param {Array} records
 */
function saveLocalRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('LocalStorage write failed:', e);
  }
}

/**
 * Generate a random 6-character alphanumeric slug
 * @param {number} length
 * @returns {string}
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
 * 1. Shorten a long URL via Cloudflare Worker API (with local fallback)
 * @param {string} longUrl
 * @returns {Promise<{ shortCode: string, code: string, shortUrl: string, originalUrl: string }>}
 */
export async function shortenUrl(longUrl) {
  const trimmedUrl = (longUrl || '').trim();

  // Try Remote Cloudflare Worker API if configured
  if (API_BASE && !API_BASE.includes('your-worker')) {
    try {
      const res = await fetch(`${API_BASE}/api/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        const code = data.shortCode || data.code;
        return {
          shortCode: code,
          code,
          shortUrl: data.shortUrl || `${API_BASE}/${code}`,
          originalUrl: data.originalUrl || trimmedUrl,
        };
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }
    } catch (err) {
      if (err.message && (err.message.includes('required') || err.message.includes('Invalid URL'))) {
        throw err;
      }
      console.warn('Worker backend unreachable. Falling back to local storage simulation:', err);
    }
  }

  // High-performance client-side LocalStorage simulation fallback
  const records = getLocalRecords();
  const shortCode = generateLocalCode(6);
  const newRecord = {
    code: shortCode,
    shortCode,
    url: trimmedUrl,
    clicks: 0,
    createdAt: Date.now(),
  };

  records.unshift(newRecord);
  saveLocalRecords(records);

  const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://sniplink.dev';
  return {
    shortCode,
    code: shortCode,
    shortUrl: `${fallbackOrigin}/#/r/${shortCode}`,
    originalUrl: trimmedUrl,
  };
}

/**
 * 2. Fetch aggregated click metrics via Cloudflare Worker API (with local fallback)
 * @returns {Promise<{ totalLinks: number, totalClicks: number, links: Array }>}
 */
export async function fetchStats() {
  if (API_BASE && !API_BASE.includes('your-worker')) {
    try {
      // Primary stats endpoint (supports /api/stats and /api/analytics)
      const res = await fetch(`${API_BASE}/api/stats`, {
        headers: { 'Accept': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        const links = Array.isArray(data) ? data : (Array.isArray(data.links) ? data.links : []);
        return {
          totalLinks: links.length,
          totalClicks: links.reduce((sum, item) => sum + (Number(item.clicks) || 0), 0),
          links,
        };
      }
    } catch (err) {
      console.warn('Failed to fetch remote stats. Falling back to local simulation:', err);
    }
  }

  // Client-side LocalStorage fallback metrics
  const records = getLocalRecords();
  return {
    totalLinks: records.length,
    totalClicks: records.reduce((sum, item) => sum + (Number(item.clicks) || 0), 0),
    links: records.map((r) => ({
      shortCode: r.shortCode || r.code,
      code: r.code || r.shortCode,
      url: r.url,
      originalUrl: r.url,
      clicks: Number(r.clicks) || 0,
      createdAt: r.createdAt,
      shortUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/#/r/${r.code || r.shortCode}`,
    })),
  };
}

/**
 * Optional click increment handler for local route simulation
 * @param {string} code
 * @returns {string|null}
 */
export function recordClickAndGetUrl(code) {
  const records = getLocalRecords();
  const item = records.find((r) => r.code === code || r.shortCode === code);
  if (item) {
    item.clicks = (item.clicks || 0) + 1;
    saveLocalRecords(records);
    return item.url;
  }
  return null;
}
