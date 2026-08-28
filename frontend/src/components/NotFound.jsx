import { Link } from 'react-router-dom';

/* ── 404 Not Found Page ────────────────────────────────────────── */
export default function NotFound() {
  return (
    <section className="notfound-page fade-in">
      <div className="notfound-code">404</div>
      <h2>Page Not Found</h2>
      <p>
        The link you followed may be broken, expired, or the page may have been removed.
        Let's get you back on track.
      </p>
      <Link to="/" className="btn-home">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        Back to Home
      </Link>
    </section>
  );
}
