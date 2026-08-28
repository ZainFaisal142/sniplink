import { HashRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Shortener from './components/Shortener';
import Dashboard from './components/Dashboard';
import NotFound from './components/NotFound';
import Redirector from './components/Redirector';

/* ── SVG Icons ──────────────────────────────────────────── */
const LinkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const ChartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const BoltIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

export default function App() {
  return (
    <Router>
      <div className="app">
        {/* Navigation Header */}
        <header className="nav-header">
          <nav className="nav-inner">
            <NavLink to="/" className="nav-logo" aria-label="Sniplink Home">
              <BoltIcon />
              <span>Sniplink</span>
            </NavLink>
            <ul className="nav-links">
              <li>
                <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
                  <LinkIcon />
                  <span>Shortener</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
                  <ChartIcon />
                  <span>Dashboard</span>
                </NavLink>
              </li>
            </ul>
          </nav>
        </header>

        {/* Main Content */}
        <main className="main-content container">
          <Routes>
            <Route path="/" element={<Shortener />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/r/:code" element={<Redirector />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="footer">
          <div className="footer-inner">
            <p>&copy; {new Date().getFullYear()} Sniplink. High-Performance Edge URL Shortener.</p>
            <ul className="footer-links">
              <li><NavLink to="/dashboard">Dashboard</NavLink></li>
              <li><NavLink to="/">Shortener</NavLink></li>
            </ul>
          </div>
        </footer>
      </div>
    </Router>
  );
}
