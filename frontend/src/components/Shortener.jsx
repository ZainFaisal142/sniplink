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

const TagIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

/* ── Validators ────────────────────────────────────────────────── */
function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates that custom slug contains only alphanumeric characters and hyphens.
 */
function isValidSlug(str) {
  return /^[a-zA-Z0-9-]+$/.test(str);
}

/* ── Shortener Component ───────────────────────────────────────── */
export default function Shortener() {
  const [longUrl, setLongUrl] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [error, setError] = useState('');
  const [slugError, setSlugError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Handle Custom Slug live input validation
  const handleCustomSlugChange = (e) => {
    const val = e.target.value;
    setCustomSlug(val);
    setError('');

    if (val.trim() && !isValidSlug(val.trim())) {
      setSlugError('Only letters, numbers, and hyphens are allowed (no spaces or special symbols).');
    } else {
      setSlugError('');
    }
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setSlugError('');
    setShortUrl('');
    setCopied(false);

    const trimmedUrl = longUrl.trim();
    const trimmedSlug = customSlug.trim();

    // 1. Long URL validation
    if (!trimmedUrl) {
      setError('Please enter a destination URL.');
      return;
    }

    if (!isValidUrl(trimmedUrl)) {
      setError('Invalid destination URL. Must start with http:// or https://');
      return;
    }

    // 2. Custom Slug validation (if provided)
    if (trimmedSlug) {
      if (!isValidSlug(trimmedSlug)) {
        setError('Custom slug can only contain letters, numbers, and hyphens (no spaces or special symbols).');
        setSlugError('Custom slug can only contain letters, numbers, and hyphens.');
        return;
      }
      if (trimmedSlug.length < 2 || trimmedSlug.length > 50) {
        setError('Custom slug must be between 2 and 50 characters long.');
        setSlugError('Must be between 2 and 50 characters.');
        return;
      }
    }

    setLoading(true);

    try {
      // Send customSlug in POST payload if present
      const data = await shortenUrl(trimmedUrl, trimmedSlug || undefined);
      if (!data || !data.shortUrl) {
        throw new Error('Failed to generate short link.');
      }
      setShortUrl(data.shortUrl);
      setOriginalUrl(trimmedUrl);
    } catch (err) {
      // Handles 409 Conflict ("This custom back-half is already taken!") and server errors
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [longUrl, customSlug]);

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
      {/* Hero Header */}
      <div className="shortener-hero">
        <h1>
          <span className="gradient-text">Own your links.</span>
          <br />
          Share with confidence.
        </h1>
        <p>
          Transform long, unwieldy URLs into clean, branded short links with custom back-halves.
          Lightning-fast redirects powered by Cloudflare Edge & KV.
        </p>
      </div>

      {/* Shortener Card */}
      <div className="shortener-card">
        <form onSubmit={handleSubmit} noValidate>
          {/* Main URL Input Group */}
          <div className="form-field-group">
            <label htmlFor="longUrlInput" className="form-label">
              Destination URL
            </label>
            <div className="input-group">
              <input
                id="longUrlInput"
                type="url"
                value={longUrl}
                onChange={(e) => { setLongUrl(e.target.value); setError(''); }}
                placeholder="Paste your long URL here (e.g. https://example.com)..."
                className={error && !longUrl.trim() ? 'input-error' : ''}
                aria-label="Enter a destination URL to shorten"
                autoFocus
                required
              />
            </div>
          </div>

          {/* Custom Back-half (Optional) Input Field */}
          <div className="form-field-group slug-field-group">
            <div className="slug-label-row">
              <label htmlFor="customSlugInput" className="form-label">
                <TagIcon />
                <span>Custom Back-half (Optional)</span>
              </label>
              <span className="label-badge">Custom Slugs</span>
            </div>
            
            <div className={`slug-input-wrapper ${slugError ? 'input-error' : ''}`}>
              <span className="slug-prefix" aria-hidden="true">
                sniplink.to/
              </span>
              <input
                id="customSlugInput"
                type="text"
                value={customSlug}
                onChange={handleCustomSlugChange}
                placeholder="e.g. my-game, summer-sale, portfolio"
                className="slug-input"
                aria-label="Custom Back-half (Optional)"
                maxLength={50}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
              />
            </div>

            {slugError ? (
              <span className="field-hint error-hint" role="alert">
                <AlertCircleIcon /> {slugError}
              </span>
            ) : (
              <span className="field-hint">
                Alphanumeric characters and hyphens only. Leave blank for a random 6-character code.
              </span>
            )}
          </div>

          {/* Submit Button */}
          <div className="form-actions">
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
                  Shorten Link
                  <ArrowIcon />
                </>
              )}
            </button>
          </div>

          {/* Global Form Error Message (e.g. 409 Conflict) */}
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircleIcon />
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* Shortened Result Card */}
        {shortUrl && (
          <div className="result-card">
            <div className="result-info">
              <span className="result-tag">Generated Short Link</span>
              <a
                href={shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="result-short-url"
              >
                {shortUrl}
              </a>
              <span className="result-long-url" title={originalUrl}>
                ↳ Destination: {originalUrl}
              </span>
            </div>
            <button
              className={`btn-copy ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              aria-label="Copy short URL to clipboard"
            >
              {copied ? <><CheckIcon /> Copied!</> : <><ClipboardIcon /> Copy Link</>}
            </button>
          </div>
        )}
      </div>

      {/* Ad Placeholder — fixed height for zero CLS */}
      <div className="ad-placeholder" role="complementary" aria-label="Advertisement">
        Ad Space — 728×90 / Responsive Slot (Zero CLS)
      </div>
    </section>
  );
}
