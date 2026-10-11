"""
Main FastAPI Application for InsightDeck Backend.
Provides endpoints for:
- Health check
- Excel file upload & deterministic analysis
- Audit reporting & KPIs
- Data-aware deterministic chatbot
- Structured Presentation model management & user editing
- High-fidelity PowerPoint (.pptx) file generation and direct binary download
- Firebase Authentication verification & secure per-user storage isolation
"""

import logging
import os
from pathlib import Path
import shutil
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from analyzer import analyze_dataset
from auth_helper import get_authenticated_user_id
from chatbot import process_chat_message
from excel_processor import process_excel_file
from insights import generate_factual_insights
from presentation import (
    build_presentation_model,
    generate_presentation_from_model,
)

# Logging Setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("insightdeck")

# Directories Setup
BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"
OUTPUTS_DIR = BASE_DIR / "outputs"

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="InsightDeck Backend API",
    description="Enterprise-grade deterministic Excel intelligence, reporting, presentation, and audit engine.",
    version="2.0.0",
)

# CORS Configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# Isolated per-user state storage (indexed by verified Firebase UID)
user_dataset_states: Dict[str, Dict[str, Any]] = {}


def get_user_state(uid: str) -> Dict[str, Any]:
    """Retrieves or creates the isolated state for a specific authenticated user."""
    if uid not in user_dataset_states:
        user_dataset_states[uid] = {
            "filename": None,
            "file_path": None,
            "processor_result": None,
            "analysis_result": None,
            "insights": None,
            "presentation_model": None,
            "last_generated_presentation": None,
        }
    return user_dataset_states[uid]


# Backward-compatibility alias for tests and default operations
class ActiveStateProxy(dict):
    """Proxy dictionary mapping to default_user state for legacy tests."""
    def __getitem__(self, key):
        return get_user_state("default_user").get(key)

    def __setitem__(self, key, value):
        get_user_state("default_user")[key] = value

    def get(self, key, default=None):
        return get_user_state("default_user").get(key, default)


active_dataset_state = ActiveStateProxy()


def get_user_uploads_dir(uid: str) -> Path:
    """Returns the dedicated upload directory for the authenticated user."""
    user_dir = UPLOADS_DIR / uid
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir


def get_user_outputs_dir(uid: str) -> Path:
    """Returns the dedicated outputs directory for the authenticated user."""
    user_dir = OUTPUTS_DIR / uid
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir


class ChatRequest(BaseModel):
    message: str


class PresentationSaveRequest(BaseModel):
    title: Optional[str] = "InsightDeck Presentation"
    filename: Optional[str] = "Dataset.xlsx"
    slides: List[Dict[str, Any]]


@app.get("/", tags=["System"])
def root() -> Dict[str, str]:
    """Root endpoint welcoming users to the InsightDeck API."""
    return {"message": "Welcome to InsightDeck API"}


@app.get("/health", tags=["System"])
def health_check() -> Dict[str, str]:
    """Health status check endpoint."""
    return {"status": "healthy"}


@app.post("/upload", tags=["Excel Operations"], status_code=status.HTTP_201_CREATED)
async def upload_excel(request: Request, file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Accepts an Excel (.xlsx) file, verifies extension, saves it in user-isolated uploads/{uid}/,
    computes deterministic metadata, analysis, and insights, and initializes presentation model.
    """
    uid = get_authenticated_user_id(request)
    state = get_user_state(uid)
    user_uploads = get_user_uploads_dir(uid)

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided in upload payload.",
        )

    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. InsightDeck currently requires .xlsx Excel files.",
        )

    safe_filename = Path(file.filename).name
    destination_path = user_uploads / safe_filename

    try:
        with destination_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info(f"User [{uid}] saved uploaded source file to {destination_path}")
    except Exception as exc:
        logger.error(f"Failed to save uploaded file for user [{uid}]: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save uploaded file: {str(exc)}",
        ) from exc
    finally:
        file.file.close()

    try:
        processor_result = process_excel_file(destination_path)
        analysis_result = analyze_dataset(destination_path)
        insights_result = generate_factual_insights(analysis_result)
        presentation_model = build_presentation_model(analysis_result, insights_result, safe_filename)

        # Update isolated user state
        state["filename"] = safe_filename
        state["file_path"] = str(destination_path)
        state["processor_result"] = processor_result
        state["analysis_result"] = analysis_result
        state["insights"] = insights_result
        state["presentation_model"] = presentation_model
        state["last_generated_presentation"] = None
        logger.info(f"User [{uid}] successfully processed dataset: {safe_filename}")

    except Exception as exc:
        logger.error(f"Analysis pipeline error for user [{uid}] on {safe_filename}: {exc}", exc_info=True)
        return {
            "filename": safe_filename,
            "status": "uploaded",
            "message": "File uploaded successfully, but preview parsing encountered an issue.",
            "error_detail": str(exc),
        }

    return {
        "filename": safe_filename,
        "status": "uploaded",
        "message": "File uploaded successfully",
        "details": {
            "row_count": processor_result.get("row_count", 0),
            "column_count": processor_result.get("column_count", 0),
            "sheets": processor_result.get("sheet_names", []),
            "active_sheet": processor_result.get("active_sheet"),
            "columns": processor_result.get("columns", []),
            "dtypes": processor_result.get("dtypes", {}),
            "missing_values": processor_result.get("missing_values", {}),
            "duplicate_rows": processor_result.get("duplicate_rows", 0),
            "sample_rows": processor_result.get("sample_rows", []),
            "numeric_summary": analysis_result.get("numeric_summary", {}),
            "categorical_summary": analysis_result.get("categorical_summary", {}),
            "data_quality": analysis_result.get("data_quality", {}),
        },
        "insights": insights_result,
        "presentation": presentation_model,
    }


@app.get("/report", tags=["Reporting"])
def get_report(request: Request) -> Dict[str, Any]:
    """
    Returns structured audit report and KPIs based on the authenticated user's active dataset.
    """
    uid = get_authenticated_user_id(request)
    state = get_user_state(uid)

    if not state.get("analysis_result"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No dataset has been uploaded or analyzed yet. Please upload an Excel file first.",
        )

    filename = state.get("filename")
    analysis = state.get("analysis_result")
    insights = state.get("insights") or []
    dims = analysis.get("dimensions", {})
    dq = analysis.get("data_quality", {})
    num_summary = analysis.get("numeric_summary", {})

    kpis = {}
    for col_name, stats in num_summary.items():
        kpis[f"total_{col_name.lower()}"] = stats.get("total", 0)
        kpis[f"average_{col_name.lower()}"] = stats.get("average", 0)

    insight_statements = [ins.get("statement", "") for ins in insights if ins.get("statement")]

    return {
        "filename": filename,
        "summary": {
            "records": dims.get("row_count", 0),
            "columns": dims.get("column_count", 0),
            "missing_values": dq.get("missing_values", 0),
            "duplicates": dq.get("duplicate_rows", 0),
            "data_quality_score": dq.get("quality_score", 100.0),
        },
        "kpis": kpis,
        "insights": insight_statements,
        "structured_insights": insights,
        "numeric_summary": num_summary,
        "categorical_summary": analysis.get("categorical_summary", {}),
    }


@app.post("/chat", tags=["Chatbot"])
def chat(request: Request, chat_req: ChatRequest) -> Dict[str, Any]:
    """
    Data-aware conversational endpoint.
    Answers natural language queries using the authenticated user's active dataset context.
    """
    uid = get_authenticated_user_id(request)
    state = get_user_state(uid)

    result = process_chat_message(
        message=chat_req.message,
        analysis_data=state.get("analysis_result"),
        insights=state.get("insights"),
        filename=state.get("filename"),
    )
    return result


@app.get("/presentation", tags=["Presentation Editor"])
def get_presentation(request: Request) -> Dict[str, Any]:
    """
    Retrieves the structured presentation JSON model for the authenticated user's active dataset.
    """
    uid = get_authenticated_user_id(request)
    state = get_user_state(uid)

    if state.get("presentation_model"):
        return state["presentation_model"]

    if state.get("analysis_result"):
        model = build_presentation_model(
            state["analysis_result"],
            state.get("insights") or [],
            state.get("filename") or "Dataset.xlsx",
        )
        state["presentation_model"] = model
        return model

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Please upload and analyze an Excel file first to view or edit presentations.",
    )


@app.post("/presentation", tags=["Presentation Editor"])
def save_presentation(request: Request, payload: PresentationSaveRequest) -> Dict[str, Any]:
    """
    Saves user edits to the presentation JSON model for the authenticated user.
    """
    uid = get_authenticated_user_id(request)
    state = get_user_state(uid)

    model_data = payload.model_dump()
    state["presentation_model"] = model_data
    logger.info(f"User [{uid}] updated presentation state with {len(payload.slides)} slides.")
    return {
        "status": "saved",
        "message": "Presentation changes saved successfully.",
        "slide_count": len(payload.slides),
        "presentation": model_data,
    }


@app.post("/generate-presentation", tags=["Presentation Editor"])
@app.post("/presentation/generate-pptx", tags=["Presentation Editor"])
async def generate_pptx_from_presentation(request: Request) -> FileResponse:
    """
    Generates a genuine PowerPoint (.pptx) file using the user-edited or auto-generated presentation model.
    Saves output to user-isolated backend/outputs/{firebase_uid}/InsightDeck_Presentation.pptx
    and returns it directly via FileResponse with exact filename 'InsightDeck_Presentation.pptx'.
    """
    uid = get_authenticated_user_id(request)
    state = get_user_state(uid)
    user_outputs = get_user_outputs_dir(uid)

    model = None
    try:
        body = await request.json()
        if isinstance(body, dict):
            if "presentation" in body and isinstance(body["presentation"], dict):
                model = body["presentation"]
            elif "slides" in body:
                model = body
    except Exception:
        pass

    if model:
        state["presentation_model"] = model

    # Fallback to in-memory state or generate on the fly
    if not model:
        model = state.get("presentation_model")
    if not model:
        if state.get("analysis_result"):
            model = build_presentation_model(
                state["analysis_result"],
                state.get("insights") or [],
                state.get("filename") or "Dataset.xlsx",
            )
            state["presentation_model"] = model
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please upload and analyze an Excel file first.",
            )

    output_file_name = "InsightDeck_Presentation.pptx"
    output_path = user_outputs / output_file_name

    try:
        generate_presentation_from_model(
            presentation_model=model,
            output_path=output_path,
        )
        state["last_generated_presentation"] = str(output_path)
        logger.info(f"User [{uid}] generated PowerPoint presentation at {output_path}")

        return FileResponse(
            path=str(output_path),
            filename="InsightDeck_Presentation.pptx",
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )
    except Exception as exc:
        logger.error(f"Presentation generation failed for user [{uid}]: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Presentation generation failed. Check the backend logs.",
        ) from exc


@app.get("/presentation/download", tags=["Presentation Editor"])
@app.get("/download/presentation", tags=["Presentation Editor"])
def download_presentation_file(request: Request) -> FileResponse:
    """
    Serves the user's generated PowerPoint (.pptx) file for direct browser download.
    Guarantees exact filename 'InsightDeck_Presentation.pptx'.
    """
    uid = get_authenticated_user_id(request)
    state = get_user_state(uid)
    user_outputs = get_user_outputs_dir(uid)

    target_path = user_outputs / "InsightDeck_Presentation.pptx"

    if not target_path.exists():
        # Check last generated path from state
        last_gen = state.get("last_generated_presentation")
        if last_gen and Path(last_gen).exists():
            target_path = Path(last_gen)
        else:
            # If model exists, generate it on the fly
            if state.get("presentation_model"):
                generate_presentation_from_model(state["presentation_model"], target_path)
            elif state.get("analysis_result"):
                model = build_presentation_model(
                    state["analysis_result"],
                    state.get("insights") or [],
                    state.get("filename") or "Dataset.xlsx",
                )
                state["presentation_model"] = model
                generate_presentation_from_model(model, target_path)
            else:
                if uid == "default_user":
                    default_target = OUTPUTS_DIR / "InsightDeck_Presentation.pptx"
                    if default_target.exists():
                        target_path = default_target
                    else:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="No presentation has been generated yet. Please upload an Excel file and generate a presentation first.",
                        )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="No presentation has been generated yet for your account. Please upload an Excel file and generate a presentation first.",
                    )

    return FileResponse(
        path=str(target_path),
        filename="InsightDeck_Presentation.pptx",
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )
