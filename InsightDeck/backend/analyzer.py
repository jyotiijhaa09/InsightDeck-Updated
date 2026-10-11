"""
Analyzer Foundation for InsightDeck.
Performs deterministic, rule-based calculations and metric summaries.
Strictly avoids machine learning or LLMs for mathematical calculations.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd


def analyze_dataset(file_path: str | Path, sheet_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Performs deterministic baseline analysis on an Excel file.

    Calculates:
    - Row & column counts
    - Missing value totals and percentages
    - Duplicate row counts
    - Column categorization (numeric, categorical, datetime, boolean)
    - Numeric statistics (totals, averages, minimums, maximums)
    - Categorical summaries (unique counts, top categories)

    Args:
        file_path: Path to the Excel file.
        sheet_name: Specific sheet name.

    Returns:
        Structured dictionary of computed metrics.
    """
    path = Path(file_path)
    df = pd.read_excel(path, sheet_name=sheet_name or 0, engine="openpyxl")

    row_count = int(len(df))
    col_count = int(len(df.columns))

    # Identify column types
    numeric_cols = [str(col) for col in df.select_dtypes(include=[np.number]).columns]
    datetime_cols = [str(col) for col in df.select_dtypes(include=["datetime", "datetimetz"]).columns]
    categorical_cols = [
        str(col)
        for col in df.columns
        if str(col) not in numeric_cols and str(col) not in datetime_cols
    ]

    missing_count = int(df.isna().sum().sum())
    duplicate_count = int(df.duplicated().sum())
    total_cells = row_count * col_count if (row_count * col_count) > 0 else 1
    data_quality_score = round(max(0, 100 - ((missing_count / total_cells) * 100) - ((duplicate_count / max(1, row_count)) * 20)), 1)
    missing_by_col = {
        str(col): int(df[col].isna().sum())
        for col in df.columns
        if int(df[col].isna().sum()) > 0
    }

    # Compute numeric statistics deterministically
    numeric_stats = {}
    for col in numeric_cols:
        series = df[col].dropna()
        if not series.empty:
            total_val = float(series.sum())
            mean_val = float(series.mean())
            min_val = float(series.min())
            max_val = float(series.max())
            std_val = float(series.std()) if len(series) > 1 else 0.0

            numeric_stats[col] = {
                "total": round(total_val, 2),
                "average": round(mean_val, 2),
                "min": round(min_val, 2),
                "max": round(max_val, 2),
                "std_dev": round(std_val, 2) if not np.isnan(std_val) else 0.0,
                "count": int(series.count()),
            }

    # Compute categorical distributions
    categorical_stats = {}
    for col in categorical_cols:
        series = df[col].dropna().astype(str)
        if not series.empty:
            unique_count = int(series.nunique())
            top_counts = series.value_counts().head(5).to_dict()
            clean_top_counts = {str(k): int(v) for k, v in top_counts.items()}
            categorical_stats[col] = {
                "unique_count": unique_count,
                "top_values": clean_top_counts,
            }

    return {
        "dimensions": {
            "row_count": row_count,
            "column_count": col_count,
        },
        "data_quality": {
            "missing_values": missing_count,
            "duplicate_rows": duplicate_count,
            "quality_score": data_quality_score,
            "missing_by_column": missing_by_col,
        },
        "column_types": {
            "numeric_columns": numeric_cols,
            "categorical_columns": categorical_cols,
            "datetime_columns": datetime_cols,
        },
        "numeric_summary": numeric_stats,
        "categorical_summary": categorical_stats,
    }


# Future Extensibility Functions
def calculate_totals(df: pd.DataFrame, columns: Optional[List[str]] = None) -> Dict[str, float]:
    """Calculate exact sums for specified or all numeric columns."""
    target_cols = columns or list(df.select_dtypes(include=[np.number]).columns)
    return {col: float(df[col].sum()) for col in target_cols if col in df.columns}


def calculate_averages(df: pd.DataFrame, columns: Optional[List[str]] = None) -> Dict[str, float]:
    """Calculate exact means for specified or all numeric columns."""
    target_cols = columns or list(df.select_dtypes(include=[np.number]).columns)
    return {col: float(df[col].mean()) for col in target_cols if col in df.columns}


def calculate_min_max(df: pd.DataFrame, columns: Optional[List[str]] = None) -> Dict[str, Dict[str, float]]:
    """Calculate exact min and max bounds."""
    target_cols = columns or list(df.select_dtypes(include=[np.number]).columns)
    return {
        col: {"min": float(df[col].min()), "max": float(df[col].max())}
        for col in target_cols
        if col in df.columns
    }


def detect_trends(df: pd.DataFrame, date_col: str, metric_col: str) -> Dict[str, Any]:
    """Placeholder for chronological trend analysis in future steps."""
    return {"status": "planned", "date_col": date_col, "metric_col": metric_col}


def calculate_category_comparisons(df: pd.DataFrame, category_col: str, metric_col: str) -> Dict[str, Any]:
    """Placeholder for categorical aggregation comparisons in future steps."""
    return {"status": "planned", "category_col": category_col, "metric_col": metric_col}


def detect_outliers(df: pd.DataFrame, numeric_col: str) -> Dict[str, Any]:
    """Placeholder for IQR / statistical outlier detection in future steps."""
    return {"status": "planned", "numeric_col": numeric_col}
