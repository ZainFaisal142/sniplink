/**
 * ===================================================================
 * FILE 3: /frontend/src/components/PasswordReset.jsx
 * Password Recovery & Reset Flow Component (Origin Financial Aesthetic)
 * ===================================================================
 */

import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { requestPasswordReset, confirmPasswordReset } from '../services/authService';

/* ── Inline SVG Icons ──────────────────────────────────────────── */
const ShieldKeyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <circle cx="12" cy="11" r="2" />
    <line x1="12" y1="13" x2="12" y2="17" />
  </svg>
);

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

export default function PasswordReset() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  // Modes: 'request' | 'submitted' | 'reset' | 'reset-success'
  const [mode, setMode] = useState(token ? 'reset' : 'request');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetDetails, setResetDetails] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      setMode('reset');
    }
  }, [token]);

  /* ── 1. Request Reset Link ───────────────────────────────────── */
  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const response = await requestPasswordReset(email.trim());
      setResetDetails(response);
      setMode('submitted');
    } catch (err) {
      setError(err.message || 'Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  };

  /* ── 2. Confirm New Password ─────────────────────────────────── */
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please check and retype.');
      return;
    }

    setLoading(true);

    try {
      await confirmPasswordReset(token, newPassword);
      setMode('reset-success');
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page fade-in">
      <div className="auth-card card">
        {/* VIEW 1: Request Reset Link */}
        {mode === 'request' && (
          <>
            <div className="auth-header">
              <div className="auth-icon-badge">
                <ShieldKeyIcon />
              </div>
              <h1>Reset Password</h1>
              <p>Enter your email and we'll send you a secure link to reset your credentials.</p>
            </div>

            {error && (
              <div className="error-banner" role="alert">
                <AlertIcon />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRequestSubmit} noValidate className="auth-form">
              <div className="form-group">
                <label htmlFor="reset-email" className="form-label">
                  Registered Email Address
                </label>
                <div className="input-with-icon">
                  <span className="input-icon"><MailIcon /></span>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="name@example.com"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-auth-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="loader-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    <span>Sending Link...</span>
                  </>
                ) : (
                  <>
                    <span>Send Reset Link</span>
                    <ArrowRightIcon />
                  </>
                )}
              </button>
            </form>

            <div className="auth-footer">
              <Link to="/login" className="back-link">
                <ArrowLeftIcon />
                <span>Back to Log In</span>
              </Link>
            </div>
          </>
        )}

        {/* VIEW 2: Success State (Link Sent) */}
        {mode === 'submitted' && (
          <div className="auth-success-view">
            <div className="success-icon-badge">
              <CheckCircleIcon />
            </div>
            <h1>Check your inbox!</h1>
            <p>
              We've sent a recovery link to <strong>{email}</strong>. Follow the instructions in the email to set your new password.
            </p>

            {resetDetails?.resetLink && (
              <div className="demo-reset-notice">
                <span>Demo recovery link generated:</span>
                <a href={resetDetails.resetLink} className="demo-reset-link">
                  {resetDetails.resetLink}
                </a>
              </div>
            )}

            <div className="auth-actions-group" style={{ marginTop: '24px' }}>
              <Link to="/login" className="btn-auth-submit">
                <span>Return to Log In</span>
              </Link>
            </div>
          </div>
        )}

        {/* VIEW 3: Set New Password Form (token present in URL) */}
        {mode === 'reset' && (
          <>
            <div className="auth-header">
              <div className="auth-icon-badge">
                <LockIcon />
              </div>
              <h1>Set New Password</h1>
              <p>Enter your new password below to secure your SnipLink account.</p>
            </div>

            {error && (
              <div className="error-banner" role="alert">
                <AlertIcon />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleResetSubmit} noValidate className="auth-form">
              <div className="form-group">
                <label htmlFor="new-password" className="form-label">
                  New Password
                </label>
                <div className="input-with-icon">
                  <span className="input-icon"><LockIcon /></span>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="At least 6 characters"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirm-password" className="form-label">
                  Confirm New Password
                </label>
                <div className="input-with-icon">
                  <span className="input-icon"><LockIcon /></span>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Re-enter your new password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-auth-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="loader-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <span>Update Password</span>
                    <ArrowRightIcon />
                  </>
                )}
              </button>
            </form>

            <div className="auth-footer">
              <Link to="/login" className="back-link">
                <ArrowLeftIcon />
                <span>Back to Log In</span>
              </Link>
            </div>
          </>
        )}

        {/* VIEW 4: Password Successfully Changed */}
        {mode === 'reset-success' && (
          <div className="auth-success-view">
            <div className="success-icon-badge">
              <CheckCircleIcon />
            </div>
            <h1>Password Updated!</h1>
            <p>Your password has been successfully reset. You can now log in with your new credentials.</p>
            <div className="auth-actions-group" style={{ marginTop: '24px' }}>
              <Link to="/login" className="btn-auth-submit">
                <span>Go to Log In</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
