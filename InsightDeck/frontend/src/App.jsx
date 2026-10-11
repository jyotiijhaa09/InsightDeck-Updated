import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/UploadPage';
import AnalysisPage from './pages/AnalysisPage';
import AskDataPage from './pages/AskDataPage';
import ReportsPage from './pages/ReportsPage';
import PresentationEditor from './pages/PresentationEditor';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import { checkHealth } from './services/api';
import './App.css';

const getTabFromPath = () => {
  const p = window.location.pathname.replace(/^\/+/, '').toLowerCase();
  if (p === 'presentation') return 'presentation';
  if (p === 'upload') return 'upload';
  if (p === 'analysis') return 'analysis';
  if (p === 'ask-data') return 'ask-data';
  if (p === 'reports') return 'reports';
  if (p === 'login') return 'login';
  if (p === 'signup') return 'signup';
  return 'dashboard';
};

/** Protected tabs that require authentication */
const PROTECTED_TABS = ['dashboard', 'upload', 'analysis', 'ask-data', 'reports', 'presentation'];

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState(getTabFromPath);
  const [uploadedDataset, setUploadedDataset] = useState(() => {
    try {
      const stored = localStorage.getItem('insightdeck_analysis');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return null;
  });
  const [backendStatus, setBackendStatus] = useState({ status: 'checking', ok: false });

  // Sync tab with browser URL history
  const navigateTo = useCallback((tab) => {
    setActiveTab(tab);
    const targetPath = tab === 'dashboard' ? '/' : `/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ tab }, '', targetPath);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Auth-based route protection
  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated && PROTECTED_TABS.includes(activeTab)) {
      navigateTo('login');
    } else if (isAuthenticated && (activeTab === 'login' || activeTab === 'signup')) {
      navigateTo('dashboard');
    }
  }, [isAuthenticated, loading, activeTab, navigateTo]);

  const verifyBackend = useCallback(async () => {
    setBackendStatus({ status: 'checking', ok: false });
    const res = await checkHealth();
    setBackendStatus(res);
  }, []);

  useEffect(() => {
    verifyBackend();
    const interval = setInterval(verifyBackend, 15000);
    return () => clearInterval(interval);
  }, [verifyBackend]);

  const handleUploadSuccess = (data) => {
    setUploadedDataset(data);
    try {
      localStorage.setItem('insightdeck_analysis', JSON.stringify(data));
    } catch {
      // ignore
    }
    navigateTo('dashboard');
  };

  // Show a loading shimmer while auth is initializing
  if (loading) {
    return (
      <div className="insightdeck-app">
        <div className="auth-loading-screen">
          <div className="auth-loading-spinner"></div>
          <p>Initializing InsightDeck...</p>
        </div>
      </div>
    );
  }

  // Auth pages (login / signup) — rendered without sidebar/navbar
  if (!isAuthenticated) {
    if (activeTab === 'signup') {
      return (
        <SignupPage
          onNavigateToLogin={() => navigateTo('login')}
          onSignupSuccess={() => navigateTo('dashboard')}
        />
      );
    }
    return (
      <LoginPage
        onNavigateToSignup={() => navigateTo('signup')}
        onLoginSuccess={() => navigateTo('dashboard')}
      />
    );
  }

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            dataset={uploadedDataset}
            onNavigateToUpload={() => navigateTo('upload')}
            onNavigateToPresentation={() => navigateTo('presentation')}
          />
        );
      case 'upload':
        return <UploadPage onUploadSuccess={handleUploadSuccess} />;
      case 'analysis':
        return (
          <AnalysisPage
            dataset={uploadedDataset}
            onNavigateToUpload={() => navigateTo('upload')}
          />
        );
      case 'ask-data':
        return <AskDataPage dataset={uploadedDataset} onNavigateToUpload={() => navigateTo('upload')} />;
      case 'reports':
        return (
          <ReportsPage
            dataset={uploadedDataset}
            onNavigateToUpload={() => navigateTo('upload')}
            onNavigateToPresentation={() => navigateTo('presentation')}
          />
        );
      case 'presentation':
        return (
          <PresentationEditor
            dataset={uploadedDataset}
            onNavigateBack={() => navigateTo('dashboard')}
            onNavigateToUpload={() => navigateTo('upload')}
          />
        );
      default:
        return <Dashboard dataset={uploadedDataset} onNavigateToUpload={() => navigateTo('upload')} />;
    }
  };

  return (
    <div className="insightdeck-app">
      <Navbar
        backendStatus={backendStatus}
        onRefreshStatus={verifyBackend}
        onNavigateToLogin={() => navigateTo('login')}
      />
      <div className="app-main-layout">
        <Sidebar
          activeTab={activeTab}
          onTabChange={navigateTo}
          uploadedDataset={uploadedDataset}
        />
        <main className={`app-content-viewport ${activeTab === 'presentation' ? 'viewport-full' : ''}`}>
          {backendStatus.status === 'disconnected' && (
            <div className="connection-banner">
              <span className="banner-icon">⚠️</span>
              <span>
                Backend connection unavailable at <code>http://localhost:8000</code>. Please start the FastAPI backend server using <code>uvicorn main:app --reload</code>.
              </span>
              <button className="banner-retry-btn" onClick={verifyBackend}>
                Retry Now
              </button>
            </div>
          )}
          {renderActivePage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
