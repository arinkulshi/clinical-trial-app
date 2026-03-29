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

**HAPI FHIR Server (with Postgres):**
```bash
cd hapi-fhir && docker compose up -d
```
This starts HAPI FHIR on port 8080 backed by a local Postgres 15 instance (port 5433). For a quick in-memory server (no persistence), use `docker run -p 8080:8080 hapiproject/hapi:v7.4.0` instead.

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

## Live URLs

| Service | URL |
|---------|-----|
| Dashboard | https://clinical-trial-dashboard-232355346494.us-west1.run.app |
| Backend API | https://clinical-trial-backend-232355346494.us-west1.run.app |
| HAPI FHIR Server | https://hapi-fhir-server-232355346494.us-west1.run.app/fhir |

## GCP Deployment

All services deploy to **GCP Cloud Run** in `us-west1` (project `ai-poc-project-483817`):

| Service | Image Registry |
|---------|---------------|
| HAPI FHIR Server | `us-west1-docker.pkg.dev/ai-poc-project-483817/clinical-trial-repo/hapi-fhir` |
| FastAPI Backend | `us-west1-docker.pkg.dev/ai-poc-project-483817/clinical-trial-repo/backend` |
| React Dashboard | `us-west1-docker.pkg.dev/ai-poc-project-483817/clinical-trial-repo/dashboard` |

### Cloud SQL (Postgres 15)

The HAPI FHIR server uses **Cloud SQL for PostgreSQL** for persistent, reliable storage — replacing the previous H2 in-memory database that would lose data on container restarts and crash under load.

| Parameter | Value |
|-----------|-------|
| Instance | `clinical-trial-db` |
| Tier | `db-f1-micro` |
| Database | *(see Secret Manager)* |
| User | *(see Secret Manager)* |
| Public IP | *(see GCP Console)* |
| Password | Stored in Secret Manager (`clinical-trial-db-password`) |
| Authorized Networks | `0.0.0.0/0` (password-protected; tighten for production) |

Cloud Run connects to Cloud SQL via its public IP. The `--add-cloudsql-instances` flag is included in the deploy for future socket-based migration. The HAPI FHIR Cloud Run service is configured with 2 GiB memory / 2 vCPU with CPU boost.

### Deploying

Deploy all services:
```bash
bash scripts/deploy-all.sh
```

Or deploy individually:
```bash
cd hapi-fhir && bash deploy.sh
cd backend && bash deploy.sh
cd dashboard && bash deploy.sh
```

Build the HAPI FHIR image via Cloud Build (no local Docker required):
```bash
cd hapi-fhir
gcloud builds submit --tag us-west1-docker.pkg.dev/ai-poc-project-483817/clinical-trial-repo/hapi-fhir:latest --project=ai-poc-project-483817 --region=us-west1
```

## Start / Stop Services (Cost Control)

Stop services when not in use to avoid billing. Start them back up when needed.

### Windows Command Prompt

```cmd
REM Stop all services (no billing)
scripts\cloud-run-toggle.bat stop

REM Start all services
scripts\cloud-run-toggle.bat start

REM Check current state
scripts\cloud-run-toggle.bat status
```

### Bash / Git Bash / WSL

```bash
# Stop all services (no billing)
bash scripts/cloud-run-toggle.sh stop

# Start all services
bash scripts/cloud-run-toggle.sh start

# Check current state
bash scripts/cloud-run-toggle.sh status
```

### Manual gcloud commands

```cmd
REM Stop — delete services entirely (images remain in Artifact Registry)
gcloud run services delete hapi-fhir-server --region us-west1 --quiet
gcloud run services delete clinical-trial-backend --region us-west1 --quiet
gcloud run services delete clinical-trial-dashboard --region us-west1 --quiet

REM Start — redeploy from existing images (use the start command above or deploy-all.sh)
scripts\cloud-run-toggle.bat start
```

> **Note — Persistent FHIR Database:**
> The HAPI FHIR server now uses **Cloud SQL (Postgres 15)** for persistent storage. Data survives container restarts, redeployments, and scale-to-zero events. This means:
> - **stop** deletes Cloud Run services — no compute billing, but Cloud SQL continues running (~$7/month for `db-f1-micro`)
> - **start** redeploys from existing images — FHIR data is still there, no reload needed
> - To reload data from scratch (e.g. after clearing the database):
> ```bash
> python -m pipeline.load_to_fhir --server-url https://hapi-fhir-server-232355346494.us-west1.run.app/fhir --bundle-dir data/fhir_bundles/
> ```
> The loader automatically remaps stale resource references (e.g. `ResearchStudy/27` → `ResearchStudy/9`) so bundles work on a fresh server. Loading 200 patient bundles takes ~15-30 minutes on the `db-f1-micro` tier.

## Implementation Status

| Chunk | Description | Status |
|-------|-------------|--------|
| 0 | GCP Infrastructure Setup | Complete |
| 1 | Synthetic Data Generation | Complete |
| 2 | FHIR R4 Transformation Pipeline | Complete |
| 3 | HAPI FHIR Server (Docker + Deploy) | Complete |
| 4 | Data Loading Script | Complete |
| 5 | FastAPI Backend + Validation Engine | Complete |
| 6 | Dashboard: Study Overview | Complete |
| 7 | Dashboard: Safety Dashboard | Complete |
| 8 | Dashboard: Patient Journey | Complete |
| 9 | Dashboard: Data Management UI | Complete |
| 10 | AI Assistant Panel | Skipped |
| 11 | Final Integration, Polish & Deploy | Complete |
