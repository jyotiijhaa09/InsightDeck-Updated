import React, { useState, useRef } from 'react';
import { uploadExcel } from '../services/api';

export default function UploadPage({ onUploadSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    setErrorMessage('');
    setSuccessData(null);
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setErrorMessage('Invalid file format. Please upload an Excel (.xlsx) file.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setErrorMessage('');
    setUploadProgress(20);

    try {
      const interval = setInterval(() => {
        setUploadProgress((prev) => (prev < 90 ? prev + 15 : prev));
      }, 100);

      const result = await uploadExcel(selectedFile);
      clearInterval(interval);
      setUploadProgress(100);
      setSuccessData(result);
      if (onUploadSuccess) {
        onUploadSuccess(result);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to upload and process Excel file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setErrorMessage('');
    setSuccessData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="page-container upload-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload & Validate Excel Data</h1>
          <p className="page-subtitle">
            Upload single or multi-sheet .xlsx workbooks. Original files are safely preserved read-only.
          </p>
        </div>
      </div>

      <div className="upload-layout-grid">
        {/* Dropzone & Selector */}
        <div className="card-panel dropzone-panel">
          <div
            className={`dropzone-container ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: 'none' }}
            />

            <div className="dropzone-icon">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M12 18v-6" />
                <path d="m9 15 3-3 3 3" />
              </svg>
            </div>

            <div className="dropzone-text">
              <h3>Drop your Excel (.xlsx) file here</h3>
              <p>or click to browse from your computer</p>
            </div>

            <div className="dropzone-tags">
              <span className="file-badge">Supported: .xlsx</span>
              <span className="file-badge">Max 50MB</span>
              <span className="file-badge badge-green">Read-Only Safety</span>
            </div>
          </div>

          {/* Selected File Card */}
          {selectedFile && (
            <div className="selected-file-card">
              <div className="selected-file-meta">
                <div className="file-type-icon">XLSX</div>
                <div className="file-details">
                  <span className="file-title">{selectedFile.name}</span>
                  <span className="file-size">{formatFileSize(selectedFile.size)}</span>
                </div>
              </div>

              {!isUploading && !successData && (
                <button 
                  className="remove-file-btn" 
                  onClick={handleRemoveFile}
                  title="Remove selected file"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Error Message */}
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

          {/* Progress bar */}
          {isUploading && (
            <div className="upload-progress-box">
              <div className="progress-info">
                <span>Analyzing schema, sheets & rows...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            </div>
          )}

          {/* Upload Button */}
          <div className="upload-actions">
            <button
              className="primary-btn upload-btn"
              disabled={!selectedFile || isUploading}
              onClick={handleUpload}
            >
              {isUploading ? (
                <>
                  <span className="btn-spinner"></span>
                  Processing Workbook...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                  Upload & Run Analysis
                </>
              )}
            </button>
          </div>
        </div>

        {/* Upload Summary / Results */}
        <div className="card-panel upload-info-panel">
          <h3 className="panel-title">Inspection Summary</h3>
          <span className="panel-subtitle">Extraction metadata & safety checks</span>

          {successData ? (
            <div className="upload-success-content">
              <div className="upload-alert alert-success">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{successData.message}</span>
              </div>

              <div className="metadata-list">
                <div className="meta-item">
                  <span className="meta-key">File Name</span>
                  <span className="meta-val">{successData.filename}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Total Records</span>
                  <span className="meta-val highlight">{successData.details?.row_count?.toLocaleString()}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Columns</span>
                  <span className="meta-val">{successData.details?.column_count}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Worksheets</span>
                  <span className="meta-val">{successData.details?.sheets?.join(', ')}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Missing Values</span>
                  <span className="meta-val">{successData.details?.missing_values?.total || 0}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Duplicate Rows</span>
                  <span className="meta-val">{successData.details?.duplicate_rows || 0}</span>
                </div>
              </div>

              <div className="safety-badge-box">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Source file preserved in <code>backend/uploads/</code> unmodified.</span>
              </div>
            </div>
          ) : (
            <div className="upload-instructions">
              <div className="instruction-step">
                <span className="step-num">1</span>
                <div>
                  <h4>Zero Modification Guarantee</h4>
                  <p>Original files are stored in a dedicated uploads archive without altering source cells.</p>
                </div>
              </div>
              <div className="instruction-step">
                <span className="step-num">2</span>
                <div>
                  <h4>Automated Schema & Quality Auditing</h4>
                  <p>Instantly calculates row counts, data completeness, duplicate records, and metrics.</p>
                </div>
              </div>
              <div className="instruction-step">
                <span className="step-num">3</span>
                <div>
                  <h4>Ready for Presentations & AI Q&A</h4>
                  <p>Analysis feeds directly into the Dashboard, Ask Data chatbot, and PowerPoint exporter.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
