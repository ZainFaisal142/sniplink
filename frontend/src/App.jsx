/**
 * ===================================================================
 * FILE 4: /frontend/src/App.jsx
 * React Router SPA Shell with Sticky Header & Route Configuration
 * ===================================================================
 */

import React from 'react';
import { HashRouter as Router, Routes, Route, NavLink, Link } from 'react-router-dom';
import Shortener from './components/Shortener';
import Dashboard from './components/Dashboard';
import NotFound from './components/NotFound';
import Redirector from './components/Redirector';

/* ── Inline SVG Navigation Icons ───────────────────────────────── */
const BoltIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const LinkNavIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const ChartNavIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

export default function App() {
  return (
    <Router>
      <div className="app">
        {/* Sticky Premium Navigation Header */}
        <header className="nav-header">
          <nav className="nav-inner" aria-label="Main Navigation">
            {/* Brand Logo with Linear Gradient */}
            <Link to="/" className="nav-logo" aria-label="SnipLink Home">
              <BoltIcon />
              <span>SNIPLINK</span>
            </Link>

            {/* Dynamic Active Navigation Links */}
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
          </nav>
        </header>

        {/* Main Content Viewport */}
        <main className="main-content container">
          <Routes>
            {/* 1. Root Path -> Shortener Engine */}
            <Route path="/" element={<Shortener />} />

            {/* 2. Dashboard Path -> Real-Time Analytics */}
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Local Fallback Redirector Route */}
            <Route path="/r/:code" element={<Redirector />} />

            {/* 3. Catch-All Route -> Custom Branded 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        {/* Global Footer */}
        <footer className="footer">
          <div className="footer-inner">
            <p>&copy; {new Date().getFullYear()} SnipLink. High-Performance Edge URL Shortener & Analytics.</p>
            <ul className="footer-links">
              <li><NavLink to="/">Shortener</NavLink></li>
              <li><NavLink to="/dashboard">Dashboard</NavLink></li>
            </ul>
          </div>
        </footer>
      </div>
    </Router>
  );
}
