"""
Presentation Generator & Editor Engine for InsightDeck.
Builds structured JSON presentation models and renders professional, visually impressive
analytics presentations into native PowerPoint (.pptx) files using python-pptx.
Implements executive design principles: strong visual hierarchy, KPI cards, actual native charts,
insight cards, and full support for user edits.
"""

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

import pptx
from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt


# Executive Palette Definition (Light Executive Theme)
COLOR_BG = RGBColor(248, 250, 252)          # Slate Light #F8FAFC
COLOR_PRIMARY = RGBColor(39, 76, 119)       # Deep Executive Blue #274C77
COLOR_SECONDARY = RGBColor(96, 150, 186)    # Slate Blue #6096BA
COLOR_ACCENT = RGBColor(163, 206, 241)      # Soft Sky Accent #A3CEF1
COLOR_DARK_TEXT = RGBColor(23, 32, 51)      # Charcoal Dark #172033
COLOR_MUTED_TEXT = RGBColor(100, 116, 139)  # Slate Muted #64748B
COLOR_SUCCESS = RGBColor(79, 138, 104)      # Forest Green #4F8A68
COLOR_WARNING = RGBColor(212, 154, 58)      # Amber #D49A3A
COLOR_DANGER = RGBColor(200, 92, 92)        # Crimson #C85C5C
COLOR_WHITE = RGBColor(255, 255, 255)       # Pure White #FFFFFF
COLOR_CARD_BORDER = RGBColor(226, 232, 240) # Border #E2E8F0
COLOR_CARD_BG = RGBColor(255, 255, 255)     # Card White #FFFFFF


def choose_best_chart(analysis_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deterministically selects and formats the best visual chart based on dataset analysis.
    Never uses fake data; extracts real aggregated values from the uploaded Excel file.
    """
    dims = analysis_data.get("dimensions", {})
    row_count = dims.get("row_count", 0)
    col_types = analysis_data.get("column_types", {})
    cat_summary = analysis_data.get("categorical_summary", {})
    num_summary = analysis_data.get("numeric_summary", {})

    # Strategy 1: Categorical column with clear distribution (prioritize business dimensions over IDs)
    best_cat_col = None
    best_top_vals = None
    for col_name, data in cat_summary.items():
        c_lower = col_name.lower()
        if c_lower.endswith("id") or c_lower in ["id", "index", "key", "uuid", "code"]:
            continue
        unique_cnt = data.get("unique_count", 0)
        if unique_cnt >= row_count and row_count > 3:
            continue
        top_vals = data.get("top_values", {})
        if 2 <= len(top_vals) <= 7:
            best_cat_col = col_name
            best_top_vals = top_vals
            break

    if not best_cat_col and cat_summary:
        for col_name, data in cat_summary.items():
            c_lower = col_name.lower()
            if not (c_lower.endswith("id") or c_lower in ["id", "index"]):
                best_cat_col = col_name
                best_top_vals = data.get("top_values", {})
                break
        if not best_cat_col:
            first_col = next(iter(cat_summary.keys()))
            best_cat_col = first_col
            best_top_vals = cat_summary[first_col].get("top_values", {})

    if best_cat_col and best_top_vals:
        categories = [str(k) for k in best_top_vals.keys()]
        values = [float(v) for v in best_top_vals.values()]
        top_cat = categories[0]
        top_val = values[0]
        pct = round((top_val / max(1, row_count)) * 100, 1)

        # 2 to 4 categories -> Doughnut Chart for part-to-whole, else Horizontal Bar
        if 2 <= len(categories) <= 4:
            c_type = "doughnut"
        else:
            c_type = "bar"

        return {
            "chart_type": c_type,
            "title": f"Distribution by {best_cat_col}",
            "column_name": best_cat_col,
            "categories": categories,
            "series": [{"name": "Record Count", "values": values}],
            "insight": f"Top segment '{top_cat}' accounts for {int(top_val):,} records ({pct}% of observed data).",
        }

    # Strategy 2: Multiple numeric columns -> Comparison Column Chart
    if len(num_summary) >= 2:
        top_nums = list(num_summary.items())[:6]
        categories = [k for k, _ in top_nums]
        totals = [float(v.get("total", 0)) for _, v in top_nums]
        max_tot = max(totals) if totals else 1
        min_tot = min(totals) if totals else 1
        use_avg = (max_tot / max(1.0, min_tot)) > 1000

        series_name = "Average" if use_avg else "Total Sum"
        values = [float(v.get("average", 0)) for _, v in top_nums] if use_avg else totals

        return {
            "chart_type": "column",
            "title": f"Cross-Metric Comparison ({series_name})",
            "column_name": "Metrics",
            "categories": categories,
            "series": [{"name": series_name, "values": values}],
            "insight": f"Aggregated {series_name.lower()} computed across {len(categories)} quantitative metrics.",
        }

    # Strategy 3: Single numeric column summary
    if len(num_summary) == 1:
        col_name, stats = next(iter(num_summary.items()))
        categories = ["Min", "Average", "Max"]
        values = [float(stats.get("min", 0)), float(stats.get("average", 0)), float(stats.get("max", 0))]
        return {
            "chart_type": "column",
            "title": f"Range Distribution: {col_name}",
            "column_name": col_name,
            "categories": categories,
            "series": [{"name": col_name, "values": values}],
            "insight": f"Metric '{col_name}' spans from {values[0]:,.2f} to {values[2]:,.2f} with average {values[1]:,.2f}.",
        }

    # Strategy 4: Fallback dataset dimensions
    return {
        "chart_type": "column",
        "title": "Dataset Volume Metrics",
        "column_name": "Dataset",
        "categories": ["Row Records", "Columns", "Quality Score"],
        "series": [{"name": "Volume", "values": [float(row_count), float(dims.get("column_count", 0)), float(analysis_data.get("data_quality", {}).get("quality_score", 100))]}],
        "insight": f"Dataset contains {row_count:,} records processed with automated validation.",
    }


def build_presentation_model(
    analysis_data: Dict[str, Any],
    insights: List[Dict[str, Any]],
    filename: Optional[str] = "Dataset.xlsx",
) -> Dict[str, Any]:
    """
    Constructs the 8-slide executive presentation JSON model based on real analysis data.
    """
    dims = analysis_data.get("dimensions", {})
    row_count = dims.get("row_count", 0)
    col_count = dims.get("column_count", 0)
    dq = analysis_data.get("data_quality", {})
    missing_count = dq.get("missing_values", 0)
    duplicate_count = dq.get("duplicate_rows", 0)
    quality_score = dq.get("quality_score", 100.0)
    missing_by_col = dq.get("missing_by_column", {})
    num_summary = analysis_data.get("numeric_summary", {})
    cat_summary = analysis_data.get("categorical_summary", {})

    chart_info = choose_best_chart(analysis_data)
    date_str = datetime.now().strftime("%B %d, %Y")

    # Determine top factual takeaway
    top_insight_text = "All dataset records and dimensions verified with deterministic zero-hallucination calculations."
    if insights:
        for ins in insights:
            stmt = ins.get("statement", "")
            if stmt:
                top_insight_text = stmt
                break

    slides: List[Dict[str, Any]] = []

    # ==================== SLIDE 1: COVER ====================
    slides.append({
        "id": "slide-1",
        "type": "cover",
        "title": "INSIGHTDECK",
        "subtitle": "Excel Intelligence & Audit Analytics",
        "dataset_name": filename,
        "date_str": date_str,
        "bullets": [
            f"Dataset: {filename}",
            f"Scope: {row_count:,} Records · {col_count} Attributes",
            f"Integrity Score: {quality_score}% Verified",
            "Executive Audit & Intelligence Report",
        ],
        "content": [
            f"Dataset: {filename}",
            f"Scope: {row_count:,} Records · {col_count} Attributes",
            f"Integrity Score: {quality_score}% Verified",
            "Executive Audit & Intelligence Report",
        ],
    })

    # ==================== SLIDE 2: EXECUTIVE SUMMARY ====================
    s2_cards = [
        {"label": "TOTAL RECORDS", "value": f"{row_count:,}", "sub": "Processed Rows"},
        {"label": "COLUMNS", "value": f"{col_count}", "sub": "Features Analyzed"},
        {"label": "DUPLICATES", "value": f"{duplicate_count:,}", "sub": "Exact Matches"},
        {"label": "DATA QUALITY", "value": f"{quality_score}%", "sub": "Integrity Rating"},
    ]
    s2_bullets = [
        f"Total Records: {row_count:,} verified rows across {col_count} features.",
        f"Data Quality Score: {quality_score}% compliance.",
        f"Identified {duplicate_count:,} duplicate row(s) and {missing_count:,} missing cell(s).",
        f"Key Takeaway: {top_insight_text}",
    ]
    slides.append({
        "id": "slide-2",
        "type": "executive_summary",
        "title": "Executive Summary",
        "subtitle": f"High-level audit metrics and critical data synthesis for {filename}",
        "cards": s2_cards,
        "takeaway": top_insight_text,
        "bullets": s2_bullets,
        "content": s2_bullets,
    })

    # ==================== SLIDE 3: DATA OVERVIEW ====================
    s3_cards = [
        {"label": "TOTAL ROWS", "value": f"{row_count:,}", "sub": "Workbook volume"},
        {"label": "TOTAL COLUMNS", "value": f"{col_count}", "sub": "Attribute count"},
        {"label": "NUMERIC COLUMNS", "value": f"{len(num_summary)}", "sub": "Quantitative metrics"},
        {"label": "CATEGORICAL COLS", "value": f"{len(cat_summary)}", "sub": "Qualitative dimensions"},
        {"label": "MISSING CELLS", "value": f"{missing_count:,}", "sub": "Empty observations"},
        {"label": "DUPLICATE ROWS", "value": f"{duplicate_count:,}", "sub": "Redundant entries"},
    ]
    s3_bullets = [
        f"Dataset Dimension: {row_count:,} rows by {col_count} columns.",
        f"Quantitative metrics tracked: {len(num_summary)} numeric columns.",
        f"Categorical segments: {len(cat_summary)} distinct categorical columns.",
        f"Data hygiene: {missing_count:,} missing values ({quality_score}% completeness).",
        f"Duplicate detection: {duplicate_count:,} exact duplicate rows identified.",
    ]
    slides.append({
        "id": "slide-3",
        "type": "data_overview",
        "title": "Dataset Architecture & Overview",
        "subtitle": "Structural composition, schema dimensions, and hygiene metrics",
        "cards": s3_cards,
        "bullets": s3_bullets,
        "content": s3_bullets,
    })

    # ==================== SLIDE 4: KEY METRICS / DISTRIBUTION (WITH CHART) ====================
    s4_bullets = [
        f"Analyzed Dimension: {chart_info['title']}",
        chart_info["insight"],
        f"Sample Scope: Computed across {row_count:,} source records.",
        "Deterministic mathematical aggregation without sampling error.",
    ]
    slides.append({
        "id": "slide-4",
        "type": "chart",
        "title": f"Key Metrics: {chart_info['title']}",
        "subtitle": f"Deterministic distribution calculated from {filename}",
        "chart": chart_info,
        "takeaway": chart_info["insight"],
        "bullets": s4_bullets,
        "content": s4_bullets,
    })

    # ==================== SLIDE 5: DATA QUALITY ====================
    attn_count = len(missing_by_col) if missing_by_col else (1 if missing_count > 0 else 0)
    s5_bullets = [
        f"Overall Data Quality Compliance: {quality_score}%",
        f"Missing Values: {missing_count:,} cell(s) requiring remediation",
        f"Duplicate Rows: {duplicate_count:,} redundant record(s)",
        f"Columns Requiring Attention: {attn_count} feature(s)",
        "Integrity Status: " + ("Excellent Compliance" if quality_score >= 90 else "Requires Audit Hygiene Intervention"),
    ]
    slides.append({
        "id": "slide-5",
        "type": "data_quality",
        "title": "Data Quality & Integrity Assessment",
        "subtitle": "Completeness scoring, anomaly detection, and hygiene audit",
        "quality_score": quality_score,
        "missing_count": missing_count,
        "duplicate_count": duplicate_count,
        "attention_columns_count": attn_count,
        "missing_by_column": missing_by_col,
        "bullets": s5_bullets,
        "content": s5_bullets,
    })

    # ==================== SLIDE 6: KEY INSIGHTS ====================
    insight_cards = []
    if insights:
        for idx, ins in enumerate(insights[:4]):
            insight_cards.append({
                "number": f"0{idx + 1}",
                "category": ins.get("title", f"Insight {idx + 1}").upper(),
                "statement": ins.get("statement", ""),
            })
    if not insight_cards:
        insight_cards = [
            {"number": "01", "category": "VOLUME & SCOPE", "statement": f"Dataset contains {row_count:,} verified records across {col_count} structural features."},
            {"number": "02", "category": "DATA QUALITY", "statement": f"Data quality compliance is evaluated at {quality_score}% across all cell values."},
            {"number": "03", "category": "SEGMENTATION", "statement": chart_info["insight"]},
            {"number": "04", "category": "ACCURACY", "statement": "Zero hallucinations: All statistics derived from deterministic formulas."},
        ]

    s6_bullets = [f"{c['number']} {c['category']}: {c['statement']}" for c in insight_cards]
    slides.append({
        "id": "slide-6",
        "type": "insights",
        "title": "Key Strategic Insights",
        "subtitle": "Verified empirical observations calculated directly from raw data",
        "insight_cards": insight_cards,
        "bullets": s6_bullets,
        "content": s6_bullets,
    })

    # ==================== SLIDE 7: RECOMMENDATIONS ====================
    rec_cards = [
        {
            "number": "01",
            "title": "Improve Data Completeness",
            "text": f"Remediate {missing_count:,} missing observations across dataset columns to raise quality rating above 98%." if missing_count > 0 else "Maintain current schema validation standards; zero missing cell intervention required.",
        },
        {
            "number": "02",
            "title": "Review Duplicate Records",
            "text": f"Remove {duplicate_count:,} identified redundant rows to prevent analytical double-counting." if duplicate_count > 0 else "Continue automated duplicate prevention at data ingestion points.",
        },
        {
            "number": "03",
            "title": "Investigate Value Distributions",
            "text": f"Audit outliers and variance in key metric '{chart_info['column_name']}' to ensure business alignment.",
        },
        {
            "number": "04",
            "title": "Establish Automated Monitoring",
            "text": "Schedule recurring InsightDeck audit runs to detect data drift and maintain audit trail compliance.",
        },
    ]
    s7_bullets = [f"{r['number']} {r['title']}: {r['text']}" for r in rec_cards]
    slides.append({
        "id": "slide-7",
        "type": "recommendations",
        "title": "Actionable Recommendations",
        "subtitle": "Targeted remediation steps and operational guidance based on findings",
        "recommendation_cards": rec_cards,
        "bullets": s7_bullets,
        "content": s7_bullets,
    })

    # ==================== SLIDE 8: CLOSING ====================
    s8_bullets = [
        "INSIGHTDECK Analytics Platform",
        "Data → Insights → Decisions",
        f"Dataset: {filename}",
        "Audit & Analysis Complete · Thank You",
    ]
    slides.append({
        "id": "slide-8",
        "type": "closing",
        "title": "INSIGHTDECK",
        "subtitle": "Data → Insights → Decisions",
        "dataset_name": filename,
        "date_str": date_str,
        "bullets": s8_bullets,
        "content": s8_bullets,
    })

    return {
        "title": f"InsightDeck — {filename}",
        "filename": filename,
        "slides": slides,
    }


def _add_slide_background(slide):
    """Fills slide background with executive light color #F8FAFC."""
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(10), Inches(5.625))
    bg.fill.solid()
    bg.fill.fore_color.rgb = COLOR_BG
    bg.line.fill.background()
    return bg


def _add_slide_header(slide, title_text: str, subtitle_text: str, slide_num: int, total_slides: int):
    """
    Renders a sophisticated, executive light header with branding badge and clean typography.
    """
    # Small Brand Pill
    pill = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.6), Inches(0.3), Inches(1.3), Inches(0.24))
    pill.fill.solid()
    pill.fill.fore_color.rgb = COLOR_PRIMARY
    pill.line.fill.background()
    p_tf = pill.text_frame
    p_tf.word_wrap = False
    p_tf.margin_top = Inches(0.02)
    p_tf.margin_bottom = Inches(0.02)
    p_p = p_tf.paragraphs[0]
    p_p.text = "INSIGHTDECK"
    p_p.font.size = Pt(8.5)
    p_p.font.bold = True
    p_p.font.color.rgb = COLOR_WHITE
    p_p.alignment = PP_ALIGN.CENTER

    # Slide Counter
    counter_box = slide.shapes.add_textbox(Inches(7.2), Inches(0.3), Inches(2.2), Inches(0.25))
    c_tf = counter_box.text_frame
    c_tf.word_wrap = False
    c_p = c_tf.paragraphs[0]
    c_p.text = f"Slide {slide_num} of {total_slides}"
    c_p.font.size = Pt(9.5)
    c_p.font.color.rgb = COLOR_MUTED_TEXT
    c_p.alignment = PP_ALIGN.RIGHT

    # Main Title
    t_box = slide.shapes.add_textbox(Inches(0.6), Inches(0.6), Inches(8.8), Inches(0.45))
    t_tf = t_box.text_frame
    t_tf.word_wrap = True
    t_tf.margin_left = t_tf.margin_right = t_tf.margin_top = t_tf.margin_bottom = 0
    t_p = t_tf.paragraphs[0]
    t_p.text = title_text or "Slide Title"
    t_p.font.size = Pt(19)
    t_p.font.bold = True
    t_p.font.color.rgb = COLOR_DARK_TEXT
    t_p.font.name = "Calibri"

    # Subtitle
    if subtitle_text:
        s_box = slide.shapes.add_textbox(Inches(0.6), Inches(1.05), Inches(8.8), Inches(0.3))
        s_tf = s_box.text_frame
        s_tf.word_wrap = True
        s_tf.margin_left = s_tf.margin_right = s_tf.margin_top = s_tf.margin_bottom = 0
        s_p = s_tf.paragraphs[0]
        s_p.text = subtitle_text
        s_p.font.size = Pt(10.5)
        s_p.font.color.rgb = COLOR_MUTED_TEXT
        s_p.font.name = "Calibri"

    # Separator Line
    line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.6), Inches(1.38), Inches(8.8), Inches(0.015))
    line.fill.solid()
    line.fill.fore_color.rgb = COLOR_CARD_BORDER
    line.line.fill.background()


def _add_card_shape(slide, left, top, width, height, bg_color=COLOR_WHITE, border_color=COLOR_CARD_BORDER):
    """Helper to draw a rounded card container with crisp borders."""
    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    card.fill.solid()
    card.fill.fore_color.rgb = bg_color
    card.line.color.rgb = border_color
    card.line.width = Pt(1)
    return card


def generate_presentation_from_model(
    presentation_model: Dict[str, Any],
    output_path: str | Path,
) -> Dict[str, Any]:
    """
    Renders the given presentation JSON model into an executive PowerPoint (.pptx) file.
    Renders custom layouts, native charts, KPI cards, and respects all user edits.
    """
    target = Path(output_path)
    target.parent.mkdir(parents=True, exist_ok=True)

    prs = Presentation()
    prs.slide_width = Inches(10)
    prs.slide_height = Inches(5.625)
    blank_layout = prs.slide_layouts[6]

    slides = presentation_model.get("slides", [])
    filename = presentation_model.get("filename", "Dataset.xlsx")
    pres_title = presentation_model.get("title", f"InsightDeck — {filename}")
    total_slides = len(slides)

    for idx, slide_data in enumerate(slides):
        slide_num = idx + 1
        s_type = slide_data.get("type", "custom")
        s_title = slide_data.get("title", f"Slide {slide_num}")
        s_sub = slide_data.get("subtitle", "")
        raw_content = slide_data.get("bullets") or slide_data.get("content") or []
        if isinstance(raw_content, str):
            content = [line.strip() for line in raw_content.split("\n") if line.strip()]
        elif isinstance(raw_content, list):
            content = [str(item).strip() for item in raw_content if item]
        else:
            content = []

        slide = prs.slides.add_slide(blank_layout)
        _add_slide_background(slide)

        # =====================================================================
        # 1. SLIDE 1: COVER / EXECUTIVE TITLE
        # =====================================================================
        if s_type == "cover" or (idx == 0 and s_type in ["summary", "cover"]):
            # Decorative top stripe in primary #274C77
            top_bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(10), Inches(0.1))
            top_bar.fill.solid()
            top_bar.fill.fore_color.rgb = COLOR_PRIMARY
            top_bar.line.fill.background()

            # Main Executive Card
            _add_card_shape(slide, Inches(1.0), Inches(0.8), Inches(8.0), Inches(4.0))

            # Inner Brand Pill
            pill = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.5), Inches(1.2), Inches(1.6), Inches(0.32))
            pill.fill.solid()
            pill.fill.fore_color.rgb = COLOR_PRIMARY
            pill.line.fill.background()
            p_tf = pill.text_frame
            p_p = p_tf.paragraphs[0]
            p_p.text = "INSIGHTDECK"
            p_p.font.size = Pt(10)
            p_p.font.bold = True
            p_p.font.color.rgb = COLOR_WHITE
            p_p.alignment = PP_ALIGN.CENTER

            # Main Presentation Titles
            tb = slide.shapes.add_textbox(Inches(1.5), Inches(1.65), Inches(7.0), Inches(2.2))
            tf = tb.text_frame
            tf.word_wrap = True
            tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0

            p_sub_tag = tf.paragraphs[0]
            p_sub_tag.text = "EXCEL INTELLIGENCE & AUDIT ANALYTICS"
            p_sub_tag.font.size = Pt(11)
            p_sub_tag.font.bold = True
            p_sub_tag.font.color.rgb = COLOR_SECONDARY
            p_sub_tag.font.name = "Calibri"

            p_main = tf.add_paragraph()
            p_main.text = s_title if s_title != "INSIGHTDECK" else filename
            p_main.font.size = Pt(26)
            p_main.font.bold = True
            p_main.font.color.rgb = COLOR_DARK_TEXT
            p_main.font.name = "Calibri"
            p_main.space_before = Pt(6)

            p_desc = tf.add_paragraph()
            p_desc.text = s_sub or "Executive Audit & Analysis Report"
            p_desc.font.size = Pt(13)
            p_desc.font.color.rgb = COLOR_MUTED_TEXT
            p_desc.font.name = "Calibri"
            p_desc.space_before = Pt(4)

            # Accent Divider Line
            div = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.5), Inches(3.6), Inches(7.0), Inches(0.015))
            div.fill.solid()
            div.fill.fore_color.rgb = COLOR_ACCENT
            div.line.fill.background()

            # Footer / Metadata Box
            f_box = slide.shapes.add_textbox(Inches(1.5), Inches(3.75), Inches(7.0), Inches(0.8))
            f_tf = f_box.text_frame
            f_tf.word_wrap = True
            f_tf.margin_left = f_tf.margin_right = f_tf.margin_top = f_tf.margin_bottom = 0

            date_str = slide_data.get("date_str") or datetime.now().strftime("%B %d, %Y")
            p_meta = f_tf.paragraphs[0]
            p_meta.text = f"Dataset: {filename}   |   {date_str}   |   Deterministic Factual Analytics"
            p_meta.font.size = Pt(10)
            p_meta.font.color.rgb = COLOR_MUTED_TEXT
            p_meta.font.name = "Calibri"

            # If user added custom bullets to slide 1, display them
            if content and len(content) > 0 and content[0] != f"Dataset: {filename}":
                p_c = f_tf.add_paragraph()
                p_c.text = " · ".join([c.lstrip("•-* \t") for c in content[:3]])
                p_c.font.size = Pt(9.5)
                p_c.font.color.rgb = COLOR_PRIMARY
                p_c.space_before = Pt(4)

            continue

        # =====================================================================
        # STANDARD HEADER FOR SLIDES 2 THROUGH 8
        # =====================================================================
        _add_slide_header(slide, s_title, s_sub, slide_num, total_slides)

        # =====================================================================
        # 2. SLIDE 2: EXECUTIVE SUMMARY (4 KPI CARDS + KEY TAKEAWAY)
        # =====================================================================
        if s_type == "executive_summary":
            cards = slide_data.get("cards", [])
            takeaway_text = slide_data.get("takeaway", "")

            # 4 KPI Cards in a row
            card_w = Inches(2.05)
            card_h = Inches(1.3)
            gap = Inches(0.2)
            left_start = Inches(0.6)

            for c_idx, c in enumerate(cards[:4]):
                c_left = left_start + c_idx * (card_w + gap)
                c_top = Inches(1.6)
                _add_card_shape(slide, c_left, c_top, card_w, card_h)

                # Card top stripe
                c_stripe = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, c_left, c_top, card_w, Inches(0.04))
                c_stripe.fill.solid()
                c_stripe.fill.fore_color.rgb = COLOR_PRIMARY if c_idx == 0 else (COLOR_SUCCESS if c_idx == 3 else COLOR_SECONDARY)
                c_stripe.line.fill.background()

                c_tb = slide.shapes.add_textbox(c_left + Inches(0.12), c_top + Inches(0.12), card_w - Inches(0.24), card_h - Inches(0.24))
                c_tf = c_tb.text_frame
                c_tf.word_wrap = True

                p_lbl = c_tf.paragraphs[0]
                p_lbl.text = str(c.get("label", "")).upper()
                p_lbl.font.size = Pt(8.5)
                p_lbl.font.bold = True
                p_lbl.font.color.rgb = COLOR_MUTED_TEXT

                p_val = c_tf.add_paragraph()
                p_val.text = str(c.get("value", ""))
                p_val.font.size = Pt(20)
                p_val.font.bold = True
                p_val.font.color.rgb = COLOR_DARK_TEXT
                p_val.space_before = Pt(2)

                p_sub = c_tf.add_paragraph()
                p_sub.text = str(c.get("sub", ""))
                p_sub.font.size = Pt(8.5)
                p_sub.font.color.rgb = COLOR_SECONDARY

            # Large Key Takeaway Card below
            _add_card_shape(slide, Inches(0.6), Inches(3.1), Inches(8.8), Inches(2.1))

            # Left accent vertical border
            v_bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.6), Inches(3.1), Inches(0.12), Inches(2.1))
            v_bar.fill.solid()
            v_bar.fill.fore_color.rgb = COLOR_PRIMARY
            v_bar.line.fill.background()

            t_box = slide.shapes.add_textbox(Inches(0.9), Inches(3.25), Inches(8.3), Inches(1.8))
            t_tf = t_box.text_frame
            t_tf.word_wrap = True

            p_tag = t_tf.paragraphs[0]
            p_tag.text = "KEY TAKEAWAY & SYNTHESIS"
            p_tag.font.size = Pt(10)
            p_tag.font.bold = True
            p_tag.font.color.rgb = COLOR_PRIMARY

            # Render edited bullets if user edited them, otherwise render takeaway
            if content and len(content) > 0:
                for line in content[:4]:
                    p_c = t_tf.add_paragraph()
                    clean_l = line.lstrip("•-* \t")
                    p_c.text = f"•  {clean_l}"
                    p_c.font.size = Pt(11)
                    p_c.font.color.rgb = COLOR_DARK_TEXT
                    p_c.space_before = Pt(4)
            else:
                p_take = t_tf.add_paragraph()
                p_take.text = takeaway_text or "All records analyzed deterministically without estimation."
                p_take.font.size = Pt(12)
                p_take.font.color.rgb = COLOR_DARK_TEXT
                p_take.space_before = Pt(6)

            continue

        # =====================================================================
        # 3. SLIDE 3: DATA OVERVIEW (6 COMPACT INFOGRAPHIC CARDS)
        # =====================================================================
        if s_type == "data_overview":
            cards = slide_data.get("cards", [])
            # If user customized bullets significantly, render bullets
            is_custom_edited = len(content) > 0 and any("Total" not in c for c in content)

            if is_custom_edited:
                _add_card_shape(slide, Inches(0.6), Inches(1.6), Inches(8.8), Inches(3.6))
                tb = slide.shapes.add_textbox(Inches(0.9), Inches(1.8), Inches(8.2), Inches(3.2))
                tf = tb.text_frame
                tf.word_wrap = True
                for c_idx, line in enumerate(content[:7]):
                    p = tf.paragraphs[0] if c_idx == 0 else tf.add_paragraph()
                    p.text = f"•  {line.lstrip('•-* \t')}"
                    p.font.size = Pt(12)
                    p.font.color.rgb = COLOR_DARK_TEXT
                    p.space_after = Pt(6)
            else:
                grid_w = Inches(2.8)
                grid_h = Inches(1.6)
                gap_x = Inches(0.2)
                gap_y = Inches(0.25)
                start_x = Inches(0.6)
                start_y = Inches(1.6)

                for c_idx, c in enumerate(cards[:6]):
                    col_idx = c_idx % 3
                    row_idx = c_idx // 3
                    c_left = start_x + col_idx * (grid_w + gap_x)
                    c_top = start_y + row_idx * (grid_h + gap_y)

                    _add_card_shape(slide, c_left, c_top, grid_w, grid_h)

                    # Top accent bar on each card
                    t_bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, c_left, c_top, grid_w, Inches(0.04))
                    t_bar.fill.solid()
                    t_bar.fill.fore_color.rgb = COLOR_PRIMARY if row_idx == 0 else COLOR_SECONDARY
                    t_bar.line.fill.background()

                    tb = slide.shapes.add_textbox(c_left + Inches(0.15), c_top + Inches(0.15), grid_w - Inches(0.3), grid_h - Inches(0.3))
                    tf = tb.text_frame
                    tf.word_wrap = True

                    p_l = tf.paragraphs[0]
                    p_l.text = str(c.get("label", "")).upper()
                    p_l.font.size = Pt(9)
                    p_l.font.bold = True
                    p_l.font.color.rgb = COLOR_MUTED_TEXT

                    p_v = tf.add_paragraph()
                    p_v.text = str(c.get("value", ""))
                    p_v.font.size = Pt(22)
                    p_v.font.bold = True
                    p_v.font.color.rgb = COLOR_DARK_TEXT
                    p_v.space_before = Pt(2)

                    p_s = tf.add_paragraph()
                    p_s.text = str(c.get("sub", ""))
                    p_s.font.size = Pt(9)
                    p_s.font.color.rgb = COLOR_SECONDARY
            continue

        # =====================================================================
        # 4. SLIDE 4: KEY METRICS / DISTRIBUTION (ACTUAL NATIVE CHART)
        # =====================================================================
        if s_type == "chart":
            chart_dict = slide_data.get("chart", {})
            chart_type_str = chart_dict.get("chart_type", "column")
            categories = chart_dict.get("categories", ["A", "B", "C"])
            series_list = chart_dict.get("series", [{"name": "Values", "values": [10, 20, 30]}])

            # Prepare native CategoryChartData
            chart_data_obj = CategoryChartData()
            chart_data_obj.categories = categories
            for s in series_list:
                s_name = s.get("name", "Metric")
                s_vals = tuple(float(v) for v in s.get("values", []))
                chart_data_obj.add_series(s_name, s_vals)

            # Map chart type to python-pptx enum
            if chart_type_str == "bar":
                ppt_chart_type = XL_CHART_TYPE.BAR_CLUSTERED
            elif chart_type_str == "doughnut":
                ppt_chart_type = XL_CHART_TYPE.DOUGHNUT
            elif chart_type_str == "line":
                ppt_chart_type = XL_CHART_TYPE.LINE
            else:
                ppt_chart_type = XL_CHART_TYPE.COLUMN_CLUSTERED

            # Left Chart Container Card
            _add_card_shape(slide, Inches(0.6), Inches(1.55), Inches(5.6), Inches(3.7))

            # Native PowerPoint Chart Object
            try:
                chart_shape = slide.shapes.add_chart(
                    ppt_chart_type,
                    Inches(0.7), Inches(1.65), Inches(5.4), Inches(3.5),
                    chart_data_obj,
                )
                chart = chart_shape.chart
                chart.has_legend = (chart_type_str == "doughnut" or len(series_list) > 1)
            except Exception as e:
                # Fallback if chart shape errors
                fb_box = slide.shapes.add_textbox(Inches(0.8), Inches(2.0), Inches(5.2), Inches(3.0))
                fb_tf = fb_box.text_frame
                fb_tf.word_wrap = True
                p = fb_tf.paragraphs[0]
                p.text = f"Distribution: {', '.join([f'{c}: {v}' for c, v in zip(categories, series_list[0].get('values', []))])}"
                p.font.size = Pt(12)
                p.font.color.rgb = COLOR_DARK_TEXT

            # Right Summary Card
            _add_card_shape(slide, Inches(6.4), Inches(1.55), Inches(3.0), Inches(3.7))
            r_top_bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(6.4), Inches(1.55), Inches(3.0), Inches(0.04))
            r_top_bar.fill.solid()
            r_top_bar.fill.fore_color.rgb = COLOR_PRIMARY
            r_top_bar.line.fill.background()

            r_tb = slide.shapes.add_textbox(Inches(6.55), Inches(1.7), Inches(2.7), Inches(3.4))
            r_tf = r_tb.text_frame
            r_tf.word_wrap = True

            p_rt = r_tf.paragraphs[0]
            p_rt.text = "DISTRIBUTION INSIGHT"
            p_rt.font.size = Pt(9.5)
            p_rt.font.bold = True
            p_rt.font.color.rgb = COLOR_PRIMARY

            # Render custom bullets or default takeaway
            if content:
                for line in content[:5]:
                    p = r_tf.add_paragraph()
                    p.text = f"• {line.lstrip('•-* \t')}"
                    p.font.size = Pt(10)
                    p.font.color.rgb = COLOR_DARK_TEXT
                    p.space_before = Pt(4)
            else:
                p_it = r_tf.add_paragraph()
                p_it.text = chart_dict.get("insight", "Aggregated metric breakdown computed from workbook data.")
                p_it.font.size = Pt(11)
                p_it.font.color.rgb = COLOR_DARK_TEXT
                p_it.space_before = Pt(6)

            continue

        # =====================================================================
        # 5. SLIDE 5: DATA QUALITY & INTEGRITY
        # =====================================================================
        if s_type == "data_quality":
            q_score = float(slide_data.get("quality_score", 100))
            missing_val = slide_data.get("missing_count", 0)
            dup_val = slide_data.get("duplicate_count", 0)
            attn_val = slide_data.get("attention_columns_count", 0)

            # Left Big Quality Score Card
            _add_card_shape(slide, Inches(0.6), Inches(1.55), Inches(4.2), Inches(3.7))
            l_top = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.6), Inches(1.55), Inches(4.2), Inches(0.04))
            l_top.fill.solid()
            l_top.fill.fore_color.rgb = COLOR_SUCCESS if q_score >= 90 else COLOR_WARNING
            l_top.line.fill.background()

            tb_q = slide.shapes.add_textbox(Inches(0.9), Inches(1.75), Inches(3.6), Inches(3.3))
            tf_q = tb_q.text_frame
            tf_q.word_wrap = True

            p0 = tf_q.paragraphs[0]
            p0.text = "DATA QUALITY SCORE"
            p0.font.size = Pt(10)
            p0.font.bold = True
            p0.font.color.rgb = COLOR_MUTED_TEXT

            p_sc = tf_q.add_paragraph()
            p_sc.text = f"{q_score}%"
            p_sc.font.size = Pt(40)
            p_sc.font.bold = True
            p_sc.font.color.rgb = COLOR_SUCCESS if q_score >= 90 else COLOR_WARNING
            p_sc.space_before = Pt(4)

            # Visual progress bar shapes
            bar_bg = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.9), Inches(2.95), Inches(3.6), Inches(0.2))
            bar_bg.fill.solid()
            bar_bg.fill.fore_color.rgb = COLOR_CARD_BORDER
            bar_bg.line.fill.background()

            fill_w = max(0.1, min(3.6, 3.6 * (q_score / 100.0)))
            bar_fill = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.9), Inches(2.95), Inches(fill_w), Inches(0.2))
            bar_fill.fill.solid()
            bar_fill.fill.fore_color.rgb = COLOR_SUCCESS if q_score >= 90 else COLOR_WARNING
            bar_fill.line.fill.background()

            tb_desc = slide.shapes.add_textbox(Inches(0.9), Inches(3.3), Inches(3.6), Inches(1.8))
            tf_desc = tb_desc.text_frame
            tf_desc.word_wrap = True
            p_st = tf_desc.paragraphs[0]
            p_st.text = "STATUS: " + ("EXCELLENT HYGIENE" if q_score >= 90 else "REVIEW RECOMMENDED")
            p_st.font.size = Pt(9.5)
            p_st.font.bold = True
            p_st.font.color.rgb = COLOR_SUCCESS if q_score >= 90 else COLOR_WARNING

            p_exp = tf_desc.add_paragraph()
            p_exp.text = "Score combines completeness evaluation across all cells and duplicate row deductions."
            p_exp.font.size = Pt(9.5)
            p_exp.font.color.rgb = COLOR_MUTED_TEXT
            p_exp.space_before = Pt(4)

            # Right 3 Stat Cards
            right_w = Inches(4.3)
            right_h = Inches(1.1)
            right_x = Inches(5.1)

            stats_meta = [
                ("MISSING VALUES", f"{missing_val:,} cells", COLOR_PRIMARY),
                ("DUPLICATE ROWS", f"{dup_val:,} records", COLOR_SECONDARY),
                ("COLUMNS NEEDING ATTENTION", f"{attn_val} column(s)", COLOR_WARNING if attn_val > 0 else COLOR_SUCCESS),
            ]

            for s_idx, (s_label, s_val, s_col) in enumerate(stats_meta):
                s_top = Inches(1.55) + s_idx * Inches(1.3)
                _add_card_shape(slide, right_x, s_top, right_w, right_h)

                # Left indicator bar
                bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, right_x, s_top, Inches(0.08), right_h)
                bar.fill.solid()
                bar.fill.fore_color.rgb = s_col
                bar.line.fill.background()

                s_tb = slide.shapes.add_textbox(right_x + Inches(0.2), s_top + Inches(0.12), right_w - Inches(0.3), right_h - Inches(0.24))
                s_tf = s_tb.text_frame
                s_tf.word_wrap = True

                p_sl = s_tf.paragraphs[0]
                p_sl.text = s_label
                p_sl.font.size = Pt(9)
                p_sl.font.bold = True
                p_sl.font.color.rgb = COLOR_MUTED_TEXT

                p_sv = s_tf.add_paragraph()
                p_sv.text = s_val
                p_sv.font.size = Pt(18)
                p_sv.font.bold = True
                p_sv.font.color.rgb = COLOR_DARK_TEXT
                p_sv.space_before = Pt(2)

            continue

        # =====================================================================
        # 6. SLIDE 6: KEY INSIGHTS (3-4 STRUCTURED INSIGHT CARDS)
        # =====================================================================
        if s_type == "insights":
            insight_cards = slide_data.get("insight_cards", [])
            # If user customized bullets, parse them into insight cards
            if content and (not insight_cards or len(content) != len(insight_cards)):
                insight_cards = []
                for c_idx, line in enumerate(content[:4]):
                    parts = line.split(":", 1)
                    if len(parts) == 2:
                        cat_str = parts[0].lstrip("•-* 0123456789\t ").strip()
                        stmt_str = parts[1].strip()
                    else:
                        cat_str = f"FINDING 0{c_idx + 1}"
                        stmt_str = line.lstrip("•-* \t ").strip()
                    insight_cards.append({
                        "number": f"0{c_idx + 1}",
                        "category": cat_str.upper(),
                        "statement": stmt_str,
                    })

            # Render 4 cards in a 2x2 grid
            card_w = Inches(4.25)
            card_h = Inches(1.7)
            start_x = Inches(0.6)
            start_y = Inches(1.6)
            gap_x = Inches(0.3)
            gap_y = Inches(0.25)

            for c_idx, card_info in enumerate(insight_cards[:4]):
                col_i = c_idx % 2
                row_i = c_idx // 2
                c_left = start_x + col_i * (card_w + gap_x)
                c_top = start_y + row_i * (card_h + gap_y)

                _add_card_shape(slide, c_left, c_top, card_w, card_h)

                # Number Badge
                badge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, c_left + Inches(0.18), c_top + Inches(0.18), Inches(0.4), Inches(0.3))
                badge.fill.solid()
                badge.fill.fore_color.rgb = COLOR_PRIMARY
                badge.line.fill.background()
                b_tf = badge.text_frame
                b_p = b_tf.paragraphs[0]
                b_p.text = card_info.get("number", f"0{c_idx + 1}")
                b_p.font.size = Pt(9.5)
                b_p.font.bold = True
                b_p.font.color.rgb = COLOR_WHITE
                b_p.alignment = PP_ALIGN.CENTER

                # Card Text Box
                tb = slide.shapes.add_textbox(c_left + Inches(0.7), c_top + Inches(0.15), card_w - Inches(0.85), card_h - Inches(0.3))
                tf = tb.text_frame
                tf.word_wrap = True

                p_cat = tf.paragraphs[0]
                p_cat.text = card_info.get("category", "OBSERVATION").upper()
                p_cat.font.size = Pt(9.5)
                p_cat.font.bold = True
                p_cat.font.color.rgb = COLOR_SECONDARY

                p_stmt = tf.add_paragraph()
                p_stmt.text = card_info.get("statement", "")
                p_stmt.font.size = Pt(10.5)
                p_stmt.font.color.rgb = COLOR_DARK_TEXT
                p_stmt.space_before = Pt(3)

            continue

        # =====================================================================
        # 7. SLIDE 7: RECOMMENDATIONS (4 NUMBERED ACTION CARDS)
        # =====================================================================
        if s_type == "recommendations":
            recs = slide_data.get("recommendation_cards", [])
            if content and (not recs or len(content) != len(recs)):
                recs = []
                for c_idx, line in enumerate(content[:4]):
                    parts = line.split(":", 1)
                    t_str = parts[0].lstrip("•-* 0123456789\t ").strip()
                    desc_str = parts[1].strip() if len(parts) > 1 else ""
                    recs.append({
                        "number": f"0{c_idx + 1}",
                        "title": t_str,
                        "text": desc_str,
                    })

            card_w = Inches(4.25)
            card_h = Inches(1.7)
            start_x = Inches(0.6)
            start_y = Inches(1.6)
            gap_x = Inches(0.3)
            gap_y = Inches(0.25)

            for c_idx, rec_info in enumerate(recs[:4]):
                col_i = c_idx % 2
                row_i = c_idx // 2
                c_left = start_x + col_i * (card_w + gap_x)
                c_top = start_y + row_i * (card_h + gap_y)

                _add_card_shape(slide, c_left, c_top, card_w, card_h)

                # Left accent bar
                bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, c_left, c_top, Inches(0.08), card_h)
                bar.fill.solid()
                bar.fill.fore_color.rgb = COLOR_PRIMARY if c_idx % 2 == 0 else COLOR_SECONDARY
                bar.line.fill.background()

                tb = slide.shapes.add_textbox(c_left + Inches(0.25), c_top + Inches(0.15), card_w - Inches(0.35), card_h - Inches(0.3))
                tf = tb.text_frame
                tf.word_wrap = True

                p_num = tf.paragraphs[0]
                p_num.text = f"{rec_info.get('number', f'0{c_idx + 1}')}  ·  {rec_info.get('title', 'Recommendation')}"
                p_num.font.size = Pt(11)
                p_num.font.bold = True
                p_num.font.color.rgb = COLOR_PRIMARY

                p_desc = tf.add_paragraph()
                p_desc.text = rec_info.get("text", "")
                p_desc.font.size = Pt(10)
                p_desc.font.color.rgb = COLOR_DARK_TEXT
                p_desc.space_before = Pt(4)

            continue

        # =====================================================================
        # 8. SLIDE 8: CLOSING SLIDE
        # =====================================================================
        if s_type == "closing":
            _add_card_shape(slide, Inches(1.5), Inches(1.2), Inches(7.0), Inches(3.6))

            # Top stripe
            stripe = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.5), Inches(1.2), Inches(7.0), Inches(0.08))
            stripe.fill.solid()
            stripe.fill.fore_color.rgb = COLOR_PRIMARY
            stripe.line.fill.background()

            tb = slide.shapes.add_textbox(Inches(2.0), Inches(1.6), Inches(6.0), Inches(2.8))
            tf = tb.text_frame
            tf.word_wrap = True

            p0 = tf.paragraphs[0]
            p0.text = "INSIGHTDECK"
            p0.font.size = Pt(14)
            p0.font.bold = True
            p0.font.color.rgb = COLOR_PRIMARY
            p0.alignment = PP_ALIGN.CENTER

            p1 = tf.add_paragraph()
            p1.text = "Data → Insights → Decisions"
            p1.font.size = Pt(18)
            p1.font.bold = True
            p1.font.color.rgb = COLOR_SECONDARY
            p1.space_before = Pt(6)
            p1.alignment = PP_ALIGN.CENTER

            p2 = tf.add_paragraph()
            p2.text = f"Dataset: {filename}"
            p2.font.size = Pt(12)
            p2.font.color.rgb = COLOR_MUTED_TEXT
            p2.space_before = Pt(10)
            p2.alignment = PP_ALIGN.CENTER

            p3 = tf.add_paragraph()
            p3.text = "Audit & Analysis Complete  ·  Thank You"
            p3.font.size = Pt(16)
            p3.font.bold = True
            p3.font.color.rgb = COLOR_DARK_TEXT
            p3.space_before = Pt(8)
            p3.alignment = PP_ALIGN.CENTER

            continue

        # =====================================================================
        # CUSTOM USER-ADDED OR GENERIC SLIDES
        # =====================================================================
        _add_card_shape(slide, Inches(0.6), Inches(1.55), Inches(8.8), Inches(3.7))
        tb = slide.shapes.add_textbox(Inches(0.9), Inches(1.75), Inches(8.2), Inches(3.3))
        tf = tb.text_frame
        tf.word_wrap = True

        if content:
            for c_idx, line in enumerate(content):
                p = tf.paragraphs[0] if c_idx == 0 else tf.add_paragraph()
                clean_line = line.lstrip("•-* \t")
                p.text = f"•  {clean_line}"
                p.font.size = Pt(12)
                p.font.color.rgb = COLOR_DARK_TEXT
                p.font.name = "Calibri"
                p.space_after = Pt(8)
        else:
            p = tf.paragraphs[0]
            p.text = "No content on this slide. Use the editor to add bullets."
            p.font.size = Pt(11)
            p.font.color.rgb = COLOR_MUTED_TEXT

    prs.save(str(target))

    return {
        "status": "success",
        "title": pres_title,
        "slide_count": len(prs.slides),
        "target_file": str(target),
        "filename": target.name,
        "message": f"Successfully generated {len(prs.slides)}-slide executive presentation deck.",
    }


def generate_presentation(
    analysis_data: Dict[str, Any],
    insights: List[Dict[str, Any]],
    output_path: str | Path,
    filename: Optional[str] = "Dataset.xlsx",
) -> Dict[str, Any]:
    """Builds model and renders directly to PPTX (for backwards compatibility)."""
    model = build_presentation_model(analysis_data, insights, filename)
    return generate_presentation_from_model(model, output_path)
