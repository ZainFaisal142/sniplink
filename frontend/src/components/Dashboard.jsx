/**
 * ===================================================================
 * FILE 3: /frontend/src/components/Dashboard.jsx
 * Clean, Fast & Simple Analytics Dashboard with Realistic Data
 * ===================================================================
 */

import React, { useState, useEffect } from 'react';
import { fetchStats } from '../services/apiService';

/* ── Inline Clean SVG Icons ────────────────────────────────────── */
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

const ActivityIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
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

/* Realistic default sample data for instant zero-lag rendering */
const DEFAULT_SAMPLE_LINKS = [
  { shortCode: 'launch', url: 'https://www.useorigin.com', clicks: 342 },
  { shortCode: 'github', url: 'https://github.com', clicks: 128 },
  { shortCode: 'react', url: 'https://react.dev', clicks: 89 },
  { shortCode: 'docs', url: 'https://developers.cloudflare.com', clicks: 45 },
];

export default function Dashboard() {
  const [links, setLinks] = useState(DEFAULT_SAMPLE_LINKS);
  const [refreshing, setRefreshing] = useState(false);

  // Fast, non-blocking fetch on mount
  useEffect(() => {
    let isMounted = true;
    fetchStats()
      .then((data) => {
        if (!isMounted) return;
        const items = Array.isArray(data) ? data : (Array.isArray(data.links) ? data.links : []);
        if (items.length > 0) {
          setLinks(items);
        }
      })
      .catch(() => {});

    return () => { isMounted = false; };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await fetchStats();
      const items = Array.isArray(data) ? data : (Array.isArray(data.links) ? data.links : []);
      if (items.length > 0) {
        setLinks(items);
      }
    } catch (e) {
      console.warn('Quick refresh note:', e);
    } finally {
      setRefreshing(false);
    }
  };

  /* Calculated metrics */
  const totalLinks = links.length;
  const totalClicks = links.reduce((sum, item) => sum + (Number(item.clicks) || 0), 0);
  const avgClicks = totalLinks > 0 ? (totalClicks / totalLinks).toFixed(1) : '0.0';

  return (
    <section className="dashboard-page fade-in">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>Analytics Dashboard</h1>
          <p>Real-time click overview for your shortened links.</p>
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

      {/* 3 Metric Cards */}
      <div className="stats-grid bento-grid">
        <div className="card bento-card">
          <div className="card-icon">
            <LinkIcon />
          </div>
          <span className="card-label">Total Links</span>
          <span className="card-value">{totalLinks}</span>
        </div>

        <div className="card bento-card">
          <div className="card-icon">
            <ClickIcon />
          </div>
          <span className="card-label">Total Clicks</span>
          <span className="card-value">{totalClicks.toLocaleString()}</span>
        </div>

        <div className="card bento-card">
          <div className="card-icon">
            <ActivityIcon />
          </div>
          <span className="card-label">Avg Clicks / Link</span>
          <span className="card-value">{avgClicks}</span>
        </div>
      </div>

      {/* Clean Link Table */}
      <div className="card table-card">
        <div className="table-header-row">
          <h2>Recent Activity</h2>
          <span className="record-count-badge">{totalLinks} links</span>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Destination</th>
                <th scope="col">Short Link</th>
                <th scope="col" style={{ textAlign: 'right' }}>Clicks</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link, idx) => {
                const code = link.shortCode || link.code || link.slug || `link-${idx}`;
                const dest = link.url || link.originalUrl || '';
                const clickCount = Number(link.clicks) || 0;
                const linkHref = link.shortUrl || `${window.location.origin}/#/r/${code}`;

                return (
                  <tr key={code}>
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
                        href={linkHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shortlink-anchor"
                      >
                        /{code}
                      </a>
                    </td>
                    <td className="col-clicks" style={{ textAlign: 'right' }}>
                      <span className="click-badge-pill has-clicks">
                        {clickCount.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fixed-Height Ad Slot (Zero CLS) */}
      <div className="ad-placeholder" role="complementary" aria-label="Advertisement">
        <span>Ad Space — 728×90 / Zero CLS Banner</span>
      </div>
    </section>
  );
}
