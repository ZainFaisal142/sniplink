/**
 * Sniplink — API Service Layer
 * 
 * Communicates with Cloudflare Workers backend and Cloudflare KV.
 * Supports URL shortening, analytics querying, and edge redirects.
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'https://sniplink.zainfaisal107.workers.dev';
const STORAGE_KEY = 'sniplink_links_data';

// Helper to get local simulation data
function getLocalLinks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalLinks(links) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  } catch (e) {
    console.error('Failed to save to local storage', e);
  }
}

function generateCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Shorten a destination URL with an optional custom slug.
 * @param {string} longUrl 
 * @param {string} [customSlug] 
 * @returns {Promise<{ shortCode: string, code: string, shortUrl: string, originalUrl: string }>}
 */
export async function shortenUrl(longUrl, customSlug = '') {
  const trimmedUrl = (longUrl || '').trim();
  const trimmedSlug = (customSlug || '').trim();

  // Try Remote Cloudflare Worker API
  if (API_BASE && !API_BASE.includes('your-worker')) {
    try {
      const res = await fetch(`${API_BASE}/api/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: trimmedUrl,
          customSlug: trimmedSlug || undefined,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = data?.error || `Request failed (${res.status})`;
        throw new Error(errorMsg);
      }

      if (data) {
        const code = data.shortCode || data.code || data.slug;
        return {
          ...data,
          code,
          shortCode: code,
          shortUrl: data.shortUrl || `${window.location.origin}/#/r/${code}`,
          originalUrl: data.originalUrl || trimmedUrl,
        };
      }
    } catch (err) {
      if (err.message && (err.message.includes('required') || err.message.includes('Invalid URL') || err.message.includes('already taken'))) {
        throw err;
      }
      console.warn('Worker API unreachable, using local edge store fallback:', err);
    }
  }

  // Local edge simulation fallback
  const links = getLocalLinks();
  let code = trimmedSlug || generateCode(6);

  const shortUrl = `${window.location.origin}/#/r/${code}`;
  const newLink = {
    shortCode: code,
    code,
    slug: code,
    url: trimmedUrl,
    originalUrl: trimmedUrl,
    clicks: 0,
    shortUrl,
    createdAt: new Date().toISOString(),
  };

  links.unshift(newLink);
  saveLocalLinks(links);

  return {
    shortCode: code,
    code,
    slug: code,
    originalUrl: trimmedUrl,
    shortUrl,
  };
}

/**
 * Fetch live analytics and metrics directly from Cloudflare Worker /api/analytics endpoint.
 * @returns {Promise<{ totalLinks: number, totalClicks: number, links: Array }>}
 */
export async function fetchAnalytics() {
  if (API_BASE && !API_BASE.includes('your-worker')) {
    try {
      // Primary analytics endpoint
      const res = await fetch(`${API_BASE}/api/analytics`, {
        headers: { 'Accept': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        const linkArray = Array.isArray(data) ? data : (Array.isArray(data.links) ? data.links : []);
        return {
          totalLinks: linkArray.length,
          totalClicks: linkArray.reduce((sum, l) => sum + (Number(l.clicks) || 0), 0),
          links: linkArray,
        };
      }

      // Fallback to /api/stats endpoint if present
      const statsRes = await fetch(`${API_BASE}/api/stats`, {
        headers: { 'Accept': 'application/json' },
      });

      if (statsRes.ok) {
        const data = await statsRes.json();
        const linkArray = Array.isArray(data) ? data : (Array.isArray(data.links) ? data.links : []);
        return {
          totalLinks: linkArray.length,
          totalClicks: linkArray.reduce((sum, l) => sum + (Number(l.clicks) || 0), 0),
          links: linkArray,
        };
      }
    } catch (e) {
      console.warn('Worker API unreachable for /api/analytics, loading local edge store:', e);
    }
  }

  const links = getLocalLinks();
  return {
    totalLinks: links.length,
    totalClicks: links.reduce((sum, l) => sum + (Number(l.clicks) || 0), 0),
    links,
  };
}

// Alias for backward compatibility
export const fetchStats = fetchAnalytics;

/**
 * Handle link click increment in local mode and return destination URL.
 * @param {string} code 
 * @returns {string|null}
 */
export function recordClickAndGetUrl(code) {
  const links = getLocalLinks();
  const link = links.find((l) => l.code === code || l.shortCode === code || l.slug === code);
  if (link) {
    link.clicks = (link.clicks || 0) + 1;
    saveLocalLinks(links);
    return link.url || link.originalUrl;
  }
  return null;
}
