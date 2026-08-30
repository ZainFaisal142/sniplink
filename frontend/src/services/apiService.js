// API Service with Cloudflare Worker support & seamless local edge simulator fallback

const API_BASE = import.meta.env.VITE_API_BASE || 'https://sniplink.zainfaisal107.workers.dev';
const STORAGE_KEY = 'sniplink_links_data';

// Helper to get local data
function getLocalLinks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Seed initial sample data for immediate visual delight
      const initial = [
        {
          code: 'origin1',
          url: 'https://www.useorigin.com',
          clicks: 342,
          shortUrl: `${window.location.origin}/#/r/origin1`,
          createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
        },
        {
          code: 'github',
          url: 'https://github.com',
          clicks: 128,
          shortUrl: `${window.location.origin}/#/r/github`,
          createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        },
        {
          code: 'react',
          url: 'https://react.dev',
          clicks: 89,
          shortUrl: `${window.location.origin}/#/r/react`,
          createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
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

export async function shortenUrl(longUrl) {
  // If remote worker API base is configured and not empty
  if (API_BASE && !API_BASE.includes('your-worker')) {
    try {
      const res = await fetch(`${API_BASE}/api/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: longUrl }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Worker API unreachable, falling back to local edge store:', e);
    }
  }

  // Local edge simulation (instant sub-millisecond response)
  const links = getLocalLinks();
  const code = generateCode(6);
  const shortUrl = `${window.location.origin}/#/r/${code}`;
  const newLink = {
    code,
    url: longUrl,
    clicks: 0,
    shortUrl,
    createdAt: new Date().toISOString(),
  };

  links.unshift(newLink);
  saveLocalLinks(links);

  return {
    code,
    originalUrl: longUrl,
    shortUrl,
  };
}

export async function fetchStats() {
  if (API_BASE && !API_BASE.includes('your-worker')) {
    try {
      const res = await fetch(`${API_BASE}/api/stats`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Worker API unreachable, falling back to local edge stats:', e);
    }
  }

  const links = getLocalLinks();
  return {
    totalLinks: links.length,
    totalClicks: links.reduce((sum, l) => sum + (l.clicks || 0), 0),
    links,
  };
}

export function recordClickAndGetUrl(code) {
  const links = getLocalLinks();
  const link = links.find((l) => l.code === code);
  if (link) {
    link.clicks = (link.clicks || 0) + 1;
    saveLocalLinks(links);
    return link.url;
  }
  return null;
}
