"""
Excel Processor Foundation for InsightDeck.
Safely inspects and extracts structured metadata from Excel (.xlsx) files
without modifying original source data.
"""

from pathlib import Path
from typing import Any, Dict, List
import numpy as np
import pandas as pd


def process_excel_file(file_path: str | Path, sheet_name: str | None = None) -> Dict[str, Any]:
    """
    Opens an Excel file in read-only mode using Pandas and OpenPyXL,
    extracts structural metadata and data quality metrics.

    Args:
        file_path: Absolute or relative path to the Excel (.xlsx) file.
        sheet_name: Specific sheet name to process. If None, the first sheet is loaded.

    Returns:
        Dict containing worksheet names, row/col counts, column names,
        data types, missing value statistics, duplicate counts, and sample records.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Excel file not found at: {file_path}")

    # Inspect sheet names without reading all data
    excel_reader = pd.ExcelFile(path, engine="openpyxl")
    sheet_names = excel_reader.sheet_names

    selected_sheet = sheet_name if sheet_name and sheet_name in sheet_names else sheet_names[0]

    # Read dataframe safely
    df = pd.read_excel(excel_reader, sheet_name=selected_sheet)

    # Basic dimensions
    row_count = int(df.shape[0])
    col_count = int(df.shape[1])
    columns = [str(col) for col in df.columns]

    # Data types mapping
    dtypes_map = {}
    for col in df.columns:
        dtype_str = str(df[col].dtype)
        if pd.api.types.is_numeric_dtype(df[col]):
            dtypes_map[str(col)] = "numeric"
        elif pd.api.types.is_datetime64_any_dtype(df[col]):
            dtypes_map[str(col)] = "datetime"
        elif pd.api.types.is_bool_dtype(df[col]):
            dtypes_map[str(col)] = "boolean"
        else:
            dtypes_map[str(col)] = "text/categorical"

    # Missing values analysis
    missing_by_col = {str(col): int(df[col].isna().sum()) for col in df.columns}
    total_missing = int(sum(missing_by_col.values()))
    total_cells = row_count * col_count if (row_count * col_count) > 0 else 1
    completeness_pct = round(((total_cells - total_missing) / total_cells) * 100, 2)

    # Duplicate rows detection
    duplicate_rows_count = int(df.duplicated().sum())

    # Sample rows formatted safely for JSON serialization
    sample_df = df.head(5).copy()
    # Replace NaN/inf with None for clean JSON serialization
    sample_df = sample_df.replace({np.nan: None})
    sample_rows = sample_df.to_dict(orient="records")

    # Clean any non-serializable objects in sample rows (e.g. Timestamp)
    clean_sample_rows = []
    for row in sample_rows:
        clean_row = {}
        for k, v in row.items():
            if isinstance(v, (pd.Timestamp, pd.Period)):
                clean_row[str(k)] = v.isoformat()
            elif isinstance(v, (np.integer, np.int64, np.int32)):
                clean_row[str(k)] = int(v)
            elif isinstance(v, (np.floating, np.float64, np.float32)):
                clean_row[str(k)] = float(v) if not np.isnan(v) else None
            else:
                clean_row[str(k)] = v
        clean_sample_rows.append(clean_row)

    return {
        "file_name": path.name,
        "sheet_names": sheet_names,
        "active_sheet": selected_sheet,
        "row_count": row_count,
        "column_count": col_count,
        "columns": columns,
        "dtypes": dtypes_map,
        "missing_values": {
            "total": total_missing,
            "completeness_percentage": completeness_pct,
            "by_column": missing_by_col,
        },
        "duplicate_rows": duplicate_rows_count,
        "sample_rows": clean_sample_rows,
    }
