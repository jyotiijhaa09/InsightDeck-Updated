"""
Insight Engine Foundation for InsightDeck.
Generates deterministic, factual insights derived directly from analysis results.
Strictly avoids inventing numbers or hallucinations.
"""

from typing import Any, Dict, List


def generate_factual_insights(analysis_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Generates structured factual insights based on dataset analysis.

    Args:
        analysis_data: Dictionary returned by analyzer.analyze_dataset or processor.

    Returns:
        List of insight dictionaries with title, description, category, and severity.
    """
    insights: List[Dict[str, Any]] = []

    dims = analysis_data.get("dimensions", {})
    row_count = dims.get("row_count", 0)
    col_count = dims.get("column_count", 0)

    # 1. Dataset Dimensions Insight
    insights.append({
        "id": "insight-dimensions",
        "category": "overview",
        "type": "info",
        "title": "Dataset Scale",
        "statement": f"Dataset contains {row_count:,} records across {col_count} columns.",
        "badge": f"{row_count:,} Rows × {col_count} Cols",
    })

    # 2. Data Quality & Hygiene Insights
    dq = analysis_data.get("data_quality", {})
    missing_count = dq.get("missing_values", 0)
    duplicate_count = dq.get("duplicate_rows", 0)
    quality_score = dq.get("quality_score", 100.0)

    if missing_count == 0:
        insights.append({
            "id": "insight-missing-clean",
            "category": "data_quality",
            "type": "success",
            "title": "Data Completeness",
            "statement": "Zero missing values detected across all columns. Data integrity is optimal.",
            "badge": "100% Complete",
        })
    else:
        insights.append({
            "id": "insight-missing-detected",
            "category": "data_quality",
            "type": "warning",
            "title": "Missing Data Detected",
            "statement": f"Found {missing_count:,} missing cell values requiring validation before final audit.",
            "badge": f"{missing_count:,} Missing Cells",
        })

    if duplicate_count == 0:
        insights.append({
            "id": "insight-duplicates-clean",
            "category": "data_quality",
            "type": "success",
            "title": "Duplicate Check",
            "statement": "No duplicate rows detected. All record entries are distinct.",
            "badge": "0 Duplicates",
        })
    else:
        dup_pct = round((duplicate_count / max(1, row_count)) * 100, 1)
        insights.append({
            "id": "insight-duplicates-detected",
            "category": "data_quality",
            "type": "warning",
            "title": "Duplicate Records",
            "statement": f"Found {duplicate_count:,} duplicate rows ({dup_pct}% of total records).",
            "badge": f"{duplicate_count:,} Duplicates ({dup_pct}%)",
        })

    # 3. Numeric Column Highlights
    numeric_summary = analysis_data.get("numeric_summary", {})
    if numeric_summary:
        num_cols = list(numeric_summary.keys())
        # Pick the first numeric column with the highest sum as a primary metric highlight
        primary_col = max(num_cols, key=lambda c: numeric_summary[c].get("total", 0))
        p_stats = numeric_summary[primary_col]

        insights.append({
            "id": "insight-metric-primary",
            "category": "metrics",
            "type": "highlight",
            "title": f"Key Metric: {primary_col}",
            "statement": f"Total {primary_col} sums to {p_stats['total']:,.2f}, averaging {p_stats['average']:,.2f} per record (range: {p_stats['min']:,.2f} to {p_stats['max']:,.2f}).",
            "badge": f"Sum: {p_stats['total']:,.2f}",
        })

        if len(num_cols) > 1:
            insights.append({
                "id": "insight-numeric-scope",
                "category": "metrics",
                "type": "info",
                "title": "Quantitative Scope",
                "statement": f"Identified {len(num_cols)} quantifiable metrics: {', '.join(num_cols[:4])}{'...' if len(num_cols) > 4 else ''}.",
                "badge": f"{len(num_cols)} Numeric Metrics",
            })

    # 4. Categorical Segmentation Insights
    cat_summary = analysis_data.get("categorical_summary", {})
    if cat_summary:
        for col_name, cat_stats in list(cat_summary.items())[:2]:
            unique_cnt = cat_stats.get("unique_count", 0)
            top_vals = cat_stats.get("top_values", {})
            if top_vals:
                top_item, top_cnt = next(iter(top_vals.items()))
                pct = round((top_cnt / max(1, row_count)) * 100, 1)
                insights.append({
                    "id": f"insight-cat-{col_name}",
                    "category": "segmentation",
                    "type": "info",
                    "title": f"Segmentation: {col_name}",
                    "statement": f"'{col_name}' spans {unique_cnt} categories. Top category '{top_item}' represents {top_cnt:,} records ({pct}% of dataset).",
                    "badge": f"Top: {top_item} ({top_cnt:,})",
                })

    return insights
