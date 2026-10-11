import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../services/api';

const STORAGE_KEY = 'insightdeck_presentation';

/**
 * Deterministically chooses the best visual chart based on dataset analysis.
 * Mirroring the backend python choose_best_chart function.
 */
export function choose_best_chart(dataset) {
  if (!dataset) {
    return {
      chart_type: 'column',
      title: 'Dataset Metrics',
      column_name: 'Dataset',
      categories: ['Records', 'Columns'],
      series: [{ name: 'Count', values: [0, 0] }],
      insight: 'No analysis data available.',
    };
  }

  const details = dataset.details || dataset.summary || {};
  const rowCount = details.row_count ?? details.records ?? 0;
  const colCount = details.column_count ?? details.columns ?? 0;
  const catSummary = details.categorical_summary || {};
  const numSummary = details.numeric_summary || {};

  // 1. Categorical distribution (prioritize business dimensions over IDs)
  let bestCatCol = null;
  let bestTopVals = null;

  for (const [colName, data] of Object.entries(catSummary)) {
    const cLower = colName.toLowerCase();
    if (cLower.endsWith('id') || ['id', 'index', 'key', 'uuid', 'code'].includes(cLower)) {
      continue;
    }
    const uniqueCount = data.unique_count || 0;
    if (uniqueCount >= rowCount && rowCount > 3) {
      continue;
    }
    const topVals = data.top_values || {};
    const count = Object.keys(topVals).length;
    if (count >= 2 && count <= 7) {
      bestCatCol = colName;
      bestTopVals = topVals;
      break;
    }
  }

  if (!bestCatCol && Object.keys(catSummary).length > 0) {
    for (const [colName, data] of Object.entries(catSummary)) {
      const cLower = colName.toLowerCase();
      if (!cLower.endsWith('id') && !['id', 'index'].includes(cLower)) {
        bestCatCol = colName;
        bestTopVals = data.top_values || {};
        break;
      }
    }
    if (!bestCatCol) {
      const firstCol = Object.keys(catSummary)[0];
      bestCatCol = firstCol;
      bestTopVals = catSummary[firstCol].top_values || {};
    }
  }

  if (bestCatCol && bestTopVals && Object.keys(bestTopVals).length > 0) {
    const categories = Object.keys(bestTopVals);
    const values = Object.values(bestTopVals).map(Number);
    const topCat = categories[0];
    const topVal = values[0];
    const pct = ((topVal / Math.max(1, rowCount)) * 100).toFixed(1);
    const chartType = categories.length <= 4 ? 'doughnut' : 'bar';

    return {
      chart_type: chartType,
      title: `Distribution by ${bestCatCol}`,
      column_name: bestCatCol,
      categories,
      series: [{ name: 'Record Count', values }],
      insight: `Top segment '${topCat}' comprises ${topVal.toLocaleString()} records (${pct}% of observed data).`,
    };
  }

  // 2. Multiple numeric columns -> Comparison Column Chart
  const numEntries = Object.entries(numSummary);
  if (numEntries.length >= 2) {
    const topNums = numEntries.slice(0, 5);
    const categories = topNums.map(([k]) => k);
    const totals = topNums.map(([, v]) => Number(v.total || 0));
    const maxTot = Math.max(...totals, 1);
    const minTot = Math.min(...totals, 1);
    const useAvg = maxTot / Math.max(1, minTot) > 1000;
    const seriesName = useAvg ? 'Average' : 'Total Sum';
    const values = useAvg
      ? topNums.map(([, v]) => Number(v.average || 0))
      : totals;

    return {
      chart_type: 'column',
      title: `Cross-Metric Comparison (${seriesName})`,
      column_name: 'Metrics',
      categories,
      series: [{ name: seriesName, values }],
      insight: `Aggregated ${seriesName.toLowerCase()} computed across ${categories.length} quantitative metrics.`,
    };
  }

  // 3. Single numeric column
  if (numEntries.length === 1) {
    const [colName, stats] = numEntries[0];
    const categories = ['Min', 'Average', 'Max'];
    const values = [Number(stats.min || 0), Number(stats.average || 0), Number(stats.max || 0)];
    return {
      chart_type: 'column',
      title: `Range Distribution: ${colName}`,
      column_name: colName,
      categories,
      series: [{ name: colName, values }],
      insight: `Metric '${colName}' spans from ${values[0].toLocaleString()} to ${values[2].toLocaleString()} with mean ${values[1].toLocaleString()}.`,
    };
  }

  // 4. Fallback
  return {
    chart_type: 'column',
    title: 'Dataset Volume Metrics',
    column_name: 'Dataset',
    categories: ['Row Records', 'Columns', 'Quality Score'],
    series: [{ name: 'Volume', values: [rowCount, colCount, details.data_quality_score ?? 100] }],
    insight: `Dataset contains ${rowCount.toLocaleString()} records verified with automated validation.`,
  };
}

/**
 * Creates the full 8-slide executive presentation JSON model from real analysis data.
 * Adheres strictly to the executive consulting palette and structure.
 */
export function createPresentationFromAnalysis(dataset) {
  if (!dataset) return null;

  const details = dataset.details || dataset.summary || {};
  const insights = dataset.insights || dataset.structured_insights || [];
  const filename = dataset.filename || 'Dataset.xlsx';
  const rowCount = details.row_count ?? details.records ?? 0;
  const colCount = details.column_count ?? details.columns ?? 0;
  const numSummary = details.numeric_summary || {};
  const catSummary = details.categorical_summary || {};
  const missingValRaw = details.missing_values ?? 0;
  const missingTotal = typeof missingValRaw === 'object' ? (missingValRaw.total ?? 0) : Number(missingValRaw);
  const duplicateRows = details.duplicate_rows ?? details.duplicates ?? 0;
  const qualityScore = details.data_quality?.quality_score ?? details.data_quality_score ?? 100;
  const missingByCol = details.data_quality?.missing_by_column || details.missing_by_column || {};
  const attnCount = Object.keys(missingByCol).length > 0 ? Object.keys(missingByCol).length : (missingTotal > 0 ? 1 : 0);

  const chartInfo = choose_best_chart(dataset);
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Top factual takeaway
  let topInsight = 'All dataset records and dimensions verified with deterministic zero-hallucination calculations.';
  if (insights.length > 0) {
    const first = insights[0];
    topInsight = typeof first === 'string' ? first : (first.statement || first.text || topInsight);
  }

  const slides = [];

  // ==================== SLIDE 1: COVER ====================
  slides.push({
    id: 'slide-1',
    type: 'cover',
    title: 'INSIGHTDECK',
    subtitle: 'Excel Intelligence & Audit Analytics',
    dataset_name: filename,
    date_str: dateStr,
    bullets: [
      `Dataset: ${filename}`,
      `Scope: ${rowCount.toLocaleString()} Records · ${colCount} Attributes`,
      `Integrity Score: ${qualityScore}% Verified`,
      'Executive Audit & Intelligence Report',
    ],
    content: [
      `Dataset: ${filename}`,
      `Scope: ${rowCount.toLocaleString()} Records · ${colCount} Attributes`,
      `Integrity Score: ${qualityScore}% Verified`,
      'Executive Audit & Intelligence Report',
    ],
  });

  // ==================== SLIDE 2: EXECUTIVE SUMMARY ====================
  const s2Cards = [
    { label: 'TOTAL RECORDS', value: rowCount.toLocaleString(), sub: 'Processed Rows' },
    { label: 'COLUMNS', value: String(colCount), sub: 'Features Analyzed' },
    { label: 'DUPLICATES', value: duplicateRows.toLocaleString(), sub: 'Exact Matches' },
    { label: 'DATA QUALITY', value: `${qualityScore}%`, sub: 'Integrity Rating' },
  ];
  const s2Bullets = [
    `Total Records: ${rowCount.toLocaleString()} verified rows across ${colCount} features.`,
    `Data Quality Score: ${qualityScore}% compliance.`,
    `Identified ${duplicateRows.toLocaleString()} duplicate row(s) and ${missingTotal.toLocaleString()} missing cell(s).`,
    `Key Takeaway: ${topInsight}`,
  ];
  slides.push({
    id: 'slide-2',
    type: 'executive_summary',
    title: 'Executive Summary',
    subtitle: `High-level audit metrics and critical data synthesis for ${filename}`,
    cards: s2Cards,
    takeaway: topInsight,
    bullets: s2Bullets,
    content: s2Bullets,
  });

  // ==================== SLIDE 3: DATA OVERVIEW ====================
  const s3Cards = [
    { label: 'TOTAL ROWS', value: rowCount.toLocaleString(), sub: 'Workbook volume' },
    { label: 'TOTAL COLUMNS', value: String(colCount), sub: 'Attribute count' },
    { label: 'NUMERIC COLUMNS', value: String(Object.keys(numSummary).length), sub: 'Quantitative metrics' },
    { label: 'CATEGORICAL COLS', value: String(Object.keys(catSummary).length), sub: 'Qualitative dimensions' },
    { label: 'MISSING CELLS', value: missingTotal.toLocaleString(), sub: 'Empty observations' },
    { label: 'DUPLICATE ROWS', value: duplicateRows.toLocaleString(), sub: 'Redundant entries' },
  ];
  const s3Bullets = [
    `Dataset Dimension: ${rowCount.toLocaleString()} rows by ${colCount} columns.`,
    `Quantitative metrics: ${Object.keys(numSummary).length} numeric columns indexed.`,
    `Categorical features: ${Object.keys(catSummary).length} distinct qualitative columns.`,
    `Data hygiene: ${missingTotal.toLocaleString()} missing values (${qualityScore}% completeness).`,
    `Duplicate detection: ${duplicateRows.toLocaleString()} exact duplicate rows identified.`,
  ];
  slides.push({
    id: 'slide-3',
    type: 'data_overview',
    title: 'Dataset Architecture & Overview',
    subtitle: 'Structural composition, schema dimensions, and hygiene metrics',
    cards: s3Cards,
    bullets: s3Bullets,
    content: s3Bullets,
  });

  // ==================== SLIDE 4: KEY METRICS / DISTRIBUTION (WITH CHART) ====================
  const s4Bullets = [
    `Analyzed Dimension: ${chartInfo.title}`,
    chartInfo.insight,
    `Sample Scope: Computed across ${rowCount.toLocaleString()} source records.`,
    'Deterministic mathematical aggregation without sampling error.',
  ];
  slides.push({
    id: 'slide-4',
    type: 'chart',
    title: `Key Metrics: ${chartInfo.title}`,
    subtitle: `Deterministic distribution calculated from ${filename}`,
    chart: chartInfo,
    takeaway: chartInfo.insight,
    bullets: s4Bullets,
    content: s4Bullets,
  });

  // ==================== SLIDE 5: DATA QUALITY ====================
  const s5Bullets = [
    `Overall Data Quality Compliance: ${qualityScore}%`,
    `Missing Values: ${missingTotal.toLocaleString()} cell(s) requiring remediation`,
    `Duplicate Rows: ${duplicateRows.toLocaleString()} redundant record(s)`,
    `Columns Requiring Attention: ${attnCount} feature(s)`,
    `Integrity Status: ${qualityScore >= 90 ? 'Excellent Compliance' : 'Requires Audit Hygiene Intervention'}`,
  ];
  slides.push({
    id: 'slide-5',
    type: 'data_quality',
    title: 'Data Quality & Integrity Assessment',
    subtitle: 'Completeness scoring, anomaly detection, and hygiene audit',
    quality_score: qualityScore,
    missing_count: missingTotal,
    duplicate_count: duplicateRows,
    attention_columns_count: attnCount,
    missing_by_column: missingByCol,
    bullets: s5Bullets,
    content: s5Bullets,
  });

  // ==================== SLIDE 6: KEY INSIGHTS ====================
  const insightCards = [];
  if (insights.length > 0) {
    insights.slice(0, 4).forEach((ins, idx) => {
      const title = typeof ins === 'string' ? `INSIGHT 0${idx + 1}` : (ins.title || `INSIGHT 0${idx + 1}`);
      const stmt = typeof ins === 'string' ? ins : (ins.statement || ins.text || '');
      insightCards.push({
        number: `0${idx + 1}`,
        category: title.toUpperCase(),
        statement: stmt,
      });
    });
  }
  if (insightCards.length === 0) {
    insightCards.push(
      { number: '01', category: 'VOLUME & SCOPE', statement: `Dataset contains ${rowCount.toLocaleString()} verified records across ${colCount} structural features.` },
      { number: '02', category: 'DATA QUALITY', statement: `Data quality compliance is evaluated at ${qualityScore}% across all cell values.` },
      { number: '03', category: 'SEGMENTATION', statement: chartInfo.insight },
      { number: '04', category: 'ACCURACY', statement: 'Zero hallucinations: All statistics derived from deterministic formulas.' }
    );
  }
  const s6Bullets = insightCards.map((c) => `${c.number} ${c.category}: ${c.statement}`);
  slides.push({
    id: 'slide-6',
    type: 'insights',
    title: 'Key Strategic Insights',
    subtitle: 'Verified empirical observations calculated directly from raw data',
    insight_cards: insightCards,
    bullets: s6Bullets,
    content: s6Bullets,
  });

  // ==================== SLIDE 7: RECOMMENDATIONS ====================
  const recCards = [
    {
      number: '01',
      title: 'Improve Data Completeness',
      text: missingTotal > 0
        ? `Remediate ${missingTotal.toLocaleString()} missing observations across dataset columns to raise quality rating above 98%.`
        : 'Maintain current schema validation standards; zero missing cell intervention required.',
    },
    {
      number: '02',
      title: 'Review Duplicate Records',
      text: duplicateRows > 0
        ? `Remove ${duplicateRows.toLocaleString()} identified redundant rows to prevent analytical double-counting.`
        : 'Continue automated duplicate prevention at data ingestion points.',
    },
    {
      number: '03',
      title: 'Investigate Value Distributions',
      text: `Audit outliers and variance in key metric '${chartInfo.column_name}' to ensure business alignment.`,
    },
    {
      number: '04',
      title: 'Establish Automated Monitoring',
      text: 'Schedule recurring InsightDeck audit runs to detect data drift and maintain audit trail compliance.',
    },
  ];
  const s7Bullets = recCards.map((r) => `${r.number} ${r.title}: ${r.text}`);
  slides.push({
    id: 'slide-7',
    type: 'recommendations',
    title: 'Actionable Recommendations',
    subtitle: 'Targeted remediation steps and operational guidance based on findings',
    recommendation_cards: recCards,
    bullets: s7Bullets,
    content: s7Bullets,
  });

  // ==================== SLIDE 8: CLOSING ====================
  const s8Bullets = [
    'INSIGHTDECK Analytics Platform',
    'Data → Insights → Decisions',
    `Dataset: ${filename}`,
    'Audit & Analysis Complete · Thank You',
  ];
  slides.push({
    id: 'slide-8',
    type: 'closing',
    title: 'INSIGHTDECK',
    subtitle: 'Data → Insights → Decisions',
    dataset_name: filename,
    date_str: dateStr,
    bullets: s8Bullets,
    content: s8Bullets,
  });

  return {
    title: `InsightDeck — ${filename}`,
    filename,
    slides,
  };
}

export function savePresentationToStorage(presentation) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presentation));
  } catch (e) {
    console.warn('Failed to save presentation to localStorage:', e);
  }
}

export function loadPresentationFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load presentation from localStorage:', e);
  }
  return null;
}

/**
 * Clean SVG Chart Component for Live Slide Preview (Slide 4)
 */
function VisualSlideChart({ chart }) {
  if (!chart || !chart.categories || chart.categories.length === 0) {
    return <div className="pres-chart-fallback">Chart data unavailable.</div>;
  }

  const { chart_type, categories, series = [] } = chart;
  const values = series[0]?.values || [];
  const maxVal = Math.max(...values, 1);
  const colors = ['#274C77', '#6096BA', '#A3CEF1', '#4F8A68', '#D49A3A', '#8B5CF6'];

  if (chart_type === 'doughnut') {
    const total = values.reduce((a, b) => a + b, 0) || 1;
    let accumulatedAngle = 0;
    const slices = values.map((val, idx) => {
      const percentage = val / total;
      const angle = percentage * 360;
      const startAngle = accumulatedAngle;
      accumulatedAngle += angle;
      return {
        val,
        cat: categories[idx],
        percentage: (percentage * 100).toFixed(1),
        startAngle,
        angle,
        color: colors[idx % colors.length],
      };
    });

    return (
      <div className="pres-preview-chart-wrapper pres-doughnut-wrap">
        <svg viewBox="0 0 240 240" className="pres-svg-chart">
          {slices.map((slice, idx) => {
            const r = 80;
            const cx = 120;
            const cy = 120;
            const startRad = ((slice.startAngle - 90) * Math.PI) / 180;
            const endRad = (((slice.startAngle + slice.angle - 0.5) - 90) * Math.PI) / 180;
            const x1 = cx + r * Math.cos(startRad);
            const y1 = cy + r * Math.sin(startRad);
            const x2 = cx + r * Math.cos(endRad);
            const y2 = cy + r * Math.sin(endRad);
            const largeArc = slice.angle > 180 ? 1 : 0;
            const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

            return <path key={idx} d={d} fill={slice.color} stroke="#FFFFFF" strokeWidth="2" />;
          })}
          {/* Inner cutout for doughnut hole */}
          <circle cx="120" cy="120" r="48" fill="#FFFFFF" />
          <text x="120" y="116" textAnchor="middle" fill="#64748B" fontSize="10" fontWeight="600">
            TOTAL
          </text>
          <text x="120" y="132" textAnchor="middle" fill="#172033" fontSize="12" fontWeight="700">
            {total.toLocaleString()}
          </text>
        </svg>

        <div className="pres-doughnut-legend">
          {slices.map((s, idx) => (
            <div key={idx} className="pres-legend-item">
              <span className="pres-legend-color" style={{ background: s.color }}></span>
              <span className="pres-legend-label">{s.cat}</span>
              <span className="pres-legend-pct">{s.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (chart_type === 'bar') {
    // Horizontal Bar Chart
    return (
      <div className="pres-preview-chart-wrapper pres-bar-chart">
        {categories.map((cat, idx) => {
          const val = values[idx] || 0;
          const pct = Math.max(8, (val / maxVal) * 100);
          return (
            <div key={idx} className="pres-bar-row">
              <span className="pres-bar-label" title={cat}>
                {cat}
              </span>
              <div className="pres-bar-track">
                <div
                  className="pres-bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: idx === 0 ? '#274C77' : '#6096BA',
                  }}
                >
                  <span className="pres-bar-val-text">{val.toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Vertical Column Chart
  return (
    <div className="pres-preview-chart-wrapper pres-col-chart">
      <div className="pres-cols-container">
        {categories.map((cat, idx) => {
          const val = values[idx] || 0;
          const heightPct = Math.max(10, (val / maxVal) * 100);
          return (
            <div key={idx} className="pres-col-item">
              <span className="pres-col-val">{val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toLocaleString()}</span>
              <div className="pres-col-pillar-track">
                <div
                  className="pres-col-pillar-fill"
                  style={{
                    height: `${heightPct}%`,
                    background: idx % 2 === 0 ? '#274C77' : '#6096BA',
                  }}
                ></div>
              </div>
              <span className="pres-col-label" title={cat}>
                {cat}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PresentationEditor({ dataset, onNavigateBack, onNavigateToUpload }) {
  const [presentation, setPresentation] = useState(null);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Form state for Right Sidebar
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editContent, setEditContent] = useState('');

  // 1. Load Presentation
  useEffect(() => {
    // 1. From dataset state if available and has 8 slides or matching structure
    if (dataset?.presentation?.slides?.length >= 5) {
      setPresentation(dataset.presentation);
      savePresentationToStorage(dataset.presentation);
      return;
    }

    // 2. From localStorage
    const stored = loadPresentationFromStorage();
    if (stored && stored.slides?.length > 0) {
      setPresentation(stored);
      return;
    }

    // 3. Generate from available dataset
    if (dataset) {
      const generated = createPresentationFromAnalysis(dataset);
      if (generated) {
        setPresentation(generated);
        savePresentationToStorage(generated);
        return;
      }
    }

    setPresentation(null);
  }, [dataset]);

  const slides = presentation?.slides || [];
  const currentSlide = slides[selectedSlideIndex] || null;

  // Sync right-side form whenever selected slide changes
  useEffect(() => {
    if (currentSlide) {
      setEditTitle(currentSlide.title || '');
      setEditSubtitle(currentSlide.subtitle || '');
      const bullets = currentSlide.bullets || currentSlide.content || [];
      setEditContent(Array.isArray(bullets) ? bullets.join('\n') : String(bullets));
    } else {
      setEditTitle('');
      setEditSubtitle('');
      setEditContent('');
    }
  }, [selectedSlideIndex, currentSlide]);

  // Apply Changes
  const handleApplyChanges = () => {
    if (!presentation || !currentSlide) return;

    const bulletList = editContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const updatedSlides = [...slides];
    updatedSlides[selectedSlideIndex] = {
      ...currentSlide,
      title: editTitle,
      subtitle: editSubtitle,
      bullets: bulletList,
      content: bulletList,
    };

    const updatedPresentation = {
      ...presentation,
      slides: updatedSlides,
    };

    setPresentation(updatedPresentation);
    savePresentationToStorage(updatedPresentation);
    setHasUnsavedChanges(false);
    setStatusMessage({ type: 'success', text: 'Slide changes applied and saved.' });
    setTimeout(() => setStatusMessage({ type: '', text: '' }), 2500);
  };

  // Add Slide
  const handleAddSlide = () => {
    if (!presentation) return;

    const newSlideId = `slide-${Date.now()}`;
    const newSlide = {
      id: newSlideId,
      type: 'custom',
      title: 'New Executive Slide',
      subtitle: 'Additional strategic considerations',
      bullets: [
        'Strategic finding or data observation',
        'Action item or implementation detail',
        'Responsible team or verification timeline',
      ],
      content: [
        'Strategic finding or data observation',
        'Action item or implementation detail',
        'Responsible team or verification timeline',
      ],
    };

    const updatedSlides = [...slides, newSlide];
    const updated = { ...presentation, slides: updatedSlides };
    setPresentation(updated);
    savePresentationToStorage(updated);
    setSelectedSlideIndex(updatedSlides.length - 1);
    setStatusMessage({ type: 'success', text: `Slide ${updatedSlides.length} added.` });
    setTimeout(() => setStatusMessage({ type: '', text: '' }), 2000);
  };

  // Delete Slide
  const handleDeleteSlide = (indexToDelete) => {
    if (!presentation || slides.length <= 1) return;

    const updatedSlides = slides.filter((_, idx) => idx !== indexToDelete);
    const updated = { ...presentation, slides: updatedSlides };
    setPresentation(updated);
    savePresentationToStorage(updated);

    const nextIdx = Math.min(selectedSlideIndex, updatedSlides.length - 1);
    setSelectedSlideIndex(nextIdx);
    setStatusMessage({ type: 'info', text: 'Slide removed.' });
    setTimeout(() => setStatusMessage({ type: '', text: '' }), 2000);
  };

  // Reorder Slides
  const handleMoveSlide = (direction) => {
    const targetIdx = selectedSlideIndex + direction;
    if (targetIdx < 0 || targetIdx >= slides.length) return;

    const updatedSlides = [...slides];
    const [moved] = updatedSlides.splice(selectedSlideIndex, 1);
    updatedSlides.splice(targetIdx, 0, moved);

    const updated = { ...presentation, slides: updatedSlides };
    setPresentation(updated);
    savePresentationToStorage(updated);
    setSelectedSlideIndex(targetIdx);
  };

  // Manual Save button
  const handleSave = () => {
    if (!presentation) return;
    if (currentSlide) {
      const bulletList = editContent
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const updatedSlides = [...slides];
      updatedSlides[selectedSlideIndex] = {
        ...currentSlide,
        title: editTitle,
        subtitle: editSubtitle,
        bullets: bulletList,
        content: bulletList,
      };
      const updated = { ...presentation, slides: updatedSlides };
      setPresentation(updated);
      savePresentationToStorage(updated);
    } else {
      savePresentationToStorage(presentation);
    }
    setHasUnsavedChanges(false);
    setStatusMessage({ type: 'success', text: 'Presentation saved successfully.' });
    setTimeout(() => setStatusMessage({ type: '', text: '' }), 3000);
  };

  // Download PPTX with robust validation and debug logging
  const handleDownloadPptx = async () => {
    if (!presentation) return;
    setIsDownloading(true);
    setStatusMessage({ type: 'info', text: 'Generating PowerPoint presentation...' });

    try {
      console.log('Generating PowerPoint...');

      // Merge current form changes before sending
      const bulletList = editContent
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const currentSlides = [...slides];
      if (currentSlide) {
        currentSlides[selectedSlideIndex] = {
          ...currentSlide,
          title: editTitle,
          subtitle: editSubtitle,
          bullets: bulletList,
          content: bulletList,
        };
      }

      const presentationToSend = {
        ...presentation,
        slides: currentSlides,
      };

      savePresentationToStorage(presentationToSend);

      const response = await fetch(`${API_BASE_URL}/generate-presentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presentationToSend),
      });

      console.log('Response status:', response.status);
      console.log('Response content type:', response.headers.get('content-type'));

      if (!response.ok || response.status !== 200) {
        let errMsg = `PowerPoint generation failed (HTTP ${response.status})`;
        try {
          const errData = await response.json();
          errMsg = errData.detail || errMsg;
        } catch { /* ignore */ }
        throw new Error(errMsg);
      }

      const contentType = response.headers.get('content-type') || '';
      let blob;

      if (contentType.includes('application/json')) {
        const data = await response.json();
        const downloadUrl = data.download_url
          ? `${API_BASE_URL}${data.download_url}`
          : `${API_BASE_URL}/presentation/download`;
        const fileResponse = await fetch(downloadUrl);
        if (!fileResponse.ok || fileResponse.status !== 200) {
          throw new Error('PowerPoint generation failed. Please try again.');
        }
        blob = await fileResponse.blob();
      } else {
        blob = await response.blob();
      }

      console.log('Blob size:', blob.size);

      if (!blob || blob.size === 0) {
        throw new Error('Generated presentation is empty (0 bytes).');
      }

      // Trigger standard browser download
      const pBlob = new Blob([blob], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      const url = window.URL.createObjectURL(pBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'InsightDeck_Presentation.pptx';
      link.setAttribute('download', 'InsightDeck_Presentation.pptx');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Asynchronous revoke after 1 second to ensure complete download transfer
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);

      setStatusMessage({ type: 'success', text: 'PowerPoint downloaded successfully!' });
      setTimeout(() => setStatusMessage({ type: '', text: '' }), 4000);
    } catch (err) {
      console.error('Download PowerPoint error:', err);
      setStatusMessage({
        type: 'error',
        text: 'PowerPoint generation failed. Please try again.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Empty State
  if (!presentation || slides.length === 0) {
    return (
      <div className="page-container empty-state-container">
        <div className="empty-state-card">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect width="18" height="14" x="3" y="5" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
          </div>
          <h2>No Presentation Available</h2>
          <p>Please upload an Excel file and click "Generate Presentation" to create your executive slide deck.</p>
          <button className="primary-btn" onClick={onNavigateToUpload}>
            Upload Excel File
          </button>
        </div>
      </div>
    );
  }

  const activeBullets = currentSlide.bullets || currentSlide.content || [];
  const slideType = currentSlide.type || 'custom';

  return (
    <div className="pres-editor-root">
      {/* ================= TOP BAR ================= */}
      <header className="pres-topbar">
        <div className="pres-topbar-left">
          <button className="pres-back-btn" onClick={onNavigateBack} title="Back to Dashboard">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span>Back</span>
          </button>
          <div className="pres-title-block">
            <h2 className="pres-topbar-heading">Executive Presentation Editor</h2>
            <span className="pres-topbar-filename">📄 {presentation.filename || 'Dataset.xlsx'}</span>
          </div>
        </div>

        <div className="pres-topbar-right">
          {hasUnsavedChanges && (
            <span className="pres-unsaved-badge">● Unsaved edits</span>
          )}
          <button className="pres-btn pres-btn-secondary" onClick={handleSave}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Save
          </button>
          <button
            className="pres-btn pres-btn-primary"
            onClick={handleDownloadPptx}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <span className="btn-spinner"></span>
                Generating...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PowerPoint
              </>
            )}
          </button>
        </div>
      </header>

      {/* Banner Notifications */}
      {statusMessage.text && (
        <div className={`pres-banner pres-banner-${statusMessage.type}`}>
          <span>{statusMessage.text}</span>
          <button className="pres-banner-close" onClick={() => setStatusMessage({ type: '', text: '' })}>✕</button>
        </div>
      )}

      {/* ================= 3-COLUMN WORKSPACE ================= */}
      <div className="pres-workspace">
        {/* ----- LEFT SIDEBAR: SLIDES ----- */}
        <aside className="pres-sidebar-left">
          <div className="pres-sidebar-header">
            <span className="pres-sidebar-title">SLIDES</span>
            <span className="pres-slide-counter">{slides.length}</span>
          </div>

          <div className="pres-thumb-list">
            {slides.map((s, idx) => {
              const isActive = idx === selectedSlideIndex;
              const bullets = s.bullets || s.content || [];
              const typeLabel = {
                cover: 'Cover',
                executive_summary: 'KPI Summary',
                data_overview: 'Overview',
                chart: 'Chart',
                data_quality: 'Quality',
                insights: 'Insights',
                recommendations: 'Actions',
                closing: 'Closing',
              }[s.type] || `Slide ${idx + 1}`;

              return (
                <div
                  key={s.id || idx}
                  className={`pres-thumb-card ${isActive ? 'pres-thumb-active' : ''}`}
                  onClick={() => setSelectedSlideIndex(idx)}
                >
                  <div className="pres-thumb-header">
                    <span className="pres-thumb-badge">Slide {idx + 1}</span>
                    <span className="pres-thumb-type-tag">{typeLabel}</span>
                  </div>
                  <div className="pres-thumb-canvas-mini">
                    <div className="pres-thumb-mini-title">{s.title || `Slide ${idx + 1}`}</div>
                    <div className="pres-thumb-mini-bullets">
                      {bullets.slice(0, 2).map((b, bIdx) => (
                        <div key={bIdx} className="pres-thumb-bullet-line">
                          • {b}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pres-sidebar-footer">
            <button className="pres-add-btn" onClick={handleAddSlide}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              + Add Slide
            </button>
          </div>
        </aside>

        {/* ----- CENTER: PRESENTATION CANVAS (EXECUTIVE STYLING) ----- */}
        <main className="pres-canvas-area">
          <div className="pres-canvas-viewport">
            <div className="pres-slide-frame" id="presentation-slide-view">
              <div className="pres-slide-inner pres-executive-canvas">
                {/* 1. COVER SLIDE LAYOUT */}
                {slideType === 'cover' ? (
                  <div className="pres-layout-cover">
                    <div className="pres-cover-header-stripe"></div>
                    <div className="pres-cover-card">
                      <div className="pres-cover-pill">INSIGHTDECK</div>
                      <span className="pres-cover-tagline">EXCEL INTELLIGENCE & AUDIT ANALYTICS</span>
                      <h1 className="pres-cover-title">{currentSlide.title === 'INSIGHTDECK' ? (presentation.filename || 'Dataset Analysis') : currentSlide.title}</h1>
                      <p className="pres-cover-subtitle">{currentSlide.subtitle || 'Executive Audit & Analysis Report'}</p>
                      <div className="pres-cover-divider"></div>
                      <div className="pres-cover-meta">
                        <span>Dataset: {presentation.filename || 'Dataset.xlsx'}</span>
                        <span>•</span>
                        <span>{currentSlide.date_str || new Date().toLocaleDateString()}</span>
                        <span>•</span>
                        <span>Deterministic Factual Analytics</span>
                      </div>
                      {activeBullets.length > 0 && activeBullets[0] !== `Dataset: ${presentation.filename}` && (
                        <div className="pres-cover-highlights">
                          {activeBullets.slice(0, 3).map((b, i) => (
                            <span key={i} className="pres-cover-chip">{b}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* STANDARD SLIDE HEADER */}
                    <div className="pres-slide-header-executive">
                      <div className="pres-header-top-row">
                        <span className="pres-brand-badge-pill">INSIGHTDECK</span>
                        <span className="pres-header-counter">Slide {selectedSlideIndex + 1} of {slides.length}</span>
                      </div>
                      <h1 className="pres-slide-title-exec">{currentSlide.title || 'Slide Title'}</h1>
                      {currentSlide.subtitle && (
                        <p className="pres-slide-subtitle-exec">{currentSlide.subtitle}</p>
                      )}
                      <div className="pres-header-rule"></div>
                    </div>

                    {/* SLIDE CONTENT AREA (BY TYPE) */}
                    <div className="pres-slide-body-executive">
                      {/* 2. EXECUTIVE SUMMARY */}
                      {slideType === 'executive_summary' && (
                        <div className="pres-exec-summary-layout">
                          <div className="pres-kpi-grid-4">
                            {(currentSlide.cards || []).slice(0, 4).map((c, i) => (
                              <div key={i} className={`pres-kpi-card pres-kpi-card-${i}`}>
                                <div className="pres-kpi-card-stripe"></div>
                                <span className="pres-kpi-label">{c.label}</span>
                                <span className="pres-kpi-val">{c.value}</span>
                                <span className="pres-kpi-sub">{c.sub}</span>
                              </div>
                            ))}
                          </div>
                          <div className="pres-takeaway-card">
                            <div className="pres-takeaway-stripe"></div>
                            <div className="pres-takeaway-content">
                              <span className="pres-takeaway-badge">KEY TAKEAWAY & SYNTHESIS</span>
                              {activeBullets.length > 0 ? (
                                <ul className="pres-takeaway-bullets">
                                  {activeBullets.slice(0, 3).map((b, bIdx) => (
                                    <li key={bIdx}>• {b.replace(/^[•\-*]\s*/, '')}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="pres-takeaway-text">{currentSlide.takeaway || 'All metrics computed deterministically.'}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 3. DATA OVERVIEW (6 CARDS) */}
                      {slideType === 'data_overview' && (
                        <div className="pres-overview-layout">
                          <div className="pres-overview-grid">
                            {(currentSlide.cards || []).slice(0, 6).map((c, i) => (
                              <div key={i} className="pres-overview-card">
                                <div className="pres-overview-card-stripe"></div>
                                <span className="pres-overview-label">{c.label}</span>
                                <span className="pres-overview-val">{c.value}</span>
                                <span className="pres-overview-sub">{c.sub}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 4. KEY METRICS / DISTRIBUTION (WITH REAL CHART) */}
                      {slideType === 'chart' && (
                        <div className="pres-chart-slide-layout">
                          <div className="pres-chart-pane">
                            <VisualSlideChart chart={currentSlide.chart} />
                          </div>
                          <div className="pres-chart-side-card">
                            <div className="pres-chart-side-stripe"></div>
                            <span className="pres-chart-side-title">DISTRIBUTION INSIGHTS</span>
                            {activeBullets.length > 0 ? (
                              <ul className="pres-chart-side-bullets">
                                {activeBullets.slice(0, 4).map((b, i) => (
                                  <li key={i}>• {b.replace(/^[•\-*]\s*/, '')}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="pres-chart-side-text">
                                {currentSlide.chart?.insight || 'Aggregated distribution computed from source data.'}
                              </p>
                            )}
                            <div className="pres-chart-audit-tag">✓ 100% Deterministic</div>
                          </div>
                        </div>
                      )}

                      {/* 5. DATA QUALITY */}
                      {slideType === 'data_quality' && (
                        <div className="pres-quality-slide-layout">
                          <div className="pres-quality-main-card">
                            <div className="pres-quality-card-stripe"></div>
                            <span className="pres-quality-score-lbl">DATA QUALITY SCORE</span>
                            <span className="pres-quality-score-num">{currentSlide.quality_score ?? 100}%</span>
                            <div className="pres-quality-progress-track">
                              <div
                                className="pres-quality-progress-fill"
                                style={{
                                  width: `${Math.min(100, Math.max(5, currentSlide.quality_score ?? 100))}%`,
                                  background: (currentSlide.quality_score ?? 100) >= 90 ? '#4F8A68' : '#D49A3A',
                                }}
                              ></div>
                            </div>
                            <span className="pres-quality-status-badge">
                              {(currentSlide.quality_score ?? 100) >= 90 ? 'EXCELLENT COMPLIANCE' : 'HYGIENE REVIEW RECOMMENDED'}
                            </span>
                          </div>

                          <div className="pres-quality-stats-col">
                            <div className="pres-quality-stat-row">
                              <span className="pres-q-stat-lbl">Missing Values</span>
                              <span className="pres-q-stat-val">{(currentSlide.missing_count ?? 0).toLocaleString()} cells</span>
                            </div>
                            <div className="pres-quality-stat-row">
                              <span className="pres-q-stat-lbl">Duplicate Rows</span>
                              <span className="pres-q-stat-val">{(currentSlide.duplicate_count ?? 0).toLocaleString()} rows</span>
                            </div>
                            <div className="pres-quality-stat-row">
                              <span className="pres-q-stat-lbl">Columns Needing Attention</span>
                              <span className="pres-q-stat-val">{(currentSlide.attention_columns_count ?? 0)} features</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 6. KEY INSIGHTS (NUMBERED CARDS) */}
                      {slideType === 'insights' && (
                        <div className="pres-insights-slide-layout">
                          <div className="pres-insights-grid">
                            {(currentSlide.insight_cards || []).slice(0, 4).map((ins, i) => (
                              <div key={i} className="pres-insight-box">
                                <div className="pres-insight-top">
                                  <span className="pres-insight-num">{ins.number || `0${i + 1}`}</span>
                                  <span className="pres-insight-cat">{ins.category}</span>
                                </div>
                                <p className="pres-insight-stmt">{ins.statement}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 7. RECOMMENDATIONS (NUMBERED ACTION CARDS) */}
                      {slideType === 'recommendations' && (
                        <div className="pres-recs-slide-layout">
                          <div className="pres-recs-grid">
                            {(currentSlide.recommendation_cards || []).slice(0, 4).map((rec, i) => (
                              <div key={i} className="pres-rec-box">
                                <div className="pres-rec-stripe"></div>
                                <div className="pres-rec-body">
                                  <span className="pres-rec-title">{rec.number || `0${i + 1}`} · {rec.title}</span>
                                  <p className="pres-rec-text">{rec.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 8. CLOSING SLIDE */}
                      {slideType === 'closing' && (
                        <div className="pres-closing-slide-layout">
                          <div className="pres-closing-card">
                            <div className="pres-closing-stripe"></div>
                            <span className="pres-closing-brand">INSIGHTDECK</span>
                            <h2 className="pres-closing-tagline">Data → Insights → Decisions</h2>
                            <div className="pres-closing-divider"></div>
                            <p className="pres-closing-dataset">Dataset: {presentation.filename || 'Dataset.xlsx'}</p>
                            <span className="pres-closing-thank">Audit & Analysis Complete · Thank You</span>
                          </div>
                        </div>
                      )}

                      {/* 9. CUSTOM / FALLBACK BULLETS */}
                      {slideType === 'custom' && (
                        <div className="pres-custom-slide-layout">
                          {activeBullets.length > 0 ? (
                            <ul className="pres-custom-bullet-list">
                              {activeBullets.map((b, bIdx) => (
                                <li key={bIdx} className="pres-custom-bullet-item">
                                  <span className="pres-custom-bullet-dot">•</span>
                                  <span>{b.replace(/^[•\-*]\s*/, '')}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="pres-custom-empty">
                              <p>No content on this slide. Use the editor on the right to add bullets.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* SLIDE FOOTER */}
                    <div className="pres-slide-footer-executive">
                      <span>{presentation.filename || 'InsightDeck Analysis'}</span>
                      <span>16:9 Executive Widescreen</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* ----- RIGHT SIDEBAR: EDIT SLIDE ----- */}
        <aside className="pres-sidebar-right">
          <div className="pres-props-header">
            <h3 className="pres-props-title">EDIT SLIDE</h3>
            <span className="pres-props-slide-pill">Slide {selectedSlideIndex + 1}</span>
          </div>

          <div className="pres-props-body">
            {/* Reorder Buttons */}
            <div className="pres-reorder-group">
              <span className="pres-reorder-label">Reorder:</span>
              <div className="pres-reorder-buttons">
                <button
                  className="pres-reorder-btn"
                  onClick={() => handleMoveSlide(-1)}
                  disabled={selectedSlideIndex === 0}
                  title="Move slide up"
                >
                  ↑ Move Up
                </button>
                <button
                  className="pres-reorder-btn"
                  onClick={() => handleMoveSlide(1)}
                  disabled={selectedSlideIndex === slides.length - 1}
                  title="Move slide down"
                >
                  ↓ Move Down
                </button>
              </div>
            </div>

            {/* Title */}
            <div className="pres-form-field">
              <label className="pres-form-label">Title</label>
              <input
                type="text"
                className="pres-input"
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                placeholder="Enter slide title..."
              />
            </div>

            {/* Subtitle */}
            <div className="pres-form-field">
              <label className="pres-form-label">Subtitle</label>
              <input
                type="text"
                className="pres-input"
                value={editSubtitle}
                onChange={(e) => {
                  setEditSubtitle(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                placeholder="Overview of the dataset..."
              />
            </div>

            {/* Content Textarea */}
            <div className="pres-form-field pres-field-flex">
              <label className="pres-form-label">
                Content & Bullets
                <span className="pres-field-hint">(One bullet per line)</span>
              </label>
              <textarea
                className="pres-textarea"
                rows={10}
                value={editContent}
                onChange={(e) => {
                  setEditContent(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                placeholder="• Total records: 1250&#10;• Columns: 18&#10;• Missing values: 42"
              />
            </div>

            {/* Action Buttons */}
            <div className="pres-form-actions">
              <button className="pres-apply-btn" onClick={handleApplyChanges}>
                Apply Changes
              </button>
              <button
                className="pres-delete-btn"
                onClick={() => handleDeleteSlide(selectedSlideIndex)}
                disabled={slides.length <= 1}
                title={slides.length <= 1 ? 'Cannot delete the only slide' : 'Delete this slide'}
              >
                Delete Slide
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
