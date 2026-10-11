# InsightDeck

> **Excel-to-Insights Platform for Auditors, Analysts, and Business Users**

---

## 🎯 Problem
Auditors, financial analysts, and business users frequently spend hours manually opening, validating, and inspecting large, complex Excel files to calculate KPI metrics, check data hygiene, summarize findings, and convert raw spreadsheet rows into executive PowerPoint presentations.

## 💡 Solution
**InsightDeck** automates the end-to-end workflow:
$$\text{Excel File} \longrightarrow \text{Automated Analysis} \longrightarrow \text{Factual Insights} \longrightarrow \text{Executive Dashboard} \longrightarrow \text{Interactive Chatbot} \longrightarrow \text{PowerPoint Presentation}$$

InsightDeck ensures **100% Data Safety**: original uploaded Excel files are permanently preserved read-only in `backend/uploads/` and are never modified or overwritten.

---

## 🚀 Current Features
- **Safe Excel Ingestion**: Upload `.xlsx` workbooks with format validation and immutable source storage.
- **Structural & Metadata Auditing**: Automated detection of worksheet names, row/column counts, inferred column data types, missing value percentages, and duplicate row detection.
- **Deterministic Analysis Engine**: Exact calculations for metric sums, means, minimums, maximums, and category frequencies without AI hallucinations or estimation.
- **Factual Insight Generation**: Rule-based insight engine translating computed statistics into clear executive findings.
- **Live Reports API & UI**: Real-time summary metrics, quantitative KPI cards, and factual audit findings synced with active dataset.
- **Automated PowerPoint (.pptx) Deck Generation**: Full 5-slide widescreen presentation deck generator powered by `python-pptx` with direct browser download.
- **Modern SaaS Dashboard**: Interactive UI featuring KPI cards, trend visualization placeholders, regional/category breakdown, and real-time backend connection monitoring.
- **Interactive Chatbot Interface**: "Ask Your Data" conversational view supporting quick-prompt chips and deterministic responses.
- **Full Backend API & OpenAPI Documentation**: FastAPI backend with CORS support and Swagger docs at `http://localhost:8000/docs`.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React (Vite)
- **Styling**: Vanilla CSS (Tailored Design System with Dark Theme & Glassmorphism)
- **Icons & Visuals**: Native SVG Icons & Google Fonts (`Inter`, `Outfit`, `JetBrains Mono`)

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Server**: Uvicorn
- **Data Processing**: Pandas, OpenPyXL, NumPy
- **File Handling**: `python-multipart`
- **Presentation Engine**: `python-pptx`
- **Testing**: Pytest & HTTPX


## 🌐 API Endpoints
| Method | Endpoint | Description | Status Code |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Root welcoming message | `200 OK` |
| `GET` | `/health` | Heartbeat health status endpoint | `200 OK` |
| `POST` | `/upload` | Ingests `.xlsx`, saves original read-only, runs analysis & stores state | `201 Created` / `400 Bad Request` |
| `GET` | `/report` | Returns structured summary, calculated KPIs, and factual insights | `200 OK` / `404 Not Found` |
| `POST` | `/generate-presentation` | Generates a 5-slide `.pptx` deck saved in `backend/outputs/` | `200 OK` / `400 Bad Request` |
| `GET` | `/download/presentation` | Downloads the generated `.pptx` PowerPoint presentation | `200 OK` / `404 Not Found` |

---

## 🏗️ Architecture & Communication


```
┌─────────────────────────────────────────────────────────────┐
│                      React / Vite Frontend                  │
│                     (http://localhost:5173)                 │
└──────────────┬──────────────────────────────▲───────────────┘
               │                              │
     POST /upload (.xlsx FormData)     GET /health (Heartbeat)
               │                              │
┌──────────────▼──────────────────────────────┴───────────────┐
│                      FastAPI Backend                        │
│                     (http://localhost:8000)                 │
├──────────────────────────────┬──────────────────────────────┤
│  excel_processor.py          │  analyzer.py                 │
│  (Read-only pandas/openpyxl) │  (Deterministic calculations)│
├──────────────────────────────┼──────────────────────────────┤
│  insights.py                 │  presentation.py             │
│  (Factual insights engine)   │  (PPTX generation foundation)│
├──────────────────────────────┴──────────────────────────────┤
│  backend/uploads/ (Originals)│  backend/outputs/ (Artifacts)│
└─────────────────────────────────────────────────────────────┘
```

1. **Frontend Service (`frontend/src/services/api.js`)** polls `GET /health` to verify backend connectivity.
2. When the user drops or selects an `.xlsx` file, the frontend issues a multipart `POST /upload` request.
3. The backend saves the raw file to `backend/uploads/` unaltered.
4. The backend runs `process_excel_file()`, `analyze_dataset()`, and `generate_factual_insights()` to return immediate metadata and metrics.

---

## ⚡ Local Setup & Getting Started

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
- API Root: `http://localhost:8000`
- Interactive Swagger API Docs: `http://localhost:8000/docs`
- Health Endpoint: `http://localhost:8000/health`

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
- Frontend UI: `http://localhost:5173`

---

## 🔮 Future Features (Upcoming Roadmap)
- [ ] Multi-sheet deep analytics and automated anomaly detection
- [ ] Interactive charting with Recharts / Chart.js
- [ ] LLM-powered natural language queries in "Ask Your Data"
- [ ] One-click PowerPoint (`.pptx`) export and download
- [ ] Multi-file cross-comparison and variance analysis
- [ ] Docker containerization and cloud deployment
