/**
 * Sniplink — API Service Layer
 * 
 * Communicates with Cloudflare Workers backend and Cloudflare KV.
 * Supports custom slugs, live analytics, and conflict resolution.
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
 * @returns {Promise<{ shortUrl: string, code: string, slug: string, originalUrl: string }>}
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
        // Bubble up 409 Conflict ("This custom back-half is already taken!") or 400 Bad Request
        const errorMsg = data?.error || (res.status === 409 ? 'This custom back-half is already taken!' : `Request failed (${res.status})`);
        throw new Error(errorMsg);
      }

      if (data && data.shortUrl) {
        return data;
      }
    } catch (err) {
      // If error was thrown from server response (e.g. 409 or 400), propagate it directly
      if (err.message && (err.message.includes('already taken') || err.message.includes('Custom slug') || err.message.includes('Invalid URL'))) {
        throw err;
      }
      console.warn('Worker API unreachable, using local edge store fallback:', err);
    }
  }

  // Local edge simulation fallback
  const links = getLocalLinks();
  let code = '';

  if (trimmedSlug) {
    if (!/^[a-zA-Z0-9-]+$/.test(trimmedSlug)) {
      throw new Error('Custom slug can only contain letters, numbers, and hyphens (no spaces or special symbols).');
    }
    const exists = links.some((l) => l.code.toLowerCase() === trimmedSlug.toLowerCase());
    if (exists) {
      throw new Error('This custom back-half is already taken!');
    }
    code = trimmedSlug;
  } else {
    code = generateCode(6);
  }

  const shortUrl = `${window.location.origin}/#/r/${code}`;
  const newLink = {
    code,
    slug: code,
    url: trimmedUrl,
    originalUrl: trimmedUrl,
    clicks: 0,
    shortUrl,
    isCustom: Boolean(trimmedSlug),
    createdAt: new Date().toISOString(),
  };

  links.unshift(newLink);
  saveLocalLinks(links);

  return {
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
      const res = await fetch(`${API_BASE}/api/analytics`);
      if (res.ok) {
        const data = await res.json();
        return {
          totalLinks: typeof data.totalLinks === 'number' ? data.totalLinks : (data.links || []).length,
          totalClicks: typeof data.totalClicks === 'number' ? data.totalClicks : (data.links || []).reduce((s, l) => s + (l.clicks || 0), 0),
          links: data.links || [],
        };
      }
      // Fallback endpoint if /api/analytics returned non-ok
      const statsRes = await fetch(`${API_BASE}/api/stats`);
      if (statsRes.ok) {
        const data = await statsRes.json();
        return {
          totalLinks: typeof data.totalLinks === 'number' ? data.totalLinks : (data.links || []).length,
          totalClicks: typeof data.totalClicks === 'number' ? data.totalClicks : (data.links || []).reduce((s, l) => s + (l.clicks || 0), 0),
          links: data.links || [],
        };
      }
    } catch (e) {
      console.warn('Worker API unreachable for /api/analytics, loading local edge store:', e);
    }
  }

  const links = getLocalLinks();
  return {
    totalLinks: links.length,
    totalClicks: links.reduce((sum, l) => sum + (l.clicks || 0), 0),
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
  const link = links.find((l) => l.code === code || l.slug === code);
  if (link) {
    link.clicks = (link.clicks || 0) + 1;
    saveLocalLinks(links);
    return link.url || link.originalUrl;
  }
  return null;
}
