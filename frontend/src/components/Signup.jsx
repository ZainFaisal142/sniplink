/**
 * ===================================================================
 * FILE 1: /frontend/src/components/Signup.jsx
 * Account Creation Component with Strict @gmail.com Validation
 * (Origin Financial Dark Aesthetic: #090D16, #6366F1, #8B5CF6)
 * ===================================================================
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signupUser } from '../services/authService';

/* ── Inline SVG Icons ──────────────────────────────────────────── */
const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
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

const EyeIcon = ({ visible }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {visible ? (
      <>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </>
    )}
  </svg>
);

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

/* ── Strict @gmail.com Regex Validator ─────────────────────────── */
const STRICT_GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

/* ── Password Strength Calculator ──────────────────────────────── */
function calculatePasswordStrength(pass) {
  if (!pass) return { score: 0, label: '', class: '' };

  let score = 0;
  if (pass.length >= 6) score += 1;
  if (pass.length >= 10) score += 1;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
  if (/[0-9]/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;

  if (score <= 1) return { score: 25, label: 'Weak', class: 'weak' };
  if (score <= 2) return { score: 50, label: 'Fair', class: 'fair' };
  if (score <= 4) return { score: 75, label: 'Good', class: 'good' };
  return { score: 100, label: 'Strong', class: 'strong' };
}

export default function Signup({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    agreedToTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Real-time strict Gmail validation states
  const isEmailEntered = formData.email.trim().length > 0;
  const isEmailValidGmail = STRICT_GMAIL_REGEX.test(formData.email.trim());
  const isPasswordValid = formData.password.length >= 6;
  const isNameValid = formData.name.trim().length > 0;
  const isFormValid = isNameValid && isEmailValidGmail && isPasswordValid && formData.agreedToTerms;

  const strength = calculatePasswordStrength(formData.password);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const { name, email, password, agreedToTerms } = formData;
    const trimmedEmail = email.trim();

    // 1. Validation Checks
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!STRICT_GMAIL_REGEX.test(trimmedEmail)) {
      setError('Registration is restricted to Gmail accounts only (must end with @gmail.com).');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);

    try {
      await signupUser({
        name: name.trim(),
        email: trimmedEmail.toLowerCase(),
        password,
      });

      if (onLoginSuccess) {
        onLoginSuccess();
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page fade-in">
      <div className="auth-card card">
        <div className="auth-header">
          <div className="auth-icon-badge">
            <UserIcon />
          </div>
          <h1>Create your account</h1>
          <p>Join SnipLink for ultra-fast edge link shortening &amp; telemetry.</p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="error-banner" role="alert">
            <AlertIcon />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="auth-form">
          {/* Full Name */}
          <div className="form-group">
            <label htmlFor="signup-name" className="form-label">
              Full Name
            </label>
            <div className="input-with-icon">
              <span className="input-icon"><UserIcon /></span>
              <input
                id="signup-name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="Zain Faisal"
                required
                autoComplete="name"
                autoFocus
              />
            </div>
          </div>

          {/* Email Address with Strict @gmail.com and Label Requirement */}
          <div className="form-group">
            <label htmlFor="signup-email" className="form-label">
              Email Address <span className="label-badge-hint">Must end in .COM</span>
            </label>
            <div className="input-with-icon">
              <span className="input-icon"><MailIcon /></span>
              <input
                id="signup-email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="yourname@gmail.com"
                required
                autoComplete="email"
                className={isEmailEntered && !isEmailValidGmail ? 'input-error' : ''}
              />
            </div>

            {/* Real-time strict Gmail feedback with red text */}
            {isEmailEntered && !isEmailValidGmail && (
              <span className="error-text">
                Must be a valid Gmail account (e.g. yourname@gmail.com).
              </span>
            )}
          </div>

          {/* Password with Strength Meter */}
          <div className="form-group">
            <label htmlFor="signup-password" className="form-label">
              Password
            </label>
            <div className="input-with-icon">
              <span className="input-icon"><LockIcon /></span>
              <input
                id="signup-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a strong password..."
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="btn-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>

            {/* Dynamic Password Strength Meter */}
            {formData.password.length > 0 && (
              <div className="strength-meter-container">
                <div className="strength-bar-bg">
                  <div
                    className={`strength-bar-fill ${strength.class}`}
                    style={{ width: `${strength.score}%` }}
                  />
                </div>
                <span className={`strength-label ${strength.class}`}>
                  Strength: <strong>{strength.label}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Terms & Conditions Custom Checkbox */}
          <div className="checkbox-group">
            <label className="checkbox-container">
              <input
                type="checkbox"
                name="agreedToTerms"
                checked={formData.agreedToTerms}
                onChange={handleChange}
                id="terms-checkbox"
              />
              <span className="checkmark" />
              <span className="checkbox-text">
                I agree to the <a href="#terms" onClick={(e) => e.preventDefault()}>Terms of Service</a> and <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.
              </span>
            </label>
          </div>

          {/* Submit Button - Disabled if strict requirements are not met */}
          <button
            type="submit"
            className="btn-auth-submit"
            disabled={loading || !isFormValid}
            title={!isFormValid ? 'Please complete all required fields with a valid @gmail.com address' : 'Sign Up'}
          >
            {loading ? (
              <>
                <span className="loader-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Sign Up</span>
                <ArrowRightIcon />
              </>
            )}
          </button>
        </form>

        {/* Footer Sublink */}
        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
