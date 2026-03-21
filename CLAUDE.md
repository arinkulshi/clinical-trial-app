# Clinical Trial FHIR Interoperability Dashboard

## Project Overview

A clinical trial data platform that ingests trial data (synthetic or uploaded), transforms it into HL7 FHIR R4 resources, loads it into a HAPI FHIR server, and presents it through an interactive dashboard with AI-powered natural language querying.

**Target audience:** Clinical operations leads, data managers, regulatory stakeholders.

**Full spec:** See `clinical-trial-fhir-dashboard-chunks.md` for detailed implementation chunks.

## Tech Stack

- **Data Pipeline:** Python 3.11+, pandas, numpy, faker, fhir.resources
- **Backend:** FastAPI, SQLAlchemy, Pydantic v2, uvicorn
- **FHIR Server:** HAPI FHIR JPA Server v7.4.0 (Docker, Postgres-backed)
- **Frontend:** React 18, Vite, Tailwind CSS, Recharts, Axios, React Router, lucide-react
- **AI Assistant:** Claude API (claude-sonnet-4-20250514) for natural language FHIR querying
- **Infrastructure:** GCP Cloud Run, Cloud SQL (Postgres 15), GCS, Artifact Registry, Secret Manager

## GCP Configuration

```
Project ID:    ai-poc-project-483817
Project #:     232355346494
Region:        us-west1
```

## Project Structure

```
clinical_trial_app/
  data/
    synthetic/              # Generated CSV files + metadata (Chunk 1)
    fhir_bundles/           # FHIR Transaction Bundle JSON files (Chunk 2)
  pipeline/                 # Python FHIR transformation pipeline (Chunk 2)
    config.py
    transform_study.py
    transform_patient.py
    transform_ae.py
    transform_obs.py
    transform_meds.py
    transform_disposition.py
    bundle_builder.py
    run_transform.py
    load_to_fhir.py         # Data loader (Chunk 4)
  backend/                  # FastAPI backend (Chunk 5)
    app/
      main.py
      config.py
      routers/
        fhir_proxy.py
        upload.py
        datasets.py
      models/
        database.py
        schemas.py
      services/
        validator.py
        fhir_loader.py
        gcs.py
      middleware/
        error_handler.py
    requirements.txt
    Dockerfile
  dashboard/                # React frontend (Chunks 6-10)
    src/
      api/
      components/
        layout/
        study-overview/
        safety/
        patient-journey/
        data-management/
        ai-assistant/
        common/
      hooks/
      pages/
      utils/
  scripts/
    load_data.sh
  hapi-fhir/               # HAPI FHIR Dockerfile (Chunk 3)
```

## Implementation Chunks (Dependency Order)

| Chunk | Description | Status |
|-------|-------------|--------|
| 0 | GCP Infrastructure Setup | Not started |
| 1 | Synthetic Data Generation | Not started |
| 2 | FHIR R4 Transformation Pipeline | Not started |
| 3 | HAPI FHIR Server (Docker + Deploy) | Complete |
| 4 | Data Loading Script | Complete |
| 5 | FastAPI Backend + Validation Engine | Complete |
| 6 | Dashboard: Study Overview | Complete |
| 7 | Dashboard: Safety Dashboard | Complete |
| 8 | Dashboard: Patient Journey | Complete |
| 9 | Dashboard: Data Management UI | Complete |
| 10 | AI Assistant Panel | Not started |
| 11 | Final Integration, Polish & Deploy | Not started |

**Work one chunk at a time. Test each chunk before moving to the next.**

## Study Design (for reference)

```
Protocol:       ONCO-2024-PD1-301
Phase:          Phase III
Indication:     Advanced NSCLC (Stage IIIB/IV)
Arms:           PEMBRO (immunotherapy) vs CHEMO (chemotherapy), 1:1 randomization
Patients:       200 (100 per arm)
Sites:          8 US clinical sites
Duration:       26 weeks
Primary EP:     Progression-Free Survival (PFS)
```

## Key Design Decisions

- FHIR Transaction Bundles use `urn:uuid:<uuid4>` for internal references
- Patient bundles: one per patient, max 500 resources each
- Validation engine uses Pydantic v2 strict mode, collects all errors (no fail-fast)
- Dashboard FHIR JSON drawer on every chart (proves data sourced from FHIR)
- AI assistant generates FHIR queries client-side, executes against backend
- CORS wide open for development; HAPI FHIR auto-creates schema on first boot

## Styling Guidelines (Dashboard)

- Dark sidebar, light main content
- Primary blue: #2563EB, Success: #10B981, Warning: #F59E0B, Danger: #EF4444
- Arm colors: PEMBRO = #3B82F6, CHEMO = #8B5CF6
- Cards with subtle shadows, rounded corners, 16px/24px spacing grid
- lucide-react icons throughout

## Commands

```bash
# Data pipeline
cd pipeline && python run_transform.py

# Backend
cd backend && uvicorn app.main:app --reload --port 8000

# Dashboard
cd dashboard && npm run dev

# Load data to FHIR server
python -m pipeline.load_to_fhir --server-url http://localhost:8080/fhir --bundle-dir data/fhir_bundles/

# HAPI FHIR (local Docker)
docker run -p 8080:8080 hapiproject/hapi:v7.4.0
```
