/**
 * ===================================================================
 * /frontend/src/components/Dashboard.jsx
 * Live Analytics Dashboard — Fetches real data from Cloudflare Workers
 * ===================================================================
 */

import React, { useState, useEffect } from 'react';
import { fetchStats } from '../services/apiService';

/* ── Inline SVG Icons ──────────────────────────────────────────── */
const LinkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const ClickIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 15l-2 5L9 9l11 4-5 2z" />
    <path d="M22 22l-5-5" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const ExternalIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

/* ── Skeleton Loader ───────────────────────────────────────────── */
function SkeletonLoader() {
  return (
    <section className="dashboard-page fade-in">
      <div className="dashboard-header">
        <div>
          <h1>Analytics Dashboard</h1>
          <p className="sync-status">
            <span className="sync-dot" />
            Syncing with Cloudflare Edge...
          </p>
        </div>
      </div>

      {/* Skeleton Metric Cards */}
      <div className="stats-grid bento-grid">
        <div className="card bento-card skeleton-card">
          <div className="skeleton-line skeleton-sm" />
          <div className="skeleton-line skeleton-lg" />
        </div>
        <div className="card bento-card skeleton-card">
          <div className="skeleton-line skeleton-sm" />
          <div className="skeleton-line skeleton-lg" />
        </div>
      </div>

      {/* Skeleton Table */}
      <div className="card table-card skeleton-card">
        <div className="skeleton-line skeleton-md" style={{ marginBottom: '20px' }} />
        <div className="skeleton-line skeleton-full" />
        <div className="skeleton-line skeleton-full" />
        <div className="skeleton-line skeleton-full" />
      </div>
    </section>
  );
}

/* ── Dashboard Component ───────────────────────────────────────── */
export default function Dashboard() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /** Load statistics reliably */
  async function loadData() {
    try {
      const stats = await fetchStats();
      const items = Array.isArray(stats?.links) ? stats.links : [];
      setLinks(items);
    } catch (err) {
      console.warn('Dashboard load error:', err);
    }
  }

  // Initial fetch on mount
  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  // Manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Show skeleton during initial load
  if (loading) {
    return <SkeletonLoader />;
  }

  /* ── Calculated Metrics ──────────────────────────────────────── */
  const totalLinks = links.length;
  const totalClicks = links.reduce((sum, item) => sum + (Number(item.clicks) || 0), 0);

  return (
    <section className="dashboard-page fade-in">
      {/* Header Row */}
      <div className="dashboard-header">
        <div>
          <h1>Analytics Dashboard</h1>
          <p>Real-time click data from Cloudflare Edge.</p>
        </div>
        <button
          className={`btn-refresh ${refreshing ? 'spinning' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh metrics"
        >
          <RefreshIcon />
          <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
        </button>
      </div>

      {/* 2 Bento Metric Cards */}
      <div className="stats-grid bento-grid">
        <div className="card bento-card">
          <div className="card-icon">
            <LinkIcon />
          </div>
          <span className="card-label">Global Short Links</span>
          <span className="card-value">{totalLinks}</span>
        </div>

        <div className="card bento-card">
          <div className="card-icon">
            <ClickIcon />
          </div>
          <span className="card-label">Total Click Operations</span>
          <span className="card-value">{totalClicks.toLocaleString()}</span>
        </div>
      </div>

      {/* Links Table */}
      <div className="card table-card">
        <div className="table-header-row">
          <h2>Link Registry</h2>
          <span className="record-count-badge">{totalLinks} links</span>
        </div>

        {totalLinks === 0 ? (
          <div className="empty-state">
            <LinkIcon />
            <p>No shortened links found yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Destination Link</th>
                  <th scope="col">Short Link</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Real-time Clicks</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link, idx) => {
                  const code = link.shortCode || link.code || link.slug || `link-${idx}`;
                  const dest = link.url || link.originalUrl || '';
                  const clickCount = Number(link.clicks) || 0;
                  const shortHref = link.shortUrl || `${window.location.origin}/r/${code}`;

                  return (
                    <tr key={code + idx}>
                      <td className="col-destination">
                        <a
                          href={dest}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="destination-url"
                          title={dest}
                        >
                          <span className="url-text">{dest}</span>
                          <ExternalIcon />
                        </a>
                      </td>
                      <td className="col-shortlink">
                        <a
                          href={shortHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shortlink-anchor"
                        >
                          /{code}
                        </a>
                      </td>
                      <td className="col-clicks" style={{ textAlign: 'right' }}>
                        <span className="click-badge">
                          {clickCount.toLocaleString()}
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

      {/* Zero CLS Ad Slot */}
      <div className="ad-placeholder" role="complementary" aria-label="Advertisement">
        <span>Ad Space — Zero CLS Banner</span>
      </div>
    </section>
  );
}
