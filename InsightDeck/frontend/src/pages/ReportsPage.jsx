import React, { useState, useEffect } from 'react';
import { downloadPresentationFile, getReport } from '../services/api';
import { createPresentationFromAnalysis, savePresentationToStorage } from './PresentationEditor';

export default function ReportsPage({ dataset, onNavigateToUpload, onNavigateToPresentation }) {
  const [reportData, setReportData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  // Fetch or sync report from backend on load
  useEffect(() => {
    let isMounted = true;
    const fetchLatestReport = async () => {
      try {
        setIsLoadingReport(true);
        const data = await getReport();
        if (isMounted) {
          setReportData(data);
          setErrorMessage('');
        }
      } catch (err) {
        if (dataset && isMounted) {
          const dims = dataset.details || {};
          const numSummary = dims.numeric_summary || {};
          const kpis = {};
          for (const [colName, stats] of Object.entries(numSummary)) {
            kpis[`total_${colName.toLowerCase()}`] = stats.total;
            kpis[`average_${colName.toLowerCase()}`] = stats.average;
          }
          setReportData({
            filename: dataset.filename,
            summary: {
              records: dims.row_count || 0,
              columns: dims.column_count || 0,
              missing_values: dims.missing_values?.total || 0,
              duplicates: dims.duplicate_rows || 0,
              data_quality_score: dims.data_quality?.quality_score || 100,
            },
            kpis,
            insights: (dataset.insights || []).map((i) => i.statement || i.title),
            structured_insights: dataset.insights || [],
            numeric_summary: numSummary,
          });
        }
      } finally {
        if (isMounted) setIsLoadingReport(false);
      }
    };

    fetchLatestReport();
    return () => {
      isMounted = false;
    };
  }, [dataset]);

  const handleGeneratePresentation = () => {
    if (!dataset && !reportData) {
      setErrorMessage('Please upload and analyze an Excel file first.');
      return;
    }

    const targetData = dataset || (reportData ? {
      filename: reportData.filename,
      details: {
        row_count: reportData.summary?.records,
        column_count: reportData.summary?.columns,
        missing_values: reportData.summary?.missing_values,
        duplicate_rows: reportData.summary?.duplicates,
        data_quality: { quality_score: reportData.summary?.data_quality_score },
        numeric_summary: reportData.numeric_summary,
      },
      insights: reportData.structured_insights || (reportData.insights || []).map(t => ({ title: 'Insight', statement: t })),
    } : null);

    const pres = createPresentationFromAnalysis(targetData);
    if (pres) {
      savePresentationToStorage(pres);
    }
    if (onNavigateToPresentation) {
      onNavigateToPresentation();
    }
  };

  const handleDownload = async () => {
    try {
      setErrorMessage('');
      await downloadPresentationFile();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to download PowerPoint deck.');
    }
  };

  if (!dataset && !reportData && !isLoadingReport) {
    return (
      <div className="page-container empty-state-container">
        <div className="empty-state-card">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h2>No Dataset Loaded for Report</h2>
          <p>Please upload and analyze an Excel file first to view report summaries and generate PowerPoint decks.</p>
          <button className="primary-btn" onClick={onNavigateToUpload}>
            Go to Upload Page
          </button>
        </div>
      </div>
    );
  }

  const summary = reportData?.summary || dataset?.details || {};
  const filename = reportData?.filename || dataset?.filename || 'Dataset.xlsx';
  const rawInsights = reportData?.structured_insights || dataset?.insights || [];
  const simpleInsights = reportData?.insights || rawInsights.map(i => i.statement || i.title);
  const numSummary = reportData?.numeric_summary || dataset?.details?.numeric_summary || {};

  return (
    <div className="page-container reports-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Audit Report & Summary</h1>
          <p className="page-subtitle">
            Synthesized report for <strong>{filename}</strong>. Real-time data pipeline ready for PowerPoint export.
          </p>
        </div>

        <div className="header-actions">
          <button
            className="primary-btn generate-deck-btn"
            onClick={handleGeneratePresentation}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            Generate Presentation
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="upload-alert alert-error">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* SECTION 1: Report Summary */}
      <div className="card-panel report-summary-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Report Summary</h3>
            <span className="panel-subtitle">Verified structural dimensions and hygiene for {filename}</span>
          </div>
          <span className="file-badge badge-green">Data Verified</span>
        </div>

        <div className="report-summary-grid">
          <div className="summary-stat-box">
            <span className="stat-label">Dataset File</span>
            <span className="stat-value font-mono-file" title={filename}>📄 {filename}</span>
          </div>
          <div className="summary-stat-box">
            <span className="stat-label">Total Records</span>
            <span className="stat-value highlight">{(summary.records ?? summary.row_count ?? 0).toLocaleString()}</span>
          </div>
          <div className="summary-stat-box">
            <span className="stat-label">Total Columns</span>
            <span className="stat-value">{summary.columns ?? summary.column_count ?? 0}</span>
          </div>
          <div className="summary-stat-box">
            <span className="stat-label">Missing Values</span>
            <span className="stat-value">{summary.missing_values?.total ?? summary.missing_values ?? 0}</span>
          </div>
          <div className="summary-stat-box">
            <span className="stat-label">Duplicate Rows</span>
            <span className="stat-value">{summary.duplicates ?? summary.duplicate_rows ?? 0}</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: Key Metrics (Calculated KPIs) */}
      <div className="card-panel metrics-summary-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Key Quantitative KPIs & Metric Aggregates</h3>
            <span className="panel-subtitle">Deterministic mathematical totals and averages calculated from source</span>
          </div>
        </div>

        {Object.keys(numSummary).length > 0 ? (
          <div className="kpi-breakdown-grid">
            {Object.entries(numSummary).map(([colName, stats]) => (
              <div key={colName} className="metric-kpi-card">
                <div className="metric-kpi-header">
                  <span className="metric-name">{colName}</span>
                  <span className="metric-tag">Numeric KPI</span>
                </div>
                <div className="metric-kpi-body">
                  <div className="kpi-row">
                    <span className="kpi-sublabel">Total Sum:</span>
                    <span className="kpi-main-val">{(stats.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="kpi-sub-row">
                    <span>Avg: {(stats.average ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span>Range: {(stats.min ?? 0).toLocaleString()} - {(stats.max ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted">No quantitative numeric columns identified in active dataset.</p>
        )}
      </div>

      {/* SECTION 3: Key Insights (Actual Generated Insights) */}
      <div className="card-panel report-insights-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Factual Audit Findings & Insights</h3>
            <span className="panel-subtitle">Rule-based analytical conclusions derived from {filename}</span>
          </div>
          <span className="badge-counter">{rawInsights.length || simpleInsights.length} Findings</span>
        </div>

        <div className="insights-list">
          {rawInsights.length > 0 ? (
            rawInsights.map((ins, idx) => (
              <div key={ins.id || idx} className={`insight-card insight-${ins.type || 'info'}`}>
                <div className="insight-badge">{ins.badge || ins.category || 'Audit'}</div>
                <div className="insight-content">
                  <h4 className="insight-title">{ins.title || `Finding ${idx + 1}`}</h4>
                  <p className="insight-text">{ins.statement || ins}</p>
                </div>
              </div>
            ))
          ) : (
            simpleInsights.map((stmt, idx) => (
              <div key={idx} className="insight-card insight-info">
                <div className="insight-badge">Finding {idx + 1}</div>
                <div className="insight-content">
                  <p className="insight-text">{stmt}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 4: Presentation Overview & Editor Launcher */}
      <div className="card-panel report-presentation-card">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Executive Slide Presentation</h3>
            <span className="panel-subtitle">5 auto-generated slides ready for preview, editing, and PowerPoint export</span>
          </div>
          <span className="file-badge badge-pptx">Editable Deck</span>
        </div>

        <div className="presentation-preview-content">
          <div className="slide-outline-list">
            <div className="slide-outline-item">
              <span className="slide-num">Slide 1</span>
              <div className="slide-desc">
                <strong>Executive Summary</strong>
                <span>Title, file metadata, and data quality score.</span>
              </div>
            </div>
            <div className="slide-outline-item">
              <span className="slide-num">Slide 2</span>
              <div className="slide-desc">
                <strong>Key Metrics & KPIs</strong>
                <span>Formatted table with sums, averages, and ranges.</span>
              </div>
            </div>
            <div className="slide-outline-item">
              <span className="slide-num">Slide 3</span>
              <div className="slide-desc">
                <strong>Data Overview & Quality</strong>
                <span>Records, column count, missing and duplicate counts.</span>
              </div>
            </div>
            <div className="slide-outline-item">
              <span className="slide-num">Slide 4</span>
              <div className="slide-desc">
                <strong>Segmentation Breakdown</strong>
                <span>Categorical breakdown and percentages.</span>
              </div>
            </div>
            <div className="slide-outline-item">
              <span className="slide-num">Slide 5</span>
              <div className="slide-desc">
                <strong>Key Actionable Insights</strong>
                <span>Curated audit findings and recommendations.</span>
              </div>
            </div>
          </div>

          <div className="presentation-action-footer">
            <div className="ready-action-group">
              <button
                className="primary-btn generate-deck-large-btn"
                onClick={handleGeneratePresentation}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Generate Presentation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
