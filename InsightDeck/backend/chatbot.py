"""
Data-Aware Chatbot Service for InsightDeck.
Answers user questions deterministically using real dataset analysis results,
ensuring 100% mathematical consistency without hallucinations.
"""

from typing import Any, Dict, List, Optional
import re


def build_chatbot_context(
    analysis_data: Optional[Dict[str, Any]],
    insights: Optional[List[Dict[str, Any]]],
    filename: Optional[str],
) -> Dict[str, Any]:
    """Builds a compact, structured analysis context object for chatbot reasoning."""
    if not analysis_data:
        return {
            "has_dataset": False,
            "filename": None,
            "summary": {},
            "numeric_columns": [],
            "categorical_columns": [],
            "numeric_summary": {},
            "categorical_summary": {},
            "insights": [],
        }

    dims = analysis_data.get("dimensions", {})
    dq = analysis_data.get("data_quality", {})
    col_types = analysis_data.get("column_types", {})

    return {
        "has_dataset": True,
        "filename": filename or "Dataset.xlsx",
        "summary": {
            "records": dims.get("row_count", 0),
            "columns": dims.get("column_count", 0),
            "missing_values": dq.get("missing_values", 0),
            "duplicate_rows": dq.get("duplicate_rows", 0),
            "quality_score": dq.get("quality_score", 100.0),
        },
        "numeric_columns": col_types.get("numeric_columns", []),
        "categorical_columns": col_types.get("categorical_columns", []),
        "datetime_columns": col_types.get("datetime_columns", []),
        "numeric_summary": analysis_data.get("numeric_summary", {}),
        "categorical_summary": analysis_data.get("categorical_summary", {}),
        "insights": [ins.get("statement", "") for ins in (insights or []) if ins.get("statement")],
        "raw_insights": insights or [],
    }


def process_chat_message(
    message: str,
    analysis_data: Optional[Dict[str, Any]],
    insights: Optional[List[Dict[str, Any]]],
    filename: Optional[str],
) -> Dict[str, Any]:
    """
    Processes a user question deterministically against the active dataset analysis.

    Args:
        message: User query string
        analysis_data: Dictionary returned by analyzer.analyze_dataset
        insights: List of factual insights
        filename: Name of the active Excel file

    Returns:
        Dict with 'answer' string and 'data' context dictionary.
    """
    clean_msg = message.strip()
    if not clean_msg:
        return {
            "answer": "Please provide a question or select one of the suggested query chips.",
            "data": {},
        }

    if not analysis_data:
        return {
            "answer": "Please upload and analyze an Excel file first so I can answer questions about your data.",
            "data": {"has_dataset": False},
        }

    ctx = build_chatbot_context(analysis_data, insights, filename)
    summary = ctx["summary"]
    num_summary = ctx["numeric_summary"]
    cat_summary = ctx["categorical_summary"]
    msg_lower = clean_msg.lower()

    # 1. Total Records / Rows query
    if any(k in msg_lower for k in ["how many row", "number of row", "total row", "total record", "record count", "rows"]):
        if not any(k in msg_lower for k in ["duplicate", "missing"]):
            ans = (
                f"📊 **Dataset Records**:\n\n"
                f"The dataset `{ctx['filename']}` contains **{summary['records']:,}** total records (rows) "
                f"and **{summary['columns']}** columns."
            )
            return {"answer": ans, "data": {"records": summary["records"], "columns": summary["columns"]}}

    # 2. Missing values & Data Quality query
    if any(k in msg_lower for k in ["missing", "null", "blank", "incomplete", "quality", "clean"]):
        missing_total = summary["missing_values"]
        quality_score = summary["quality_score"]

        # Check column-specific missing values
        dq_detail = analysis_data.get("missing_values", {}).get("by_column", {})
        high_missing_cols = {k: v for k, v in dq_detail.items() if v > 0}

        if missing_total == 0:
            ans = (
                f"✅ **Data Completeness & Quality**:\n\n"
                f"Zero missing values were detected in `{ctx['filename']}`. "
                f"Data completeness is **100%** with a data quality score of **{quality_score}%**."
            )
        else:
            top_miss = sorted(high_missing_cols.items(), key=lambda x: x[1], reverse=True)
            col_breakdown = ", ".join([f"`{col}`: {cnt:,}" for col, cnt in top_miss[:3]])
            ans = (
                f"⚠️ **Missing Values Report**:\n\n"
                f"Found **{missing_total:,}** total missing cell values across the dataset. "
                f"Data quality score is **{quality_score}%**.\n"
                f"Top columns with missing data: {col_breakdown}."
            )
        return {"answer": ans, "data": {"missing_values": missing_total, "quality_score": quality_score}}

    # 3. Duplicate rows query
    if "duplicate" in msg_lower:
        dup_count = summary["duplicate_rows"]
        if dup_count == 0:
            ans = (
                f"✅ **Duplicate Record Check**:\n\n"
                f"No duplicate rows were detected in `{ctx['filename']}`. All **{summary['records']:,}** records are distinct."
            )
        else:
            pct = round((dup_count / max(1, summary["records"])) * 100, 1)
            ans = (
                f"⚠️ **Duplicate Rows Detected**:\n\n"
                f"Identified **{dup_count:,}** exact duplicate rows ({pct}% of the dataset). "
                f"Auditors should review and consider deduplicating these entries."
            )
        return {"answer": ans, "data": {"duplicate_rows": dup_count}}

    # 4. Columns / Schema / Types query
    if any(k in msg_lower for k in ["column", "schema", "field", "feature", "type"]):
        num_cols = ctx["numeric_columns"]
        cat_cols = ctx["categorical_columns"]
        ans = (
            f"📋 **Dataset Schema ({summary['columns']} Columns)**:\n\n"
            f"• **Numeric Metrics ({len(num_cols)})**: {', '.join([f'`{c}`' for c in num_cols]) if num_cols else 'None'}\n"
            f"• **Categorical / Text ({len(cat_cols)})**: {', '.join([f'`{c}`' for c in cat_cols]) if cat_cols else 'None'}"
        )
        return {"answer": ans, "data": {"numeric_columns": num_cols, "categorical_columns": cat_cols}}

    # 5. Key Insights query
    if any(k in msg_lower for k in ["insight", "finding", "discovered", "takeaway", "conclusion"]):
        raw_ins = ctx["raw_insights"]
        if raw_ins:
            bullets = "\n".join([f"• **{ins.get('title', 'Insight')}**: {ins.get('statement', '')}" for ins in raw_ins])
            ans = f"💡 **Key Factual Insights for `{ctx['filename']}`**:\n\n{bullets}"
        else:
            ans = f"💡 **Dataset Summary**: `{ctx['filename']}` contains {summary['records']:,} rows with data quality of {summary['quality_score']}%."
        return {"answer": ans, "data": {"insights": ctx["insights"]}}

    # 6. Specific Metric Calculations (Revenue, Totals, Averages, Max/Min)
    # Check if user mentioned a specific column name
    matched_num_col = None
    for col_name in num_summary.keys():
        if col_name.lower() in msg_lower:
            matched_num_col = col_name
            break

    if matched_num_col:
        stats = num_summary[matched_num_col]
        ans = (
            f"📈 **Statistics for `{matched_num_col}`**:\n\n"
            f"• **Total Sum**: **{stats.get('total', 0):,.2f}**\n"
            f"• **Average / Mean**: **{stats.get('average', 0):,.2f}**\n"
            f"• **Minimum**: {stats.get('min', 0):,.2f}\n"
            f"• **Maximum**: {stats.get('max', 0):,.2f}\n"
            f"• **Standard Deviation**: {stats.get('std_dev', 0):,.2f}\n"
            f"• **Count of Valid Entries**: {stats.get('count', 0):,}"
        )
        return {"answer": ans, "data": stats}

    # Highest average / total query
    if any(k in msg_lower for k in ["highest average", "highest total", "highest metric", "maximum average", "top metric"]):
        if num_summary:
            top_by_avg = max(num_summary.items(), key=lambda x: x[1].get("average", 0))
            top_by_sum = max(num_summary.items(), key=lambda x: x[1].get("total", 0))
            ans = (
                f"🏆 **Highest Quantitative Metrics**:\n\n"
                f"• **Highest Total Volume**: `{top_by_sum[0]}` with a sum of **{top_by_sum[1]['total']:,.2f}**\n"
                f"• **Highest Average Value**: `{top_by_avg[0]}` with an average of **{top_by_avg[1]['average']:,.2f}**"
            )
            return {"answer": ans, "data": {"top_total": top_by_sum, "top_average": top_by_avg}}

    # 7. Categorical Top Values / Distribution
    matched_cat_col = None
    for col_name in cat_summary.keys():
        if col_name.lower() in msg_lower:
            matched_cat_col = col_name
            break

    if matched_cat_col:
        c_stats = cat_summary[matched_cat_col]
        top_v = c_stats.get("top_values", {})
        breakdown = "\n".join([f"• `{k}`: {v:,} records ({round(v/max(1, summary['records'])*100, 1)}%)" for k, v in top_v.items()])
        ans = (
            f"🏷️ **Category Breakdown for `{matched_cat_col}`** ({c_stats.get('unique_count', 0)} Unique Categories):\n\n"
            f"{breakdown}"
        )
        return {"answer": ans, "data": c_stats}

    # Top 5 / Top Categories
    if any(k in msg_lower for k in ["top 5", "top values", "top category", "top region", "categories"]):
        if cat_summary:
            lines = []
            for col_name, c_stats in list(cat_summary.items())[:2]:
                top_item, top_cnt = next(iter(c_stats.get("top_values", {}).items()), ("N/A", 0))
                pct = round(top_cnt / max(1, summary["records"]) * 100, 1)
                lines.append(f"• `{col_name}`: Top segment is **{top_item}** with **{top_cnt:,}** records ({pct}%)")
            ans = f"🏷️ **Top Categorical Segments**:\n\n" + "\n".join(lines)
            return {"answer": ans, "data": cat_summary}

    # 8. Auditor / Investigation guidance
    if any(k in msg_lower for k in ["auditor", "investigate", "look at first", "audit", "risk", "anomaly", "recommend"]):
        recommendations = []
        if summary["missing_values"] > 0:
            recommendations.append(f"1. **Missing Data**: Investigate {summary['missing_values']:,} missing cells for compliance.")
        else:
            recommendations.append("1. **Data Completeness**: Optimal (100% complete, zero missing cells).")

        if summary["duplicate_rows"] > 0:
            recommendations.append(f"2. **Duplicates**: Verify {summary['duplicate_rows']:,} duplicate records for potential double-counting.")
        else:
            recommendations.append("2. **Duplicate Check**: Clean (0 duplicate rows found).")

        if num_summary:
            top_metric = max(num_summary.items(), key=lambda x: x[1].get("total", 0))
            recommendations.append(f"3. **High-Value Exposure**: Audit high-volume metric `{top_metric[0]}` (Total: {top_metric[1]['total']:,.2f}).")

        ans = (
            f"🔍 **Auditor Action Items & Priorities**:\n\n"
            + "\n".join(recommendations)
            + f"\n\n*All statistics computed deterministically from `{ctx['filename']}`.*"
        )
        return {"answer": ans, "data": {"priorities": recommendations}}

    # 9. Summary / Overview query
    if any(k in msg_lower for k in ["summary", "summarize", "overview", "tell me about", "what is this"]):
        kpi_lines = []
        for col_name, stats in list(num_summary.items())[:2]:
            kpi_lines.append(f"• Total `{col_name}`: **{stats['total']:,.2f}** (avg: {stats['average']:,.2f})")

        ans = (
            f"📊 **Executive Summary for `{ctx['filename']}`**:\n\n"
            f"• **Scale**: **{summary['records']:,}** records across **{summary['columns']}** columns\n"
            f"• **Data Quality**: **{summary['quality_score']}%** ({summary['missing_values']:,} missing cells, {summary['duplicate_rows']:,} duplicates)\n"
            + ("\n".join(kpi_lines) + "\n" if kpi_lines else "")
            + f"• **Presentation Deck**: 5 executive slides generated and available in the Presentation Editor."
        )
        return {"answer": ans, "data": ctx}

    # 10. General fallback answering using dataset context
    available_metrics = ", ".join([f"`{c}`" for c in ctx["numeric_columns"]]) or "None"
    available_cats = ", ".join([f"`{c}`" for c in ctx["categorical_columns"]]) or "None"
    ans = (
        f"I analyzed `{ctx['filename']}` ({summary['records']:,} rows, {summary['columns']} cols).\n\n"
        f"You can ask me questions such as:\n"
        f"• *'What is the total number of records?'*\n"
        f"• *'Which column has the most missing values?'*\n"
        f"• *'What are the key insights?'*\n"
        f"• *'What should an auditor investigate first?'*\n"
        f"• *'What is the average of {list(num_summary.keys())[0] if num_summary else 'Revenue'}?'*\n\n"
        f"**Available Numeric Metrics**: {available_metrics}\n"
        f"**Available Categories**: {available_cats}"
    )
    return {"answer": ans, "data": {"context": ctx}}
