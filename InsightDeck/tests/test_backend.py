"""
Comprehensive automated tests for InsightDeck Backend.
Tests:
- GET / (Welcome)
- GET /health (Health status)
- POST /upload (Validation, safe saving, analysis)
- GET /report (Data flow from analysis to structured report)
- POST /generate-presentation (python-pptx generation)
- GET /download/presentation (PowerPoint file download)
- pptx structure & integrity verification
"""

import io
from pathlib import Path
import numpy as np
import pandas as pd
import pptx
import pytest
from fastapi.testclient import TestClient

import sys
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from main import app, active_dataset_state
from excel_processor import process_excel_file
from analyzer import analyze_dataset
from insights import generate_factual_insights
from presentation import generate_presentation

client = TestClient(app)


def create_sample_excel_bytes() -> bytes:
    """Helper to generate an in-memory sample Excel workbook."""
    df = pd.DataFrame({
        "TransactionID": [101, 102, 103, 104, 105, 106],
        "Region": ["North", "South", "East", "West", "North", "South"],
        "Revenue": [1500.0, 2200.5, 3100.0, 1850.25, 2900.0, 4100.75],
        "UnitsSold": [15, 22, 30, 18, 28, 42],
        "CustomerRating": [4.5, 4.8, 3.9, 4.2, 5.0, 4.6],
    })
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="SalesData")
    return output.getvalue()


def extract_slide_text(slide) -> str:
    """Helper to extract text from shapes, textboxes, and tables in a slide."""
    texts = []
    for shape in slide.shapes:
        if shape.has_text_frame:
            texts.append(shape.text_frame.text)
        if shape.has_table:
            for row in shape.table.rows:
                for cell in row.cells:
                    texts.append(cell.text)
    return " ".join(texts)


def test_root_and_health():
    """Verify GET / and GET /health."""
    r_root = client.get("/")
    assert r_root.status_code == 200
    assert r_root.json() == {"message": "Welcome to InsightDeck API"}

    r_health = client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json() == {"status": "healthy"}


def test_upload_and_pipeline():
    """Verify complete upload -> analysis -> report -> pptx generation -> download pipeline."""
    excel_bytes = create_sample_excel_bytes()
    file_payload = io.BytesIO(excel_bytes)

    # 1. Upload
    response = client.post(
        "/upload",
        files={"file": ("audit_sales_q3.xlsx", file_payload, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["filename"] == "audit_sales_q3.xlsx"
    assert data["status"] == "uploaded"
    assert data["details"]["row_count"] == 6
    assert data["details"]["column_count"] == 5

    # 2. Get Report
    r_report = client.get("/report")
    assert r_report.status_code == 200
    rep = r_report.json()
    assert rep["filename"] == "audit_sales_q3.xlsx"
    assert rep["summary"]["records"] == 6
    assert rep["summary"]["columns"] == 5
    assert rep["summary"]["missing_values"] == 0
    assert rep["summary"]["duplicates"] == 0
    assert "total_revenue" in rep["kpis"]
    assert rep["kpis"]["total_revenue"] > 10000
    assert len(rep["insights"]) >= 3

    # 3. Generate Presentation (Returns binary PPTX FileResponse)
    r_ppt = client.post("/generate-presentation")
    assert r_ppt.status_code == 200
    assert "presentationml.presentation" in r_ppt.headers["content-type"]
    assert len(r_ppt.content) > 1000

    # 4. Download Presentation endpoint
    r_down = client.get("/download/presentation")
    assert r_down.status_code == 200
    assert "presentationml.presentation" in r_down.headers["content-type"]
    assert len(r_down.content) > 1000  # Non-empty binary PPTX

    # 5. Verify PPTX integrity using python-pptx
    prs = pptx.Presentation(io.BytesIO(r_ppt.content))
    assert len(prs.slides) == 8

    slide1_text = extract_slide_text(prs.slides[0])
    assert "INSIGHTDECK" in slide1_text or "InsightDeck" in slide1_text
    assert "audit_sales_q3.xlsx" in slide1_text

    slide2_text = extract_slide_text(prs.slides[1])
    assert "Executive Summary" in slide2_text
    assert "RECORDS" in slide2_text

    slide3_text = extract_slide_text(prs.slides[2])
    assert "Overview" in slide3_text

    slide4_text = extract_slide_text(prs.slides[3])
    assert "Key Metrics" in slide4_text or "Distribution" in slide4_text

    slide5_text = extract_slide_text(prs.slides[4])
    assert "Quality" in slide5_text

    slide6_text = extract_slide_text(prs.slides[5])
    assert "Insights" in slide6_text

    slide7_text = extract_slide_text(prs.slides[6])
    assert "Recommendations" in slide7_text

    slide8_text = extract_slide_text(prs.slides[7])
    assert "INSIGHTDECK" in slide8_text


def test_report_and_presentation_without_data():
    """Verify handling when no dataset is loaded."""
    # Reset state
    active_dataset_state["analysis_result"] = None
    active_dataset_state["filename"] = None
    active_dataset_state["presentation_model"] = None
    active_dataset_state["last_generated_presentation"] = None

    r_report = client.get("/report")
    assert r_report.status_code == 404

    r_ppt = client.post("/generate-presentation")
    assert r_ppt.status_code == 400
    assert "Please upload and analyze an Excel file first." in r_ppt.json()["detail"]


def test_generate_custom_edited_presentation():
    """Verify that user-edited presentation JSON creates a PPTX containing the exact edits."""
    custom_model = {
        "title": "Quarterly Financial Analysis",
        "filename": "Q3_Report.xlsx",
        "slides": [
            {
                "id": "slide-1",
                "title": "Q3 Executive Review",
                "subtitle": "Edited subtitle for demo",
                "bullets": [
                    "Total Revenue: $2,450,000",
                    "Net Margin: 18.4%",
                    "Compliance: 100% verified"
                ]
            },
            {
                "id": "slide-2",
                "title": "Key Edited Metrics",
                "subtitle": "Quantitative summary",
                "bullets": [
                    "Transaction Count: 14,200",
                    "Average Basket: $172.50"
                ]
            },
            {
                "id": "slide-3",
                "title": "Newly Added Slide",
                "subtitle": "Created by user",
                "bullets": [
                    "Action item 1: Approve Q4 budget",
                    "Action item 2: Deploy automation pipeline"
                ]
            }
        ]
    }

    # Post user-edited presentation JSON directly
    response = client.post(
        "/generate-presentation",
        json={"presentation": custom_model}
    )
    assert response.status_code == 200
    assert "presentationml.presentation" in response.headers["content-type"]
    assert len(response.content) > 1000

    # Parse with python-pptx and verify all edited texts exist in the slides
    prs = pptx.Presentation(io.BytesIO(response.content))
    assert len(prs.slides) == 3

    slide1_text = extract_slide_text(prs.slides[0])
    assert "Q3 Executive Review" in slide1_text
    assert "Total Revenue: $2,450,000" in slide1_text

    slide2_text = extract_slide_text(prs.slides[1])
    assert "Key Edited Metrics" in slide2_text
    assert "Average Basket: $172.50" in slide2_text

    slide3_text = extract_slide_text(prs.slides[2])
    assert "Newly Added Slide" in slide3_text
    assert "Action item 1: Approve Q4 budget" in slide3_text


def test_firebase_auth_user_isolation():
    """Verify that different Firebase UIDs have strictly isolated uploads and data."""
    excel_bytes = create_sample_excel_bytes()

    token_user_a = "mock-token-user_alpha"
    token_user_b = "mock-token-user_beta"

    # User A uploads a dataset
    r_up_a = client.post(
        "/upload",
        files={"file": ("alpha_sales.xlsx", io.BytesIO(excel_bytes), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"Authorization": f"Bearer {token_user_a}"}
    )
    assert r_up_a.status_code == 201
    assert r_up_a.json()["filename"] == "alpha_sales.xlsx"

    # User A can access report
    r_rep_a = client.get("/report", headers={"Authorization": f"Bearer {token_user_a}"})
    assert r_rep_a.status_code == 200
    assert r_rep_a.json()["filename"] == "alpha_sales.xlsx"

    # User B has NOT uploaded a dataset -> User B must receive 404
    r_rep_b = client.get("/report", headers={"Authorization": f"Bearer {token_user_b}"})
    assert r_rep_b.status_code == 404

    # User A generates presentation -> output is stored in User A's isolated directory
    r_gen_a = client.post(
        "/generate-presentation",
        headers={"Authorization": f"Bearer {token_user_a}"}
    )
    assert r_gen_a.status_code == 200
    assert "presentationml.presentation" in r_gen_a.headers["content-type"]

    # User B cannot download User A's presentation
    r_down_b = client.get("/presentation/download", headers={"Authorization": f"Bearer {token_user_b}"})
    assert r_down_b.status_code == 404


