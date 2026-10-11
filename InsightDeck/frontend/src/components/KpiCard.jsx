import React from 'react';

export default function KpiCard({ title, value, change, isPositive, subtitle, icon, badgeColor }) {
  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <div className="kpi-title-group">
          <span className="kpi-title">{title}</span>
          {subtitle && <span className="kpi-subtitle">{subtitle}</span>}
        </div>
        {icon && (
          <div className={`kpi-icon-wrapper ${badgeColor || 'primary'}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="kpi-body">
        <span className="kpi-value">{value}</span>
      </div>

      {change !== undefined && (
        <div className="kpi-footer">
          <span className={`kpi-trend ${isPositive ? 'trend-up' : 'trend-neutral'}`}>
            {isPositive ? '↑ ' : '• '} {change}
          </span>
          <span className="kpi-trend-label">vs baseline</span>
        </div>
      )}
    </div>
  );
}
