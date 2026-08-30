/**
 * ===================================================================
 * FILE 3: /frontend/src/components/Dashboard.jsx
 * Real-Time Edge Analytics & Bento Grid Dashboard
 * ===================================================================
 */

import React, { useState, useEffect } from 'react';
import { fetchStats } from '../services/apiService';

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

const ExternalIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const EmptyIcon = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="9" x2="15" y2="15" />
    <line x1="15" y1="9" x2="9" y2="15" />
  </svg>
);

/* ── Dashboard Component ───────────────────────────────────────── */
export default function Dashboard() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadDashboardData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const data = await fetchStats();
      const items = Array.isArray(data) ? data : (Array.isArray(data.links) ? data.links : []);
      setLinks(items);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(err.message || 'Could not synchronize metrics with Cloudflare KV.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  /* Calculate Live Metrics Safely */
  const totalShortenedLinks = links.length;
  const totalGlobalClicks = links.reduce((sum, item) => sum + (Number(item.clicks) || 0), 0);
  const avgClicksPerLink = totalShortenedLinks > 0
    ? (totalGlobalClicks / totalShortenedLinks).toFixed(1)
    : '0.0';

  /* ── Animated Skeleton / Loading State ───────────────────────── */
  if (loading) {
    return (
      <section className="dashboard-loading-container fade-in" aria-live="polite">
        <div className="loader-card">
          <div className="loader-spinner-edge" />
          <div className="loader-text-group">
            <h3>Syncing with Cloudflare Edge...</h3>
            <p>Querying Cloudflare KV real-time database registers & telemetry</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-page fade-in">
      {/* Header & Refresh Action */}
      <div className="dashboard-header">
        <div className="dashboard-title-area">
          <h1>Analytics Dashboard</h1>
          <p>Real-time click telemetry and link performance metrics from Cloudflare KV.</p>
        </div>

        <div className="dashboard-actions">
          <button
            className={`btn-refresh ${refreshing ? 'spinning' : ''}`}
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            aria-label="Refresh telemetry from Cloudflare KV"
          >
            <RefreshIcon />
            <span>{refreshing ? 'Syncing...' : 'Sync Edge Data'}</span>
          </button>
        </div>
      </div>

      {/* Error Notice if any */}
      {error && (
        <div className="dashboard-error-banner" role="alert">
          <p><strong>Notice:</strong> {error}</p>
          <button className="btn-retry" onClick={() => loadDashboardData(true)}>
            Retry Connection
          </button>
        </div>
      )}

      {/* Bento Grid Metrics Layout */}
      <div className="stats-grid bento-grid">
        {/* Metric 1: Total Shortened Links */}
        <div className="card bento-card">
          <div className="card-icon">
            <LinkIcon />
          </div>
          <span className="card-label">Total Shortened Links</span>
          <span className="card-value">{totalShortenedLinks.toLocaleString()}</span>
          <span className="card-subtext">Active KV storage keys</span>
        </div>

        {/* Metric 2: Total Global Clicks */}
        <div className="card bento-card">
          <div className="card-icon">
            <ClickIcon />
          </div>
          <span className="card-label">Total Global Clicks</span>
          <span className="card-value">{totalGlobalClicks.toLocaleString()}</span>
          <span className="card-subtext">Edge-routed redirects</span>
        </div>

        {/* Metric 3: Average Clicks per Link */}
        <div className="card bento-card">
          <div className="card-icon">
            <ActivityIcon />
          </div>
          <span className="card-label">Average Clicks per Link</span>
          <span className="card-value">{avgClicksPerLink}</span>
          <span className="card-subtext">Conversion engagement</span>
        </div>
      </div>

      {/* Registers Activity Table */}
      <div className="card table-card">
        <div className="table-header-row">
          <div>
            <h2>Link Registry & Activity Logs</h2>
            <span className="table-subtitle">Live registers synced from Cloudflare LINKS_KV namespace</span>
          </div>
          <span className="record-count-badge">
            {totalShortenedLinks} {totalShortenedLinks === 1 ? 'Link' : 'Links'}
          </span>
        </div>

        {links.length === 0 ? (
          <div className="empty-state">
            <EmptyIcon />
            <h3>No Shortened Links Yet</h3>
            <p>Shorten your first destination URL to start tracking real-time click telemetry.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Original Destination</th>
                  <th scope="col">Short Link Path</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Verified Click Count</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link, idx) => {
                  const shortCode = link.shortCode || link.code || link.slug || `link-${idx}`;
                  const destination = link.url || link.originalUrl || '';
                  const shortUrl = link.shortUrl || `${window.location.origin}/#/r/${shortCode}`;
                  const clickCount = Number(link.clicks) || 0;

                  return (
                    <tr key={shortCode}>
                      {/* Column 1: Original Destination */}
                      <td className="col-destination">
                        <div className="destination-wrapper">
                          <a
                            href={destination}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="destination-url"
                            title={destination}
                          >
                            <span className="url-text">{destination}</span>
                            <ExternalIcon />
                          </a>
                        </div>
                      </td>

                      {/* Column 2: Short Link Path */}
                      <td className="col-shortlink">
                        <a
                          href={shortUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shortlink-anchor"
                        >
                          /{shortCode}
                        </a>
                      </td>

                      {/* Column 3: Verified Click Count */}
                      <td className="col-clicks" style={{ textAlign: 'right' }}>
                        <span className={`click-badge-pill ${clickCount > 0 ? 'has-clicks' : 'zero-clicks'}`}>
                          {clickCount.toLocaleString()} {clickCount === 1 ? 'click' : 'clicks'}
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

      {/* Zero Cumulative Layout Shift (CLS) Compliant Ad Slot */}
      <div
        className="ad-placeholder"
        role="complementary"
        aria-label="Advertisement Slot"
      >
        <span>Ad Space — Dashboard 728×90 Mobile / 250px Desktop Fixed Slot (Zero CLS)</span>
      </div>
    </section>
  );
}
