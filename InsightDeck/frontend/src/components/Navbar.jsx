import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ backendStatus, onRefreshStatus, onNavigateToLogin }) {
  const { user, logout, isAuthenticated } = useAuth();

  const getStatusBadge = () => {
    if (backendStatus.status === 'healthy') {
      return (
        <div className="status-badge status-healthy" title="FastAPI Backend is connected and responsive">
          <span className="status-dot"></span>
          <span className="status-text">Backend Online</span>
        </div>
      );
    }
    if (backendStatus.status === 'checking') {
      return (
        <div className="status-badge status-checking">
          <span className="status-dot animate-pulse"></span>
          <span className="status-text">Connecting...</span>
        </div>
      );
    }
    return (
      <div 
        className="status-badge status-disconnected" 
        onClick={onRefreshStatus}
        title="Click to retry connection to http://localhost:8000"
      >
        <span className="status-dot"></span>
        <span className="status-text">Backend Offline (Retry)</span>
      </div>
    );
  };

  const getInitials = (name, email) => {
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return 'ID';
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="brand-logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
          </div>
          <div className="brand-titles">
            <span className="brand-name">InsightDeck</span>
            <span className="brand-tag">Excel Analytics & Audit</span>
          </div>
        </div>
      </div>

      <div className="header-center">
        <div className="header-search-box">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input 
            type="text" 
            placeholder="Search dataset records, metrics, or insights..." 
            aria-label="Search"
            readOnly
          />
          <span className="search-shortcut">⌘K</span>
        </div>
      </div>

      <div className="header-right">
        {getStatusBadge()}

        {isAuthenticated ? (
          <div className="user-profile-menu">
            <div className="user-avatar" title={user?.email || 'User Profile'}>
              <span>{getInitials(user?.displayName, user?.email)}</span>
            </div>
            <div className="user-meta">
              <span className="user-name">{user?.displayName || 'Lead Auditor'}</span>
              <span className="user-role">{user?.email || 'Authenticated'}</span>
            </div>
            <button
              className="navbar-logout-btn"
              onClick={logout}
              title="Sign Out of InsightDeck"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button className="navbar-login-btn" onClick={onNavigateToLogin}>
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}
