import { useState, useEffect, useCallback } from 'react';
import { fetchStats as getStats } from '../services/apiService';

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
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

/* ── Dashboard Component ───────────────────────────────────────── */
export default function Dashboard() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError('');

    try {
      const data = await getStats();
      setLinks(data.links || []);
    } catch (err) {
      setError(err.message || 'Could not load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* Derived metrics */
  const totalLinks = links.length;
  const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);

  if (loading) {
    return (
      <div className="loader">
        <div className="loader-spinner" />
      </div>
    );
  }

  return (
    <section className="dashboard-page fade-in">
      {/* Header */}
      <div className="dashboard-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Dashboard</h1>
          <p>Monitor your link performance in real time.</p>
        </div>
        <button
          className={`btn-refresh ${refreshing ? 'spinning' : ''}`}
          onClick={() => loadData(true)}
          disabled={refreshing}
        >
          <RefreshIcon />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--color-error)', marginBottom: 24 }}>
          <p style={{ color: 'var(--color-error)', fontSize: '0.875rem' }}>{error}</p>
        </div>
      )}

      {/* Stats Bento Grid */}
      <div className="stats-grid">
        <div className="card">
          <div className="card-icon">
            <LinkIcon />
          </div>
          <span className="card-label">Total Links Created</span>
          <span className="card-value">{totalLinks.toLocaleString()}</span>
        </div>

        <div className="card">
          <div className="card-icon">
            <ClickIcon />
          </div>
          <span className="card-label">Total Clicks Routed</span>
          <span className="card-value">{totalClicks.toLocaleString()}</span>
        </div>

        <div className="card">
          <div className="card-icon">
            <ActivityIcon />
          </div>
          <span className="card-label">Avg. Clicks / Link</span>
          <span className="card-value">
            {totalLinks > 0 ? (totalClicks / totalLinks).toFixed(1) : '0'}
          </span>
        </div>
      </div>

      {/* Recent Link Activity Table */}
      <div className="card table-card">
        <h2>Recent Link Activity</h2>
        {links.length === 0 ? (
          <div className="empty-state">
            <EmptyIcon />
            <p>No links yet. Go shorten one!</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Short Link</th>
                  <th>Destination</th>
                  <th>Clicks</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.code}>
                    <td>
                      <a
                        href={link.shortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="short-link"
                      >
                        /{link.code}
                      </a>
                    </td>
                    <td>
                      <span className="url-cell" title={link.url}>
                        {link.url}
                      </span>
                    </td>
                    <td>
                      <span className="click-badge">{(link.clicks || 0).toLocaleString()} clicks</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ad Placeholder — fixed height for zero CLS */}
      <div className="ad-placeholder" role="complementary" aria-label="Advertisement">
        Ad Space — Dashboard Banner Slot
      </div>
    </section>
  );
}
