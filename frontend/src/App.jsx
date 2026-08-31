/**
 * ===================================================================
 * FILE 5: /frontend/src/App.jsx
 * React Router SPA Shell with Protected Routes & Dynamic Auth Header
 * ===================================================================
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Link, Navigate, useNavigate } from 'react-router-dom';
import Shortener from './components/Shortener';
import Dashboard from './components/Dashboard';
import Signup from './components/Signup';
import Login from './components/Login';
import PasswordReset from './components/PasswordReset';
import NotFound from './components/NotFound';
import Redirector from './components/Redirector';
import { isAuthenticated, getUser, logout } from './services/authService';

/* ── Inline SVG Navigation Icons ───────────────────────────────── */
const BoltIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const LinkNavIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const ChartNavIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const UserNavIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const LogOutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const LogInIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <polyline points="10 17 15 12 10 7" />
    <line x1="15" y1="12" x2="3" y2="12" />
  </svg>
);

/* ── Protected Route Guard Component ───────────────────────────── */
function ProtectedRoute({ children, authState }) {
  if (!authState) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(isAuthenticated());
  const [currentUser, setCurrentUser] = useState(getUser());

  const refreshAuthStatus = () => {
    const isAuth = isAuthenticated();
    setAuthed(isAuth);
    setCurrentUser(getUser());
  };

  useEffect(() => {
    refreshAuthStatus();
  }, []);

  const handleLogout = () => {
    logout();
    setAuthed(false);
    setCurrentUser(null);
    navigate('/login');
  };

  return (
    <div className="app">
      {/* Sticky Premium Navigation Header */}
      <header className="nav-header">
        <nav className="nav-inner" aria-label="Main Navigation">
          {/* Brand Logo with Linear Gradient */}
          <Link to="/" className="nav-logo" aria-label="SnipLink Home">
            <BoltIcon />
            <span>SNIPLINK</span>
          </Link>

          {/* Dynamic Active Navigation Links & Auth Controls */}
          <div className="nav-right-cluster">
            <ul className="nav-links">
              <li>
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) => (isActive ? 'active' : '')}
                >
                  <LinkNavIcon />
                  <span>Shortener</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) => (isActive ? 'active' : '')}
                >
                  <ChartNavIcon />
                  <span>Dashboard</span>
                </NavLink>
              </li>
            </ul>

            {/* Auth User State Indicator */}
            <div className="nav-auth-controls">
              {authed ? (
                <div className="nav-authenticated-block">
                  <span className="nav-user-greeting" title={currentUser?.email || ''}>
                    <UserNavIcon />
                    <span className="nav-user-name">
                      {currentUser?.name || currentUser?.email?.split('@')[0] || 'User'}
                    </span>
                  </span>
                  <button
                    onClick={handleLogout}
                    className="btn-nav-logout"
                    title="Log Out"
                    aria-label="Log Out"
                  >
                    <LogOutIcon />
                    <span>Logout</span>
                  </button>
                </div>
              ) : (
                <div className="nav-guest-block">
                  <NavLink to="/login" className="btn-nav-login">
                    <LogInIcon />
                    <span>Login</span>
                  </NavLink>
                  <NavLink to="/signup" className="btn-nav-signup">
                    <span>Sign Up</span>
                  </NavLink>
                </div>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content Viewport */}
      <main className="main-content container">
        <Routes>
          {/* 1. Public Root Path -> Shortener Engine */}
          <Route path="/" element={<Shortener />} />

          {/* 2. Protected Dashboard Path -> Requires Authentication */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute authState={authed}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* 3. Auth Routes */}
          <Route
            path="/signup"
            element={
              authed ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Signup onLoginSuccess={refreshAuthStatus} />
              )
            }
          />
          <Route
            path="/login"
            element={
              authed ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Login onLoginSuccess={refreshAuthStatus} />
              )
            }
          />
          <Route path="/reset-password" element={<PasswordReset />} />

          {/* 4. Dynamic Redirector Route */}
          <Route path="/r/:code" element={<Redirector />} />

          {/* 5. Catch-All Route -> Branded 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {/* Global Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <p>&copy; {new Date().getFullYear()} SnipLink. High-Performance Edge URL Shortener &amp; Analytics.</p>
          <ul className="footer-links">
            <li><NavLink to="/">Shortener</NavLink></li>
            <li><NavLink to="/dashboard">Dashboard</NavLink></li>
            {!authed && <li><NavLink to="/login">Login</NavLink></li>}
            {!authed && <li><NavLink to="/signup">Sign Up</NavLink></li>}
          </ul>
        </div>
      </footer>
    </div>
  );
}
