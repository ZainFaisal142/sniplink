import { useState, useCallback } from 'react';
import { shortenUrl } from '../services/apiService';

/* ── Inline SVG Icons ──────────────────────────────────────────── */
const ClipboardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

/* ── URL Validator ─────────────────────────────────────────────── */
function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/* ── Shortener Component ───────────────────────────────────────── */
export default function Shortener() {
  const [longUrl, setLongUrl] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setShortUrl('');
    setCopied(false);

    const trimmed = longUrl.trim();

    if (!trimmed) {
      setError('Please enter a URL.');
      return;
    }

    if (!isValidUrl(trimmed)) {
      setError('Invalid URL. Must start with http:// or https://');
      return;
    }

    setLoading(true);

    try {
      const data = await shortenUrl(trimmed);
      if (!data || !data.shortUrl) {
        throw new Error('Failed to generate short link.');
      }
      setShortUrl(data.shortUrl);
      setOriginalUrl(trimmed);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [longUrl]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = shortUrl;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shortUrl]);

  return (
    <section className="shortener-page fade-in">
      {/* Hero */}
      <div className="shortener-hero">
        <h1>
          <span className="gradient-text">Own your links.</span>
          <br />
          Share with confidence.
        </h1>
        <p>
          Transform long, unwieldy URLs into clean, trackable short links.
          Lightning-fast redirects powered by the edge.
        </p>
      </div>

      {/* Shortener Card */}
      <div className="shortener-card">
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="url"
              value={longUrl}
              onChange={(e) => { setLongUrl(e.target.value); setError(''); }}
              placeholder="Paste your long URL here (e.g. https://example.com)..."
              className={error ? 'input-error' : ''}
              aria-label="Enter a URL to shorten"
              autoFocus
            />
            <button
              type="submit"
              className="btn-shorten"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loader-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Shortening...
                </>
              ) : (
                <>
                  Shorten
                  <ArrowIcon />
                </>
              )}
            </button>
          </div>
          {error && <span className="error-text" role="alert">{error}</span>}
        </form>

        {/* Result */}
        {shortUrl && (
          <div className="result-card">
            <div className="result-info">
              <a
                href={shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="result-short-url"
              >
                {shortUrl}
              </a>
              <span className="result-long-url" title={originalUrl}>
                {originalUrl}
              </span>
            </div>
            <button
              className={`btn-copy ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              aria-label="Copy short URL to clipboard"
            >
              {copied ? <><CheckIcon /> Copied!</> : <><ClipboardIcon /> Copy</>}
            </button>
          </div>
        )}
      </div>

      {/* Ad Placeholder — fixed height for zero CLS */}
      <div className="ad-placeholder" role="complementary" aria-label="Advertisement">
        Ad Space — 728×90 / Responsive Slot
      </div>
    </section>
  );
}
