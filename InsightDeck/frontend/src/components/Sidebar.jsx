import React from 'react';

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="7" height="9" x="3" y="3" rx="1" />
        <rect width="7" height="5" x="14" y="3" rx="1" />
        <rect width="7" height="9" x="14" y="12" rx="1" />
        <rect width="7" height="5" x="3" y="16" rx="1" />
      </svg>
    ),
    badge: null,
  },
  {
    id: 'upload',
    label: 'Upload & Analyze',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" x2="12" y1="3" y2="15" />
      </svg>
    ),
    badge: 'XLSX',
  },
  {
    id: 'analysis',
    label: 'Data Analysis',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20v-6M6 20V10M18 20V4" />
      </svg>
    ),
    badge: null,
  },
  {
    id: 'ask-data',
    label: 'Ask Your Data',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <line x1="9" x2="15" y1="10" y2="10" />
      </svg>
    ),
    badge: 'Bot',
  },
  {
    id: 'reports',
    label: 'Reports & Summary',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    badge: null,
  },
  {
    id: 'presentation',
    label: 'Presentation Editor',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    badge: 'Deck',
  },
];

export default function Sidebar({ activeTab, onTabChange, uploadedDataset }) {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-section">
        <span className="sidebar-section-title">CORE PLATFORM</span>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onTabChange(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.badge && (
                  <span className={`nav-badge ${item.badge === 'XLSX' || item.badge === 'Deck' ? 'badge-primary' : ''}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="dataset-status-box">
          <div className="dataset-status-header">
            <span className="status-label">ACTIVE DATASET</span>
            <span className={`status-indicator ${uploadedDataset ? 'active' : 'idle'}`}></span>
          </div>
          {uploadedDataset ? (
            <div className="active-file-info">
              <span className="active-filename" title={uploadedDataset.filename}>
                📄 {uploadedDataset.filename}
              </span>
              <span className="active-rows">
                {uploadedDataset.details?.row_count?.toLocaleString() || 0} rows loaded
              </span>
            </div>
          ) : (
            <p className="no-dataset-hint">No Excel file loaded yet. Go to Upload to start.</p>
          )}
        </div>

        <div className="version-tag">
          <span>InsightDeck v0.3.0 • Real Pipeline</span>
        </div>
      </div>
    </aside>
  );
}
