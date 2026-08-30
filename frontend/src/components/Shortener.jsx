/**
 * ===================================================================
 * FILE 2: /frontend/src/components/Shortener.jsx
 * High-Performance Edge URL Shortener Component (Origin Financial Aesthetic)
 * ===================================================================
 */

import React, { useState } from 'react';
import { shortenUrl } from '../services/apiService';

/* ── Inline SVG Icons ──────────────────────────────────────────── */
const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

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

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

/* ── Strict URL Validator ──────────────────────────────────────── */
function isValidHttpUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/* ── Shortener Component ───────────────────────────────────────── */
export default function Shortener() {
  const [longUrl, setLongUrl] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [originalDestination, setOriginalDestination] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setShortUrl('');
    setCopied(false);

    const trimmed = longUrl.trim();

    // Strict URL Validation
    if (!trimmed) {
      setError('Please paste or type a destination URL.');
      return;
    }

    if (!isValidHttpUrl(trimmed)) {
      setError('Invalid URL format. Destination URL must start with http:// or https://');
      return;
    }

    setLoading(true);

    try {
      const result = await shortenUrl(trimmed);
      if (!result || !result.shortUrl) {
        throw new Error('Failed to generate short link from the server.');
      }
      setShortUrl(result.shortUrl);
      setOriginalDestination(trimmed);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred while shortening the link.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = shortUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <section className="shortener-page fade-in">
      {/* Hero Branding */}
      <div className="shortener-hero">
        <h1>
          <span className="gradient-text">Own your links.</span>
          <br />
          Share with confidence.
        </h1>
        <p>
          Transform long, unwieldy URLs into clean, trackable short links.
          Lightning-fast redirects powered by Cloudflare KV Edge storage.
        </p>
      </div>

      {/* Origin Financial Input Card */}
      <div className="shortener-card">
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field-group">
            <label htmlFor="urlInput" className="form-label">
              Destination URL
            </label>
            <div className="input-group">
              <input
                id="urlInput"
                type="url"
                value={longUrl}
                onChange={(e) => {
                  setLongUrl(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Paste your long URL here (e.g. https://example.com/project)..."
                className={error ? 'input-error' : ''}
                aria-label="Enter destination URL to shorten"
                autoFocus
                required
              />
              <button
                type="submit"
                className="btn-shorten"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="loader-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    <span>Shortening...</span>
                  </>
                ) : (
                  <>
                    <span>Shorten</span>
                    <ArrowIcon />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Validation & Error Alert */}
          {error && (
            <div className="error-banner" role="alert">
              <AlertIcon />
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* Shortened URL Result Card */}
        {shortUrl && (
          <div className="result-card">
            <div className="result-info">
              <span className="result-tag">Your Active Edge Short Link</span>
              <a
                href={shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="result-short-url"
              >
                {shortUrl}
              </a>
              <span className="result-long-url" title={originalDestination}>
                ↳ Destination: {originalDestination}
              </span>
            </div>

            <button
              className={`btn-copy ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              aria-label="Copy short URL to clipboard"
            >
              {copied ? (
                <>
                  <CheckIcon />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <ClipboardIcon />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Zero Cumulative Layout Shift (CLS) Compliant Ad Slot */}
      <div
        className="ad-placeholder"
        role="complementary"
        aria-label="Advertisement Slot"
      >
        <span>Ad Space — 728×90 Mobile / 250px Desktop Fixed Slot (Zero CLS)</span>
      </div>
    </section>
  );
}
