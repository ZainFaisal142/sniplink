import { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';

/* ── Inline SVG Icons ──────────────────────────────────────────── */
const LinkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const ClickIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 15l-2 5L9 9l11 4-5 2z" />
    <path d="M22 22l-5-5" />
  </svg>
);

const ActivityIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const EmptyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="9" x2="15" y2="15" />
    <line x1="15" y1="9" x2="9" y2="15" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const CloudIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </svg>
);

const CopyMiniIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckMiniIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const API_BASE = import.meta.env.VITE_API_BASE || 'https://sniplink.zainfaisal107.workers.dev';

/* ── Dashboard Component ───────────────────────────────────────── */
export default function Dashboard() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  /**
   * Fetch live, realistic data directly from Cloudflare Worker /api/analytics
   */
  const fetchLiveAnalytics = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      // Direct async GET request to Cloudflare Worker endpoint /api/analytics
      const targetUrl = API_BASE ? `${API_BASE}/api/analytics` : '/api/analytics';
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Cloudflare Edge returned status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Normalize array of link records from Cloudflare KV response
      const incomingLinks = Array.isArray(data.links) ? data.links : [];
      setLinks(incomingLinks);

    } catch (err) {
      console.error('Failed to sync live data with Cloudflare Worker:', err);
      setError(
        err.message || 'Unable to sync with Cloudflare Edge. Check your Worker URL or KV bindings.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Sync with Cloudflare Edge on mount
  useEffect(() => {
    fetchLiveAnalytics();
  }, [fetchLiveAnalytics]);

  const handleCopyLink = (url, code) => {
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  /* Calculate live metrics */
  const totalLinks = links.length;
  const totalClicks = links.reduce((sum, item) => sum + (Number(item.clicks) || 0), 0);
  const avgClicks = totalLinks > 0 ? (totalClicks / totalLinks).toFixed(1) : '0';

  /* ── Visual Loading State ────────────────────────────────────── */
  if (loading) {
    return (
      <section className="dashboard-loading-container fade-in" aria-live="polite">
        <div className="loader-card">
          <div className="loader-spinner-edge" />
          <div className="loader-text-group">
            <h3>Syncing with Cloudflare Edge...</h3>
            <p>Querying Cloudflare KV real-time analytics and click telemetry</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-page fade-in">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-title-area">
          <div className="edge-status-pill">
            <CloudIcon />
            <span>Cloudflare Edge Connected</span>
          </div>
          <h1>Analytics Dashboard</h1>
          <p>Real-time click telemetry and link performance metrics from Cloudflare KV.</p>
        </div>

        <div className="dashboard-actions">
          <button
            className={`btn-refresh ${refreshing ? 'spinning' : ''}`}
            onClick={() => fetchLiveAnalytics(true)}
            disabled={refreshing}
            aria-label="Refresh live analytics from Cloudflare KV"
          >
            <RefreshIcon />
            {refreshing ? 'Syncing...' : 'Sync Edge Data'}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="dashboard-error-banner" role="alert">
          <p><strong>Connection Notice:</strong> {error}</p>
          <button className="btn-retry" onClick={() => fetchLiveAnalytics(true)}>
            Retry Query
          </button>
        </div>
      )}

      {/* Stats Bento Grid */}
      <div className="stats-grid bento-grid">
        <div className="card bento-card">
          <div className="card-icon">
            <LinkIcon />
          </div>
          <span className="card-label">Total Links Created</span>
          <span className="card-value">{totalLinks.toLocaleString()}</span>
          <span className="card-subtext">Active KV entries</span>
        </div>

        <div className="card bento-card">
          <div className="card-icon">
            <ClickIcon />
          </div>
          <span className="card-label">Total Real-Time Clicks</span>
          <span className="card-value">{totalClicks.toLocaleString()}</span>
          <span className="card-subtext">Global edge redirects</span>
        </div>

        <div className="card bento-card">
          <div className="card-icon">
            <ActivityIcon />
          </div>
          <span className="card-label">Avg. Clicks / Link</span>
          <span className="card-value">{avgClicks}</span>
          <span className="card-subtext">Routing conversion rate</span>
        </div>
      </div>

      {/* Registers Activity Table */}
      <div className="card table-card">
        <div className="table-header-row">
          <div>
            <h2>Link Registry & Activity Logs</h2>
            <span className="table-subtitle">Live records synced from Cloudflare KV namespace</span>
          </div>
          <span className="record-count-badge">
            {totalLinks} {totalLinks === 1 ? 'Record' : 'Records'}
          </span>
        </div>

        {links.length === 0 ? (
          <div className="empty-state">
            <EmptyIcon />
            <h3>No Link Records Found</h3>
            <p>No shortened links exist in your Cloudflare KV namespace yet.</p>
            <NavLink to="/" className="btn-create-first">
              Create Your First Short Link →
            </NavLink>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Original Destination</th>
                  <th scope="col">Short Link (with Custom Slug or random code)</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Total Real-Time Clicks</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link, idx) => {
                  const slug = link.slug || link.code || '';
                  const originalDestination = link.originalUrl || link.url || '';
                  const displayShortUrl = link.shortUrl || `${window.location.origin}/#/r/${slug}`;
                  const isCustomSlug = Boolean(link.isCustom || (link.customSlug && link.customSlug === slug));
                  const clickCount = Number(link.clicks) || 0;

                  return (
                    <tr key={slug || idx}>
                      {/* Column 1: Original Destination */}
                      <td className="col-destination">
                        <div className="destination-wrapper">
                          <a
                            href={originalDestination}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="destination-url"
                            title={originalDestination}
                          >
                            <span className="url-text">{originalDestination}</span>
                            <ExternalLinkIcon />
                          </a>
                        </div>
                      </td>

                      {/* Column 2: Short Link (with Custom Slug or random code) */}
                      <td className="col-shortlink">
                        <div className="shortlink-cell-wrapper">
                          <div className="shortlink-badge-group">
                            <a
                              href={displayShortUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shortlink-anchor"
                            >
                              /{slug}
                            </a>
                            {isCustomSlug && (
                              <span className="slug-type-tag" title="User-defined custom back-half">
                                Custom Slug
                              </span>
                            )}
                          </div>
                          
                          <button
                            className={`btn-table-copy ${copiedCode === slug ? 'copied' : ''}`}
                            onClick={() => handleCopyLink(displayShortUrl, slug)}
                            title="Copy short link"
                            aria-label={`Copy short link for /${slug}`}
                          >
                            {copiedCode === slug ? (
                              <><CheckMiniIcon /> Copied</>
                            ) : (
                              <><CopyMiniIcon /> Copy</>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Column 3: Total Real-Time Clicks */}
                      <td className="col-clicks" style={{ textAlign: 'right' }}>
                        <span className={`click-badge-pill ${clickCount > 0 ? 'has-clicks' : 'zero-clicks'}`}>
                          {clickCount.toLocaleString()} clicks
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ad Placeholder — fixed height for zero CLS */}
      <div className="ad-placeholder" role="complementary" aria-label="Advertisement">
        Ad Space — Dashboard Banner Slot (Zero CLS Compliant)
      </div>
    </section>
  );
}
