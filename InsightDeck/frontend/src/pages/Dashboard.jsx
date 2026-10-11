import React from 'react';
import KpiCard from '../components/KpiCard';
import { createPresentationFromAnalysis, savePresentationToStorage } from './PresentationEditor';

export default function Dashboard({ dataset, onNavigateToUpload, onNavigateToPresentation }) {
  // If a dataset has been uploaded, use its real metrics; otherwise display initial mock baseline
  const details = dataset?.details || null;
  const insights = dataset?.insights || [];

  const handleGeneratePresentation = () => {
    if (!dataset) {
      if (onNavigateToUpload) onNavigateToUpload();
      return;
    }
    const pres = createPresentationFromAnalysis(dataset);
    if (pres) {
      savePresentationToStorage(pres);
    }
    if (onNavigateToPresentation) {
      onNavigateToPresentation();
    }
  };

  // Calculate or extract values
  const totalRecords = details?.row_count !== undefined 
    ? details.row_count.toLocaleString() 
    : '24,850';

  // Look for revenue or highest numeric metric
  let totalRevenue = '$1,420,890';
  let avgValue = '$57.18';
  if (details?.numeric_summary) {
    const numKeys = Object.keys(details.numeric_summary);
    if (numKeys.length > 0) {
      const topNum = numKeys[0];
      const stats = details.numeric_summary[topNum];
      totalRevenue = `${stats.total?.toLocaleString() || '0'}`;
      avgValue = `${stats.average?.toLocaleString() || '0'}`;
    }
  }

  const dataQuality = details?.data_quality?.quality_score !== undefined
    ? `${details.data_quality.quality_score}%`
    : '98.4%';

  return (
    <div className="page-container dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Dashboard</h1>
          <p className="page-subtitle">
            {dataset 
              ? `Real-time analytics for ${dataset.filename} (${details?.row_count || 0} records processed)`
              : 'Overview of business metrics, data quality scores, and audit insights.'}
          </p>
        </div>

        <div className="header-actions">
          {dataset ? (
            <button className="primary-btn generate-pres-btn" onClick={handleGeneratePresentation}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              Generate Presentation
            </button>
          ) : (
            <button className="primary-btn" onClick={onNavigateToUpload}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" x2="12" y1="3" y2="15" />
              </svg>
              Upload Real Excel File
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="kpi-grid">
        <KpiCard
          title="Total Records"
          value={totalRecords}
          subtitle="Rows indexed"
          change="+12.4%"
          isPositive={true}
          badgeColor="primary"
          icon={
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          }
        />

        <KpiCard
          title="Total Metric Volume"
          value={totalRevenue}
          subtitle="Aggregated total"
          change="+8.2%"
          isPositive={true}
          badgeColor="emerald"
          icon={
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />

        <KpiCard
          title="Average Value"
          value={avgValue}
          subtitle="Mean per transaction"
          change="+3.1%"
          isPositive={true}
          badgeColor="amber"
          icon={
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          }
        />

        <KpiCard
          title="Data Quality"
          value={dataQuality}
          subtitle="Integrity score"
          change="Optimal"
          isPositive={true}
          badgeColor="indigo"
          icon={
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          }
        />
      </div>

      {/* Analytics Charts & Panels */}
      <div className="dashboard-grid">
        {/* Trend Area */}
        <div className="card-panel chart-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Volume & Trajectory Trend</h3>
              <span className="panel-subtitle">Chronological progression analysis</span>
            </div>
            <div className="panel-actions">
              <span className="pill-badge">Monthly</span>
              <span className="pill-badge active">Quarterly</span>
            </div>
          </div>

          <div className="chart-placeholder-box">
            <svg className="mock-chart-svg" viewBox="0 0 500 180" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path 
                d="M 0,140 Q 70,80 140,110 T 280,60 T 420,90 T 500,40 L 500,180 L 0,180 Z" 
                fill="url(#chartGradient)" 
              />
              <path 
                d="M 0,140 Q 70,80 140,110 T 280,60 T 420,90 T 500,40" 
                fill="none" 
                stroke="#6366f1" 
                strokeWidth="3" 
                strokeLinecap="round"
              />
              <circle cx="140" cy="110" r="4" fill="#6366f1" />
              <circle cx="280" cy="60" r="4" fill="#6366f1" />
              <circle cx="420" cy="90" r="4" fill="#6366f1" />
              <circle cx="500" cy="40" r="5" fill="#10b981" />
            </svg>
            <div className="chart-timeline-labels">
              <span>Q1 Jan</span>
              <span>Q1 Feb</span>
              <span>Q1 Mar</span>
              <span>Q2 Apr</span>
              <span>Q2 May</span>
              <span>Q2 Jun</span>
            </div>
          </div>
        </div>

        {/* Category Breakdown Area */}
        <div className="card-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Category / Regional Distribution</h3>
              <span className="panel-subtitle">Segmentation breakdown</span>
            </div>
          </div>

          <div className="category-bars-list">
            <div className="cat-bar-item">
              <div className="cat-bar-header">
                <span className="cat-name">Enterprise / North America</span>
                <span className="cat-val">42%</span>
              </div>
              <div className="cat-bar-track">
                <div className="cat-bar-fill" style={{ width: '42%', background: '#6366f1' }}></div>
              </div>
            </div>

            <div className="cat-bar-item">
              <div className="cat-bar-header">
                <span className="cat-name">Commercial / EMEA</span>
                <span className="cat-val">28%</span>
              </div>
              <div className="cat-bar-track">
                <div className="cat-bar-fill" style={{ width: '28%', background: '#0ea5e9' }}></div>
              </div>
            </div>

            <div className="cat-bar-item">
              <div className="cat-bar-header">
                <span className="cat-name">Mid-Market / APAC</span>
                <span className="cat-val">19%</span>
              </div>
              <div className="cat-bar-track">
                <div className="cat-bar-fill" style={{ width: '19%', background: '#10b981' }}></div>
              </div>
            </div>

            <div className="cat-bar-item">
              <div className="cat-bar-header">
                <span className="cat-name">Emerging / LATAM</span>
                <span className="cat-val">11%</span>
              </div>
              <div className="cat-bar-track">
                <div className="cat-bar-fill" style={{ width: '11%', background: '#f59e0b' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Insights Feed */}
      <div className="card-panel insights-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Data-Driven Insights Feed</h3>
            <span className="panel-subtitle">Deterministic, rule-based audit findings</span>
          </div>
          <span className="badge-counter">{insights.length || 3} Insights</span>
        </div>

        <div className="insights-list">
          {insights.length > 0 ? (
            insights.map((ins, idx) => (
              <div key={ins.id || idx} className={`insight-card insight-${ins.type || 'info'}`}>
                <div className="insight-badge">{ins.badge || ins.category}</div>
                <div className="insight-content">
                  <h4 className="insight-title">{ins.title}</h4>
                  <p className="insight-text">{ins.statement}</p>
                </div>
              </div>
            ))
          ) : (
            <>
              <div className="insight-card insight-success">
                <div className="insight-badge">100% Complete</div>
                <div className="insight-content">
                  <h4 className="insight-title">Optimal Record Quality</h4>
                  <p className="insight-text">Zero missing values detected across transaction tables. Complete schema compliance verified.</p>
                </div>
              </div>

              <div className="insight-card insight-highlight">
                <div className="insight-badge">Top Metric</div>
                <div className="insight-content">
                  <h4 className="insight-title">Highest Grossing Segment</h4>
                  <p className="insight-text">Enterprise accounts in North America generated 42% of total metric volume across the current dataset.</p>
                </div>
              </div>

              <div className="insight-card insight-info">
                <div className="insight-badge">Ready for Deck</div>
                <div className="insight-content">
                  <h4 className="insight-title">PowerPoint Presentation Prepared</h4>
                  <p className="insight-text">5 executive summary slides mapped and ready for export in the Reports tab.</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
