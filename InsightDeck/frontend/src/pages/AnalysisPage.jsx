import React from 'react';

export default function AnalysisPage({ dataset, onNavigateToUpload }) {
  const details = dataset?.details || null;

  if (!dataset) {
    return (
      <div className="page-container empty-state-container">
        <div className="empty-state-card">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <h2>No Dataset Loaded for Analysis</h2>
          <p>Please upload an Excel workbook in the Upload section to view schema details, data quality, and sample records.</p>
          <button className="primary-btn" onClick={onNavigateToUpload}>
            Go to Upload Page
          </button>
        </div>
      </div>
    );
  }

  const columns = details?.columns || [];
  const dtypes = details?.dtypes || {};
  const missingByCol = details?.missing_values?.by_column || {};
  const sampleRows = details?.sample_rows || [];

  return (
    <div className="page-container analysis-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dataset Structure & Data Quality</h1>
          <p className="page-subtitle">
            Inspection for {dataset.filename} ({details?.row_count?.toLocaleString()} rows, {details?.column_count} columns)
          </p>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="summary-chips-row">
        <div className="summary-chip">
          <span className="chip-label">Active Sheet</span>
          <span className="chip-value">{details?.active_sheet || 'Sheet1'}</span>
        </div>
        <div className="summary-chip">
          <span className="chip-label">Completeness</span>
          <span className="chip-value success">{details?.missing_values?.completeness_percentage || 100}%</span>
        </div>
        <div className="summary-chip">
          <span className="chip-label">Duplicate Rows</span>
          <span className="chip-value">{details?.duplicate_rows || 0}</span>
        </div>
        <div className="summary-chip">
          <span className="chip-label">Total Sheets</span>
          <span className="chip-value">{details?.sheets?.length || 1}</span>
        </div>
      </div>

      {/* Columns & Data Types Table */}
      <div className="card-panel table-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Column Schema & Missing Values</h3>
            <span className="panel-subtitle">Audited data types and missing value counts</span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Column Name</th>
                <th>Inferred Type</th>
                <th>Missing Values</th>
                <th>Completeness</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col, idx) => {
                const missingCount = missingByCol[col] || 0;
                const rowCount = details?.row_count || 1;
                const colCompleteness = Math.round(((rowCount - missingCount) / rowCount) * 100);
                const colType = dtypes[col] || 'text';

                return (
                  <tr key={col}>
                    <td className="text-muted">{idx + 1}</td>
                    <td className="font-medium">{col}</td>
                    <td>
                      <span className={`type-tag tag-${colType}`}>
                        {colType}
                      </span>
                    </td>
                    <td>{missingCount.toLocaleString()}</td>
                    <td>
                      <div className="table-progress">
                        <span>{colCompleteness}%</span>
                        <div className="mini-progress-track">
                          <div 
                            className="mini-progress-fill" 
                            style={{ 
                              width: `${colCompleteness}%`,
                              background: colCompleteness === 100 ? '#10b981' : '#f59e0b'
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Sample Preview */}
      {sampleRows.length > 0 && (
        <div className="card-panel table-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Sample Data Preview</h3>
              <span className="panel-subtitle">First 5 records extracted from {details?.active_sheet || 'Sheet1'}</span>
            </div>
          </div>

          <div className="table-responsive">
            <table className="custom-table preview-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {columns.map((col) => (
                      <td key={col}>
                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : <em className="text-muted">null</em>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
