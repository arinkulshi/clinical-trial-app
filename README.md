# Clinical Trial FHIR Interoperability Dashboard

A clinical trial data platform that ingests trial data (synthetic or uploaded), transforms it into **HL7 FHIR R4** resources, loads it into a HAPI FHIR server, and presents it through an interactive dashboard with AI-powered natural language querying.

**Target audience:** Clinical operations leads, data managers, and regulatory stakeholders.

---

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌────────────────────┐
│  Synthetic Data  │    │  FHIR Transform  │    │   HAPI FHIR Server │
│  Generation      │───▶│  Pipeline        │───▶│   (JPA + Postgres) │
│  (Python/Faker)  │    │  (Python/fhir.r) │    │   Port 8080        │
└─────────────────┘    └──────────────────┘    └────────┬───────────┘
                                                        │
                           ┌────────────────────────────┘
                           │
                    ┌──────▼──────────┐    ┌─────────────────────┐
                    │  FastAPI Backend │    │   React Dashboard   │
                    │  Port 8000       │◀──▶│   (Vite + Tailwind) │
                    │  - FHIR Proxy    │    │   - Study Overview  │
                    │  - Upload/Valid. │    │   - Safety Dashboard│
                    │  - Dataset Mgmt  │    │   - Patient Journey │
                    └─────────────────┘    │   - Data Management │
                                           │   - AI Assistant    │
                                           └─────────────────────┘
```

## Study Design

| Parameter | Value |
|-----------|-------|
| Protocol | ONCO-2024-PD1-301 |
| Phase | Phase III |
| Indication | Advanced NSCLC (Stage IIIB/IV) |
| Arms | PEMBRO (immunotherapy) vs CHEMO (chemotherapy), 1:1 randomization |
| Patients | 200 (100 per arm) |
| Sites | 8 US clinical sites |
| Duration | 26 weeks |
| Primary Endpoint | Progression-Free Survival (PFS) |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Data Pipeline | Python 3.11+, pandas, numpy, faker, fhir.resources |
| Backend API | FastAPI, SQLAlchemy, Pydantic v2, uvicorn |
| FHIR Server | HAPI FHIR JPA Server v7.4.0 (Docker, Postgres-backed) |
| Frontend | React 18, Vite, Tailwind CSS, Recharts, React Router, lucide-react |
| AI Assistant | Claude API (claude-sonnet-4-20250514) for natural language FHIR querying |
| Infrastructure | GCP Cloud Run, Cloud SQL (Postgres 15), GCS, Artifact Registry, Secret Manager |

## Project Structure

```
clinical_trial_app/
├── pipeline/                  # Python data pipeline
│   ├── config.py              # Pipeline configuration
│   ├── transform_*.py         # FHIR resource transformers (study, patient, AE, obs, meds, disposition)
│   ├── bundle_builder.py      # FHIR Transaction Bundle assembly
│   ├── run_transform.py       # Pipeline entry point
│   └── load_to_fhir.py        # Loads bundles into HAPI FHIR server
├── backend/                   # FastAPI backend
│   └── app/
│       ├── main.py            # App entry point
│       ├── config.py          # Backend configuration
│       ├── routers/           # API routes (fhir_proxy, upload, datasets)
│       ├── models/            # Database models & Pydantic schemas
│       ├── services/          # Business logic (validator, fhir_loader, gcs)
│       └── middleware/        # Error handling middleware
├── dashboard/                 # React frontend
│   └── src/
│       ├── pages/             # Study Overview, Safety, Patient Journey, Data Management
│       ├── components/        # UI components organized by feature
│       ├── hooks/             # Custom React hooks
│       ├── api/               # API client layer
│       └── utils/             # Shared utilities
├── hapi-fhir/                 # HAPI FHIR server Docker configuration
├── data/
│   ├── synthetic/             # Generated CSV files + metadata
│   └── fhir_bundles/          # FHIR Transaction Bundle JSON files
└── scripts/                   # Deployment and data loading scripts
```

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker Desktop
- Google Cloud SDK (for deployment)

### Local Development

**HAPI FHIR Server:**
```bash
docker run -p 8080:8080 hapiproject/hapi:v7.4.0
```

**Data Pipeline — generate and transform data:**
```bash
cd pipeline && python run_transform.py
```

**Load data into FHIR server:**
```bash
python -m pipeline.load_to_fhir --server-url http://localhost:8080/fhir --bundle-dir data/fhir_bundles/
```

**Backend API:**
```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

**Dashboard:**
```bash
cd dashboard && npm install && npm run dev
```

## Key Design Decisions

- **FHIR Transaction Bundles** use `urn:uuid:<uuid4>` for internal cross-resource references
- **Patient bundles** are scoped to one per patient, capped at 500 resources each
- **Validation engine** uses Pydantic v2 strict mode and collects all errors (no fail-fast)
- **FHIR JSON drawer** on every chart proves data is sourced directly from FHIR resources
- **AI assistant** generates FHIR search queries client-side and executes them against the backend proxy
- CORS is open for development; HAPI FHIR auto-creates its schema on first boot

## GCP Deployment

All services deploy to **GCP Cloud Run** in `us-west1`:

| Service | Image Registry |
|---------|---------------|
| HAPI FHIR Server | `us-west1-docker.pkg.dev/ai-poc-project-483817/clinical-trial-repo/hapi-fhir` |
| FastAPI Backend | `us-west1-docker.pkg.dev/ai-poc-project-483817/clinical-trial-repo/backend` |
| React Dashboard | `us-west1-docker.pkg.dev/ai-poc-project-483817/clinical-trial-repo/dashboard` |

See `scripts/deploy-all.sh` and individual `deploy.sh` files in each service directory for deployment commands.

## Implementation Status

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
