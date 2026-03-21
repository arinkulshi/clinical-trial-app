# Clinical Trial FHIR Interoperability Dashboard — Implementation Chunks

## Project Overview

**What we're building:** A clinical trial data platform that ingests trial data (synthetic or user-uploaded), transforms it into HL7 FHIR R4 resources, loads it into a FHIR server, and presents it through an interactive dashboard with AI-powered natural language querying.

**Target audience:** Clinical operations leads, data managers, regulatory stakeholders — subject matter experts who need to be "wowed" by the interoperability story.

**Stack:** Python (data pipeline + FastAPI backend), HAPI FHIR JPA Server (Docker), React + Tailwind (dashboard), Claude API (AI assistant), GCP Cloud Run + Cloud SQL + GCS.

---

## GCP Configuration

```
Project ID:    ai-poc-project-483817
Project #:     232355346494
Region:        us-west1
```

### Required GCP APIs (enable before starting)

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  vpcaccess.googleapis.com \
  storage.googleapis.com
```

### Prerequisites

- `gcloud` CLI installed and authenticated (`gcloud auth login`)
- Docker Desktop for Windows installed and running
- Node.js 18+ (for React dashboard)
- Python 3.11+ (for data pipeline and FastAPI)

---

## Dependency Graph

```
Chunk 0: GCP Infrastructure
    ↓
Chunk 1: Synthetic Data Generation
    ↓
Chunk 2: FHIR Transformation Pipeline
    ↓
Chunk 3: HAPI FHIR Server (Docker + Deploy)
    ↓
Chunk 4: Data Loading Script
    ↓
Chunk 5: FastAPI Backend + Validation Engine
    ↓
Chunk 6: Dashboard — Study Overview
    ↓
Chunk 7: Dashboard — Safety Dashboard
    ↓
Chunk 8: Dashboard — Patient Journey
    ↓
Chunk 9: Dashboard — Data Management UI (Upload + Validate)
    ↓
Chunk 10: AI Assistant Panel
    ↓
Chunk 11: Final Integration, Polish & Deploy
```

---

## CHUNK 0 — GCP Infrastructure Setup

### Context for LLM

You are setting up GCP infrastructure for a clinical trial FHIR dashboard POC. Keep everything minimal and cost-optimized (scale-to-zero where possible). All resources go in `us-west1`.

### Tasks

1. **Create Artifact Registry repository** for Docker images:
   ```bash
   gcloud artifacts repositories create clinical-trial-repo \
     --repository-format=docker \
     --location=us-west1 \
     --description="Clinical Trial FHIR Dashboard images"
   ```

2. **Create Cloud SQL Postgres instance** (micro tier for cost):
   ```bash
   gcloud sql instances create clinical-trial-db \
     --database-version=POSTGRES_15 \
     --tier=db-f1-micro \
     --region=us-west1 \
     --storage-size=10GB \
     --storage-auto-increase
   ```
   - Create two databases: `hapi_fhir` (for the FHIR server) and `app_metadata` (for our FastAPI backend's dataset tracking).
   - Create a database user: `fhir_user` with a generated password. Store the password in **Secret Manager**.

3. **Create GCS bucket** for user-uploaded raw files:
   ```bash
   gsutil mb -l us-west1 gs://ai-poc-project-483817-clinical-uploads/
   ```

4. **Create a VPC Connector** so Cloud Run can reach Cloud SQL via private IP:
   ```bash
   gcloud compute networks vpc-access connectors create clinical-trial-connector \
     --region=us-west1 \
     --range=10.8.0.0/28
   ```

5. **Verify setup** — list all created resources and confirm connectivity.

### Expected Output
- Artifact Registry repo: `us-west1-docker.pkg.dev/ai-poc-project-483817/clinical-trial-repo`
- Cloud SQL instance: `clinical-trial-db` with databases `hapi_fhir` and `app_metadata`
- GCS bucket: `gs://ai-poc-project-483817-clinical-uploads/`
- VPC Connector: `clinical-trial-connector`
- Secret in Secret Manager: `clinical-trial-db-password`

---

## CHUNK 1 — Synthetic Clinical Trial Data Generation

### Context for LLM

You are generating synthetic clinical trial data for a **Phase III oncology trial**: a PD-L1 checkpoint inhibitor (Pembrolizumab-like) vs. platinum-based chemotherapy for first-line treatment of advanced non-small cell lung cancer (NSCLC).

The data should mimic CDISC SDTM (Study Data Tabulation Model) structure but be output as clean CSV files — one file per domain. This data will later be transformed into FHIR R4 resources.

### Study Design Parameters

```
Protocol:           ONCO-2024-PD1-301
Phase:              Phase III
Indication:         Advanced NSCLC (Stage IIIB/IV)
Arms:               2 (Immunotherapy arm: "PEMBRO", Chemotherapy arm: "CHEMO")
Randomization:      1:1
Patients:           200 (100 per arm)
Sites:              8 clinical sites across the US
Duration:           26 weeks (enrollment + treatment + follow-up)
Primary endpoint:   Progression-Free Survival (PFS)
```

### CSV Files to Generate

Each CSV should use standard SDTM-like column naming. Generate using Python with `faker` and `numpy` for realistic distributions.

#### 1. `demographics.csv` (DM domain)
| Column | Description | Example Values |
|--------|-------------|----------------|
| SUBJID | Unique subject ID | SUBJ-001 through SUBJ-200 |
| SITEID | Clinical site ID | SITE-01 through SITE-08 |
| ARM | Treatment arm | PEMBRO, CHEMO |
| AGE | Age at enrollment | Normal dist, mean=63, std=10, range 35-85 |
| SEX | Sex | M, F (roughly 55/45 split — lung cancer skews male) |
| RACE | Race | WHITE, BLACK OR AFRICAN AMERICAN, ASIAN, OTHER |
| ETHNIC | Ethnicity | HISPANIC OR LATINO, NOT HISPANIC OR LATINO |
| COUNTRY | Country | US |
| RFSTDTC | Date of first study treatment | Staggered over 12-week enrollment window |
| RFENDTC | Date of last study treatment | RFSTDTC + treatment duration (varies) |
| DTHFL | Death flag | Y or blank |

#### 2. `adverse_events.csv` (AE domain)
| Column | Description | Example Values |
|--------|-------------|----------------|
| SUBJID | Subject ID | Links to demographics |
| AETERM | Adverse event term (verbatim) | Fatigue, Nausea, Rash, Pneumonitis, Colitis, etc. |
| AEDECOD | MedDRA preferred term | Standardized term |
| AEBODSYS | System organ class | Gastrointestinal disorders, Skin disorders, etc. |
| AESEV | Severity | MILD, MODERATE, SEVERE |
| AETOXGR | CTCAE grade | 1, 2, 3, 4, 5 |
| AESER | Serious AE flag | Y, N |
| AEREL | Relationship to study drug | RELATED, NOT RELATED, POSSIBLY RELATED |
| AEACN | Action taken | DOSE NOT CHANGED, DOSE REDUCED, DRUG WITHDRAWN |
| AEOUT | Outcome | RECOVERED, RECOVERING, NOT RECOVERED, FATAL |
| AESTDTC | AE start date | After RFSTDTC |
| AEENDTC | AE end date | After AESTDTC (or blank if ongoing) |

**Distribution guidance:**
- PEMBRO arm: more immune-related AEs (pneumonitis, colitis, hepatitis, thyroiditis, rash). ~15% Grade 3+ irAE rate.
- CHEMO arm: more traditional chemo toxicities (nausea, neutropenia, anemia, neuropathy). ~25% Grade 3+ AE rate.
- Average 3-5 AEs per patient. Some patients have 0, some have 8+.
- ~5% SAE rate. 2-3 Grade 5 (fatal) AEs across the study.

#### 3. `vital_signs.csv` (VS domain)
| Column | Description | Example Values |
|--------|-------------|----------------|
| SUBJID | Subject ID | Links to demographics |
| VSTESTCD | Vital sign test code | SYSBP, DIABP, HR, TEMP, WEIGHT, HEIGHT |
| VSTEST | Vital sign test name | Systolic Blood Pressure, etc. |
| VSORRES | Original result | Numeric value |
| VSORRESU | Original units | mmHg, beats/min, C, kg, cm |
| VSDTC | Date/time of measurement | Baseline + every 3 weeks (cycle visits) |
| VISITNUM | Visit number | 1 (screening), 2 (baseline), 3-10 (treatment visits) |
| VSBLFL | Baseline flag | Y for visit 2 |

**Distribution guidance:**
- Measurements at screening, baseline, and every 3 weeks (8 treatment visits).
- Slight trends: chemo patients may show weight loss over time. Both arms may show BP changes.
- Occasional outliers for realism (missed measurements, transcription-error-range values).

#### 4. `lab_results.csv` (LB domain)
| Column | Description | Example Values |
|--------|-------------|----------------|
| SUBJID | Subject ID | Links to demographics |
| LBTESTCD | Lab test code | ALT, AST, BILI, CREAT, WBC, ANC, HGB, PLT, ALB, LDH, TSH |
| LBTEST | Lab test name | Alanine Aminotransferase, etc. |
| LBORRES | Original result | Numeric |
| LBORRESU | Original units | U/L, mg/dL, x10^9/L, g/dL, etc. |
| LBSTNRLO | Standard normal range low | Per test |
| LBSTNRHI | Standard normal range high | Per test |
| LBDTC | Date of lab collection | Aligned with visit schedule |
| VISITNUM | Visit number | Same as vital signs |
| LBBLFL | Baseline flag | Y for visit 2 |

**Distribution guidance:**
- PEMBRO arm: ~10% patients develop ALT/AST elevations (hepatitis signal). ~5% thyroid dysfunction (TSH changes).
- CHEMO arm: ~30% neutropenia (ANC drops), ~20% anemia (HGB drops), ~15% thrombocytopenia (PLT drops).
- Labs at same visit schedule as vitals.
- Include LOINC codes in a separate column (LBLOINC) for FHIR mapping convenience.

#### 5. `medications.csv` (EX + CM domains combined)
| Column | Description | Example Values |
|--------|-------------|----------------|
| SUBJID | Subject ID | Links to demographics |
| CMTRT | Treatment name | Pembrolizumab 200mg, Carboplatin AUC5, Paclitaxel 175mg/m2 |
| CMDOSE | Dose | Numeric |
| CMDOSU | Dose units | mg, mg/m2 |
| CMROUTE | Route | INTRAVENOUS |
| CMSTDTC | Start date | Per cycle schedule |
| CMENDTC | End date | Same day for IV infusions |
| CMCAT | Category | STUDY DRUG, CONCOMITANT |
| VISITNUM | Visit number | Treatment visits |

**Distribution guidance:**
- PEMBRO arm: Pembrolizumab 200mg IV every 3 weeks.
- CHEMO arm: Carboplatin + Paclitaxel every 3 weeks for 4-6 cycles.
- Include common concomitant meds: ondansetron (anti-nausea), dexamethasone (premedication), filgrastim (for neutropenia).
- Some dose modifications in both arms (10-15% of patients).

#### 6. `disposition.csv` (DS domain)
| Column | Description | Example Values |
|--------|-------------|----------------|
| SUBJID | Subject ID | Links to demographics |
| DSSCAT | Disposition subcategory | ENROLLED, RANDOMIZED, COMPLETED, DISCONTINUED |
| DSDECOD | Standardized disposition term | COMPLETED, ADVERSE EVENT, PROGRESSIVE DISEASE, DEATH, WITHDRAWAL BY SUBJECT, PHYSICIAN DECISION |
| DSSTDTC | Disposition date | Relevant date |

**Distribution guidance:**
- ~200 enrolled, all 200 randomized.
- ~60% complete the study. ~15% discontinue due to AEs. ~15% discontinue due to progressive disease. ~5% withdraw consent. ~5% die on study.
- CHEMO arm slightly higher discontinuation rate.

### Technical Requirements

- Use Python with `faker`, `numpy`, `pandas`.
- Seed random generators for reproducibility (`seed=42`).
- All dates should be in ISO 8601 format (YYYY-MM-DD).
- Enrollment start date: 2024-01-15, enrollment window: 12 weeks.
- Output as CSV files in a `data/synthetic/` directory.
- Generate a `study_metadata.json` with protocol-level info (protocol ID, title, phase, arms, sites list with names and locations).
- Include a `LOINC_MAP.json` mapping LBTESTCD → LOINC code for use in the FHIR transformation chunk.

### Expected Output

```
data/
  synthetic/
    study_metadata.json
    LOINC_MAP.json
    demographics.csv       (~200 rows)
    adverse_events.csv     (~700-1000 rows)
    vital_signs.csv        (~10,000+ rows)
    lab_results.csv        (~15,000+ rows)
    medications.csv        (~2,000+ rows)
    disposition.csv        (~300+ rows)
```

---

## CHUNK 2 — FHIR R4 Transformation Pipeline

### Context for LLM

You are building a Python module that reads the synthetic clinical trial CSV files (from Chunk 1) and transforms them into HL7 FHIR R4 resources. These resources will be POSTed to a HAPI FHIR server as Transaction Bundles.

Use the `fhir.resources` Python library (Pydantic-based FHIR models) for constructing resources. This ensures schema-valid FHIR JSON output.

### FHIR Resource Mapping

Transform each SDTM domain to the following FHIR R4 resources:

#### Study-level Resources (created once)

| Source | FHIR Resource | Key Fields |
|--------|--------------|------------|
| study_metadata.json | `ResearchStudy` | identifier (protocol ID), title, status=completed, phase (phase-3), arm[] (PEMBRO, CHEMO), site[] references |
| study_metadata.json → sites | `Organization` | One per site. name, identifier (SITEID), address |

#### Patient-level Resources (per subject)

| Source | FHIR Resource | Key Fields |
|--------|--------------|------------|
| demographics.csv | `Patient` | identifier (SUBJID), gender, birthDate (calculate from AGE), extension for race/ethnicity (US Core extensions) |
| demographics.csv | `ResearchSubject` | status, study (ref to ResearchStudy), individual (ref to Patient), period (RFSTDTC to RFENDTC), assignedArm |

#### Clinical Data Resources

| Source | FHIR Resource | Key Fields |
|--------|--------------|------------|
| adverse_events.csv | `AdverseEvent` | subject (ref Patient), event (coding from AEDECOD), seriousness, severity, date, resultingCondition, suspectEntity[].causality, outcome |
| vital_signs.csv | `Observation` | category=vital-signs, code (LOINC), subject (ref Patient), effectiveDateTime, valueQuantity, referenceRange |
| lab_results.csv | `Observation` | category=laboratory, code (LOINC from LOINC_MAP.json), subject (ref Patient), effectiveDateTime, valueQuantity, referenceRange (LBSTNRLO/HI), interpretation (H/L/N) |
| medications.csv (STUDY DRUG) | `MedicationAdministration` | status, medicationCodeableConcept, subject (ref Patient), effectivePeriod, dosage, context (ref ResearchStudy) |
| medications.csv (CONCOMITANT) | `MedicationStatement` | status, medicationCodeableConcept, subject (ref Patient), effectivePeriod, dosage |
| disposition.csv | Encoded in `ResearchSubject.status` and as `Encounter` resources for key milestones |

### LOINC Codes to Use

```json
{
  "SYSBP":  {"code": "8480-6",  "display": "Systolic blood pressure"},
  "DIABP":  {"code": "8462-4",  "display": "Diastolic blood pressure"},
  "HR":     {"code": "8867-4",  "display": "Heart rate"},
  "TEMP":   {"code": "8310-5",  "display": "Body temperature"},
  "WEIGHT": {"code": "29463-7", "display": "Body weight"},
  "HEIGHT": {"code": "8302-2",  "display": "Body height"},
  "ALT":    {"code": "1742-6",  "display": "ALT [U/L]"},
  "AST":    {"code": "1920-8",  "display": "AST [U/L]"},
  "BILI":   {"code": "1975-2",  "display": "Bilirubin total [mg/dL]"},
  "CREAT":  {"code": "2160-0",  "display": "Creatinine [mg/dL]"},
  "WBC":    {"code": "6690-2",  "display": "WBC [#/volume]"},
  "ANC":    {"code": "751-8",   "display": "Neutrophils [#/volume]"},
  "HGB":    {"code": "718-7",   "display": "Hemoglobin [g/dL]"},
  "PLT":    {"code": "777-3",   "display": "Platelets [#/volume]"},
  "ALB":    {"code": "1751-7",  "display": "Albumin [g/dL]"},
  "LDH":    {"code": "2532-0",  "display": "LDH [U/L]"},
  "TSH":    {"code": "3016-3",  "display": "TSH [mIU/L]"}
}
```

### Technical Requirements

- Use `fhir.resources` (install: `pip install fhir.resources`).
- All resources must include a `fullUrl` using UUID (`urn:uuid:<uuid4>`) for bundle references.
- Internal references between resources must use these UUIDs (e.g., Observation.subject → Patient's fullUrl).
- Build FHIR Transaction Bundles grouped sensibly: one bundle for study-level resources, then patient bundles (one per patient containing their Patient, ResearchSubject, and all associated clinical resources). This keeps bundle sizes manageable for the FHIR server.
- Each patient bundle should be ≤500 resources to avoid server timeouts.
- Output the bundles as JSON files in `data/fhir_bundles/`.
- Create a reusable Python module structure:

```
pipeline/
  __init__.py
  config.py            # Paths, constants
  transform_study.py   # ResearchStudy + Organization resources
  transform_patient.py # Patient + ResearchSubject
  transform_ae.py      # AdverseEvent resources
  transform_obs.py     # Observation (vitals + labs)
  transform_meds.py    # MedicationAdministration + MedicationStatement
  transform_disposition.py
  bundle_builder.py    # Assembles Transaction Bundles
  run_transform.py     # Main entry point
```

### Expected Output

```
data/
  fhir_bundles/
    study_bundle.json           # ResearchStudy + Organizations (~10 resources)
    patient_bundle_001.json     # Patient SUBJ-001 + all clinical data (~50-80 resources)
    patient_bundle_002.json
    ...
    patient_bundle_200.json
```

---

## CHUNK 3 — HAPI FHIR Server (Docker + Cloud Run Deployment)

### Context for LLM

You are containerizing and deploying the HAPI FHIR JPA Server (R4) to GCP Cloud Run, backed by the Cloud SQL Postgres instance created in Chunk 0. HAPI FHIR is a Java-based open-source FHIR server that provides a full FHIR R4 REST API.

### Tasks

1. **Create a Dockerfile** based on the official HAPI FHIR starter image:
   ```dockerfile
   FROM hapiproject/hapi:v7.4.0

   # Configure for Cloud SQL Postgres
   ENV spring.datasource.url=jdbc:postgresql://CLOUD_SQL_PRIVATE_IP:5432/hapi_fhir
   ENV spring.datasource.username=fhir_user
   ENV spring.datasource.driverClassName=org.postgresql.Driver
   ENV spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
   ENV hapi.fhir.allow_multiple_delete=true
   ENV hapi.fhir.allow_external_references=true
   ENV hapi.fhir.cors.allowed_origin_patterns=*
   ENV hapi.fhir.cors.allow_credentials=true
   ENV hapi.fhir.enable_index_missing_fields=true
   ENV hapi.fhir.tester.home.server_address=http://localhost:8080/fhir
   ```
   Note: The password should be injected at runtime via Secret Manager / environment variable, NOT baked into the image.

2. **Build and push to Artifact Registry:**
   ```bash
   docker build -t us-west1-docker.pkg.dev/ai-poc-project-483817/clinical-trial-repo/hapi-fhir:latest .
   docker push us-west1-docker.pkg.dev/ai-poc-project-483817/clinical-trial-repo/hapi-fhir:latest
   ```

3. **Deploy to Cloud Run:**
   ```bash
   gcloud run deploy hapi-fhir-server \
     --image us-west1-docker.pkg.dev/ai-poc-project-483817/clinical-trial-repo/hapi-fhir:latest \
     --region us-west1 \
     --platform managed \
     --port 8080 \
     --memory 1Gi \
     --cpu 1 \
     --min-instances 0 \
     --max-instances 2 \
     --vpc-connector clinical-trial-connector \
     --set-secrets "spring.datasource.password=clinical-trial-db-password:latest" \
     --allow-unauthenticated
   ```

4. **Verify** the FHIR server is running:
   ```bash
   curl https://<CLOUD_RUN_URL>/fhir/metadata
   ```
   Should return the server's CapabilityStatement.

### Important Notes

- HAPI FHIR needs ~30-60 seconds for cold start on Cloud Run (Java startup). This is acceptable for a POC.
- Set `--min-instances 1` during active demo periods to avoid cold starts for stakeholders.
- CORS must be wide open (`*`) since our React dashboard will call the FHIR API directly during development.
- The HAPI FHIR server auto-creates its database schema on first boot.

### Expected Output

- Docker image pushed to Artifact Registry
- Cloud Run service `hapi-fhir-server` running
- FHIR base URL: `https://hapi-fhir-server-<hash>-uw.a.run.app/fhir`
- Verified with `/metadata` endpoint returning CapabilityStatement

---

## CHUNK 4 — Data Loading Script

### Context for LLM

You are building a Python script that reads the FHIR Transaction Bundle JSON files (from Chunk 2) and POSTs them to the HAPI FHIR server (from Chunk 3). This is a one-shot data loader.

### Tasks

1. **Create `pipeline/load_to_fhir.py`**:
   - Accept FHIR server base URL as argument (e.g., `https://hapi-fhir-server-xxx.run.app/fhir`).
   - Load and POST `study_bundle.json` first (creates ResearchStudy + Organizations).
   - Then iterate through all `patient_bundle_*.json` files and POST each as a Transaction Bundle.
   - Use `requests` library. POST to `{base_url}/` with `Content-Type: application/fhir+json`.
   - Handle errors gracefully — log failures per bundle, continue with next patient.
   - Add a progress bar (`tqdm`).
   - After loading, verify by querying: `GET /fhir/Patient?_summary=count` and `GET /fhir/ResearchStudy`.

2. **Create a convenience script** `scripts/load_data.sh`:
   ```bash
   #!/bin/bash
   FHIR_SERVER_URL=${1:-"http://localhost:8080/fhir"}
   python -m pipeline.load_to_fhir --server-url $FHIR_SERVER_URL --bundle-dir data/fhir_bundles/
   ```

### Expected Output

- All 200 patient bundles + study bundle loaded into HAPI FHIR.
- Console output showing: X patients loaded, Y resources created, Z errors.
- Verification queries confirming resource counts.

---

## CHUNK 5 — FastAPI Backend + Validation Engine

### Context for LLM

You are building a FastAPI backend that serves as the API layer between the React dashboard and the FHIR server. It handles: (1) proxying FHIR queries with convenience endpoints, (2) file upload and validation, (3) FHIR transformation of uploaded data, (4) dataset metadata management.

This backend connects to:
- HAPI FHIR server (for FHIR operations)
- Cloud SQL Postgres `app_metadata` database (for dataset tracking)
- GCS bucket `gs://ai-poc-project-483817-clinical-uploads/` (for raw file storage)

### Project Structure

```
backend/
  app/
    __init__.py
    main.py              # FastAPI app, CORS, lifespan
    config.py            # Environment-based config (FHIR URL, DB URL, GCS bucket)
    routers/
      fhir_proxy.py      # Proxy routes to FHIR server
      upload.py           # File upload + validation endpoints
      datasets.py         # Dataset registry CRUD
    models/
      database.py         # SQLAlchemy models for metadata
      schemas.py          # Pydantic request/response models
    services/
      validator.py        # Validation engine (see details below)
      fhir_loader.py      # Reuses pipeline/ transform + load logic
      gcs.py              # GCS upload helper
    middleware/
      error_handler.py    # Global exception handling
  requirements.txt
  Dockerfile
```

### API Endpoints

#### FHIR Proxy Routes (`/api/fhir/`)

These simplify FHIR queries for the dashboard. The dashboard calls our backend; we call HAPI FHIR.

```
GET  /api/fhir/studies                    → GET /fhir/ResearchStudy
GET  /api/fhir/studies/{id}               → GET /fhir/ResearchStudy/{id}?_include=*
GET  /api/fhir/studies/{id}/patients      → GET /fhir/ResearchSubject?study={id}&_include=ResearchSubject:individual
GET  /api/fhir/studies/{id}/adverse-events → GET /fhir/AdverseEvent?study={id}&_count=1000
GET  /api/fhir/studies/{id}/observations   → GET /fhir/Observation?_has:Patient:...&category={category}&_count=1000
GET  /api/fhir/patients/{id}/timeline     → Multiple FHIR queries aggregated: AEs + Observations + MedicationAdministrations for one patient
```

#### Upload Routes (`/api/upload/`)

```
POST /api/upload/validate          # Upload file(s), run validation only, return report
POST /api/upload/load              # Upload file(s), validate, transform to FHIR, load into server
GET  /api/upload/templates         # Download CSV/Excel templates
GET  /api/upload/templates/{domain} # Download template for specific domain
```

#### Dataset Routes (`/api/datasets/`)

```
GET    /api/datasets/              # List all datasets with status
GET    /api/datasets/{id}          # Get dataset details + validation report
DELETE /api/datasets/{id}          # Delete dataset (removes from FHIR server + metadata)
```

### Validation Engine (`services/validator.py`)

This is the core of the upload feature. Use **Pydantic v2 models in strict mode** for schema validation.

#### Schema Models (one per domain)

```python
from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional
from datetime import date

class DemographicsRow(BaseModel):
    SUBJID: str = Field(..., pattern=r"^SUBJ-\d{3}$")
    SITEID: str = Field(..., pattern=r"^SITE-\d{2}$")
    ARM: Literal["PEMBRO", "CHEMO"]
    AGE: int = Field(..., ge=18, le=100)
    SEX: Literal["M", "F", "U"]
    RACE: Literal[
        "WHITE",
        "BLACK OR AFRICAN AMERICAN",
        "ASIAN",
        "AMERICAN INDIAN OR ALASKA NATIVE",
        "NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER",
        "OTHER",
        "UNKNOWN"
    ]
    ETHNIC: Literal["HISPANIC OR LATINO", "NOT HISPANIC OR LATINO", "UNKNOWN"]
    COUNTRY: str
    RFSTDTC: date
    RFENDTC: Optional[date] = None
    DTHFL: Optional[Literal["Y"]] = None

class AdverseEventRow(BaseModel):
    SUBJID: str
    AETERM: str = Field(..., min_length=1)
    AEDECOD: str = Field(..., min_length=1)
    AEBODSYS: str = Field(..., min_length=1)
    AESEV: Literal["MILD", "MODERATE", "SEVERE"]
    AETOXGR: int = Field(..., ge=1, le=5)
    AESER: Literal["Y", "N"]
    AEREL: Literal["RELATED", "NOT RELATED", "POSSIBLY RELATED"]
    AEACN: Literal["DOSE NOT CHANGED", "DOSE REDUCED", "DRUG WITHDRAWN", "DRUG INTERRUPTED", "NOT APPLICABLE"]
    AEOUT: Literal["RECOVERED", "RECOVERING", "NOT RECOVERED", "RECOVERED WITH SEQUELAE", "FATAL"]
    AESTDTC: date
    AEENDTC: Optional[date] = None

# ... similar models for VitalSignRow, LabResultRow, MedicationRow, DispositionRow
```

#### Validation Pipeline

The validator runs in stages and collects all errors (doesn't fail on first error):

```python
class ValidationReport:
    dataset_id: str
    status: Literal["VALID", "INVALID", "VALID_WITH_WARNINGS"]
    domains: dict[str, DomainReport]  # keyed by domain name

class DomainReport:
    domain: str
    row_count: int
    status: Literal["VALID", "INVALID", "VALID_WITH_WARNINGS"]
    errors: list[ValidationError]    # hard failures
    warnings: list[ValidationError]  # soft warnings

class ValidationError:
    row: int
    column: str
    value: str
    message: str
    severity: Literal["ERROR", "WARNING"]
```

**Stage 1 — File format check:** Can we read the file? Is it CSV/XLSX/JSON? Are required domain files present?

**Stage 2 — Schema validation:** For each row in each domain CSV, validate against the Pydantic model. Collect all errors with row numbers.

**Stage 3 — Controlled terminology check:** Verify all coded values against allowed enumerations. This is mostly handled by the Pydantic `Literal` types, but add custom checks for things like MedDRA terms and LOINC codes.

**Stage 4 — Cross-domain referential integrity:**
- Every SUBJID in AE, VS, LB, CM, DS must exist in demographics.
- Every SITEID in demographics must be a valid site.
- AE onset dates (AESTDTC) must be on or after enrollment date (RFSTDTC).
- Lab/vital dates must be within study period.

**Stage 5 — Clinical plausibility (warnings only):**
- Age outside 18-85 range.
- Vital signs outside physiological bounds (e.g., HR < 30 or > 200, SYSBP < 60 or > 250).
- Lab values that suggest unit errors (e.g., ALT > 10000).
- AE end date before start date.
- Grade 5 AE without FATAL outcome (and vice versa).

#### Supported Input Formats

1. **CSV bundle:** Multiple CSV files uploaded together (one per domain). Detect domain from filename pattern.
2. **Excel workbook:** Single `.xlsx` file with sheets named by domain (Demographics, Adverse Events, Vital Signs, Labs, Medications, Disposition).
3. **FHIR Bundle JSON:** Direct upload of FHIR Transaction Bundle. Validate against FHIR R4 schema using `fhir.resources` model parsing.

### Database Schema (SQLAlchemy, `app_metadata` database)

```python
class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(UUID, primary_key=True, default=uuid4)
    study_name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    upload_timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="VALIDATING")  # VALIDATING, VALID, INVALID, LOADING, LOADED, ERROR
    file_type = Column(String)  # csv_bundle, xlsx, fhir_json
    gcs_path = Column(String)  # GCS path to raw uploaded files
    fhir_research_study_id = Column(String, nullable=True)  # FHIR ResearchStudy resource ID once loaded
    validation_report = Column(JSON, nullable=True)  # Full validation report as JSON
    row_counts = Column(JSON, nullable=True)  # {"demographics": 50, "adverse_events": 200, ...}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### Dockerization

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Expected Output

- FastAPI app running locally on port 8000
- All endpoints functional
- Validation engine correctly validates the synthetic CSVs from Chunk 1
- Docker image built and pushed to Artifact Registry
- Deployed to Cloud Run as `clinical-trial-backend`

---

## CHUNK 6 — Dashboard: Study Overview

### Context for LLM

You are building the first view of the React dashboard for the clinical trial FHIR platform. This is the **Study Overview** — the landing page that gives a high-level summary of a selected clinical trial.

Use **React 18** with **Vite** as the build tool, **Tailwind CSS** for styling, and **Recharts** for data visualization. The dashboard should look polished and modern — think clinical data analytics platform, not a basic admin panel.

### Project Setup

```bash
npm create vite@latest dashboard -- --template react
cd dashboard
npm install tailwindcss @tailwindcss/vite recharts axios react-router-dom lucide-react
```

### App Structure

```
dashboard/
  src/
    App.jsx                    # Router setup
    main.jsx
    api/
      client.js                # Axios instance pointing to FastAPI backend
      fhir.js                  # FHIR-specific API calls
    components/
      layout/
        Sidebar.jsx            # Navigation sidebar
        Header.jsx             # Top bar with study selector
        Layout.jsx             # Main layout wrapper
      study-overview/
        EnrollmentWaterfall.jsx  # Waterfall chart: screened → randomized → completed → withdrawn
        EnrollmentTimeline.jsx   # Line chart: cumulative enrollment over time by arm
        SiteEnrollmentTable.jsx  # Table showing enrollment per site
        ArmDistribution.jsx      # Pie/donut chart of randomization
        StudySummaryCards.jsx     # KPI cards: total patients, sites, completion rate, AE rate
      common/
        Card.jsx               # Reusable card wrapper
        LoadingSpinner.jsx
        FhirJsonDrawer.jsx     # Slide-out panel showing raw FHIR JSON for any resource
    hooks/
      useFhirQuery.js          # Custom hook for FHIR API calls with loading/error states
    pages/
      StudyOverview.jsx        # Composes the study overview components
      SafetyDashboard.jsx      # Placeholder for Chunk 7
      PatientJourney.jsx       # Placeholder for Chunk 8
      DataManagement.jsx       # Placeholder for Chunk 9
    utils/
      fhirHelpers.js           # Parse FHIR resources into chart-friendly data structures
```

### Key Feature: FHIR JSON Drawer

Every chart and data point should have a small "{ }" icon button. Clicking it opens a slide-out drawer showing the raw FHIR JSON that sourced that visualization. This is a critical demo feature — it proves the data is coming from FHIR and lets technical stakeholders inspect the resources.

### API Calls (via FastAPI backend)

```javascript
// Get list of studies
const studies = await api.get('/api/fhir/studies');

// Get patients for a study
const patients = await api.get(`/api/fhir/studies/${studyId}/patients`);

// Dashboard computes aggregations client-side from FHIR resources
```

### Components Detail

#### StudySummaryCards
- Total Enrolled: count of ResearchSubject resources
- Active Sites: count of distinct Organization references
- Completion Rate: (completed ResearchSubjects / total) × 100
- Overall AE Rate: (patients with ≥1 AE / total) × 100

#### EnrollmentWaterfall
- Horizontal waterfall chart showing: Screened (200) → Randomized (200) → Active (varies) → Completed (varies) → Discontinued (varies, broken down by reason)
- Color-coded: green for positive flow, red for dropoff
- Data derived from ResearchSubject statuses and disposition

#### EnrollmentTimeline
- Line chart with two lines (PEMBRO arm, CHEMO arm) showing cumulative enrollment over time
- X-axis: dates, Y-axis: patient count
- Derived from ResearchSubject.period.start dates

#### ArmDistribution
- Donut chart: PEMBRO vs CHEMO arm split
- Show count and percentage
- Color-coded by arm (consistent colors used throughout dashboard)

#### SiteEnrollmentTable
- Sortable table: Site ID | Site Name | Total Enrolled | PEMBRO | CHEMO | Completion Rate
- Derived from Patient.managingOrganization + ResearchSubject data

### Styling Guidelines

- Dark sidebar with light main content area.
- Color palette: Use a professional clinical/medical feel. Primary blue (#2563EB), success green (#10B981), warning amber (#F59E0B), danger red (#EF4444). Arm colors: PEMBRO = blue (#3B82F6), CHEMO = purple (#8B5CF6).
- Cards with subtle shadows and rounded corners.
- Consistent 16px/24px spacing grid.
- Use `lucide-react` icons throughout.

### Expected Output

- React app running locally (`npm run dev`) showing the Study Overview page
- All 5 components rendering with data from the FHIR server (via FastAPI)
- FHIR JSON drawer working on at least 2 components
- Responsive layout (works on 1920px and 1440px widths)

---

## CHUNK 7 — Dashboard: Safety Dashboard

### Context for LLM

You are building the **Safety Dashboard** view of the clinical trial dashboard. This is the most data-dense view and the one clinical operations/safety teams care about most. It visualizes adverse events, lab trends, and vital sign data — all sourced from FHIR `AdverseEvent` and `Observation` resources.

### Components to Build

```
src/components/safety/
  AEFrequencyChart.jsx       # Horizontal bar chart of AEs by System Organ Class
  AEButterflyPlot.jsx        # Butterfly/tornado plot comparing AE rates between arms
  AEGradeHeatmap.jsx         # Heatmap: AE term × Grade, colored by frequency
  LabShiftPlot.jsx           # Scatter plot: baseline value vs. worst post-baseline value
  LabTrendChart.jsx          # Line chart: mean lab values over time by arm
  VitalSignsTrend.jsx        # Line chart: mean vital signs over time by arm
  SafetyFilters.jsx          # Filter bar: arm, grade, SOC, date range
```

### Page Layout (`pages/SafetyDashboard.jsx`)

Top: SafetyFilters (sticky)
Row 1: AEFrequencyChart (full width)
Row 2: AEButterflyPlot (half) | AEGradeHeatmap (half)
Row 3: LabShiftPlot (half) | LabTrendChart (half)
Row 4: VitalSignsTrend (full width)

### Component Details

#### AEButterflyPlot (the "wow" chart)
This is the signature clinical trial safety visualization. It's a horizontal bar chart mirrored around a center axis:
- Left side: PEMBRO arm AE rates (% of patients)
- Right side: CHEMO arm AE rates (% of patients)
- Y-axis: AE preferred terms (top 15 by frequency)
- Color intensity indicates CTCAE grade (Grade 1-2 lighter, Grade 3+ darker)
- This chart alone will make clinical ops people recognize you know the domain.

#### AEGradeHeatmap
- Rows: AE preferred terms
- Columns: CTCAE Grades 1-5
- Cell color: count of occurrences (white → light → dark gradient)
- Separate heatmaps for each arm (side by side)

#### LabShiftPlot
- Scatter plot per lab test (dropdown selector: ALT, AST, HGB, ANC, PLT, etc.)
- X-axis: baseline value, Y-axis: worst post-baseline value
- Reference lines at ULN/LLN creating quadrants
- Points colored by arm
- Clinically important: shows which patients shifted from normal to abnormal

#### LabTrendChart
- Line chart showing mean + error bars (95% CI) for a selected lab test over visit numbers
- Two lines: PEMBRO and CHEMO arms
- Horizontal reference lines at ULN/LLN
- Dropdown to select lab test

#### VitalSignsTrend
- Similar to LabTrendChart but for vital signs
- Tabs or dropdown for: SBP, DBP, HR, Weight, Temperature

### API Calls

```javascript
// Adverse events for study (already paginated by backend)
const aes = await api.get(`/api/fhir/studies/${studyId}/adverse-events`);

// Lab observations - may need pagination for large datasets
const labs = await api.get(`/api/fhir/studies/${studyId}/observations?category=laboratory`);

// Vital sign observations
const vitals = await api.get(`/api/fhir/studies/${studyId}/observations?category=vital-signs`);
```

### Data Processing (client-side in `utils/fhirHelpers.js`)

- Parse FHIR `AdverseEvent` resources → extract event coding, severity, date, subject arm
- Parse FHIR `Observation` resources → extract code, value, date, subject arm, visit number
- Aggregate for charts: group by arm, calculate rates (% of patients), means, shifts
- The FHIR JSON drawer should work on every chart (show the raw resources behind any data point)

### Expected Output

- Safety Dashboard page with all 7 components rendering
- Butterfly plot correctly showing arm comparison
- Lab shift plot with interactive test selector
- All charts responding to arm filter
- FHIR JSON drawer accessible from each chart

---

## CHUNK 8 — Dashboard: Patient Journey

### Context for LLM

You are building the **Patient Journey** view — a patient-level timeline that shows all clinical events for a single patient. This is the most "wow" view for clinical data managers because they never get a unified longitudinal view like this from their EDC systems.

### Components to Build

```
src/components/patient-journey/
  PatientSelector.jsx        # Search/dropdown to pick a patient
  PatientDemographics.jsx    # Card showing patient info (age, sex, arm, site, enrollment dates)
  PatientTimeline.jsx        # The main horizontal timeline visualization
  TimelineEvent.jsx          # Individual event on the timeline (reusable)
  PatientLabChart.jsx        # Sparkline-style lab trends for selected patient
  PatientVitalsChart.jsx     # Sparkline-style vital sign trends
  EventDetailModal.jsx       # Click an event → modal with full FHIR resource detail
```

### The Timeline (core feature)

This is a horizontal timeline (left = enrollment date, right = last contact date) with events plotted chronologically. Multiple swim lanes:

```
Lane 1: Study Drug Administrations  ──●──●──●──●──●──●──●──●──
Lane 2: Adverse Events              ───[███]────[█████]──[██]──
Lane 3: Lab Alerts (abnormals)       ────▲──────▲────▲──────────
Lane 4: Vital Sign Alerts            ─────────▲──────────────────
Lane 5: Disposition Events           ●─────────────────────────●
```

- **Drug administrations:** Small dots at each dosing date. Color = drug. Tooltip shows dose.
- **Adverse events:** Horizontal bars spanning from AESTDTC to AEENDTC. Color intensity = CTCAE grade (Grade 1 = light yellow, Grade 2 = orange, Grade 3 = red, Grade 4 = dark red, Grade 5 = black). Bar label shows AE term. Click to expand details.
- **Lab alerts:** Triangle markers at dates where a lab value crossed normal range. Color = red for high, blue for low. Tooltip shows test and value.
- **Vital sign alerts:** Similar to lab alerts but for vital sign outliers.
- **Disposition:** Key milestones (enrolled, randomized, completed/discontinued).

### API Call

```javascript
// Single API call that returns everything for one patient
const timeline = await api.get(`/api/fhir/patients/${patientId}/timeline`);
// Returns: { patient, researchSubject, adverseEvents, observations, medications, encounters }
```

### Interaction Design

- Click any event → EventDetailModal shows the full FHIR resource JSON + human-readable summary
- Zoom in/out on the timeline (brush selection or scroll)
- Toggle swim lanes on/off
- Below the timeline: PatientLabChart and PatientVitalsChart showing detailed trends for the selected patient (small multiples — one sparkline per lab test/vital)

### Building the Timeline

Use either:
- Pure SVG rendered in React (most control, recommended for this)
- Or `d3` for the timeline axis + event rendering

Do NOT use a heavy timeline library — we need full control over the visual design.

### Expected Output

- Patient Journey page with patient selector
- Horizontal multi-lane timeline rendering correctly with synthetic data
- Events color-coded and interactive (click for detail)
- Lab and vital sparklines below the timeline
- FHIR JSON accessible for every event

---

## CHUNK 9 — Dashboard: Data Management UI

### Context for LLM

You are building the **Data Management** section of the dashboard where users can upload their own clinical trial datasets, validate them, and load them into the FHIR server. This connects to the FastAPI upload/validation endpoints built in Chunk 5.

### Components to Build

```
src/components/data-management/
  FileUploader.jsx           # Drag-and-drop upload zone with format selector
  ValidationReport.jsx       # Visual report showing validation results per domain
  DomainReportCard.jsx       # Card for one domain's validation result
  ErrorTable.jsx             # Expandable table of validation errors/warnings
  DatasetRegistry.jsx        # Table of all uploaded datasets
  DatasetDetailDrawer.jsx    # Slide-out showing dataset details + validation report
  TemplateDownload.jsx       # Download section for CSV/Excel templates
```

### Page Layout (`pages/DataManagement.jsx`)

Two tabs:

**Tab 1: Upload & Validate**
- TemplateDownload section at top (collapsible)
- FileUploader (drag-drop zone)
- Format selector: CSV files, Excel workbook, FHIR Bundle JSON
- After upload: ValidationReport appears below
- If valid: "Load into FHIR Server" button with study name input
- If invalid: error details + "Fix and Re-upload" prompt

**Tab 2: Dataset Registry**
- DatasetRegistry table showing all datasets
- Click row → DatasetDetailDrawer opens

### FileUploader Component

- Drag-and-drop zone with visual feedback (border highlight on drag-over)
- For CSV: accept multiple files. Show filename badges as files are added. Require at minimum demographics.csv.
- For Excel: accept single .xlsx file.
- For FHIR JSON: accept single .json file.
- "Validate" button triggers upload to `/api/upload/validate`
- Show loading spinner with progress indication during validation

### ValidationReport Component

Shows a card per domain:
```
┌─────────────────────────────────────────────┐
│ ✅ Demographics          198 rows    VALID   │
├─────────────────────────────────────────────┤
│ ⚠️ Adverse Events        734 rows    3 WARN  │
│   ├── Row 45: AETOXGR=5 but AEOUT≠FATAL    │
│   ├── Row 112: AESTDTC before RFSTDTC       │
│   └── Row 389: AESEV=MILD but AETOXGR=3     │
├─────────────────────────────────────────────┤
│ ❌ Lab Results           12,430 rows  7 ERR  │
│   ├── Row 23: LBTESTCD "XYZ" not recognized │
│   ├── Row 891: LBORRES is non-numeric       │
│   └── [Show 5 more...]                      │
└─────────────────────────────────────────────┘
```

Color coding: Green = valid, Yellow = valid with warnings, Red = invalid (has errors).
Errors are expandable — show first 3, click to expand all.
Warnings don't block loading; errors do.

### TemplateDownload Component

- Cards for each format (CSV bundle, Excel workbook)
- CSV: downloads a .zip containing template CSVs with headers + 3 example rows + column descriptions as comments
- Excel: downloads a .xlsx with sheets per domain, same example data
- Link to documentation page explaining each field

### Dataset Registry Component

| Study Name | Upload Date | Format | Status | Patients | AEs | Actions |
|-----------|------------|--------|--------|----------|-----|---------|
| ONCO-2024-PD1-301 | 2024-03-15 | Synthetic | LOADED | 200 | 847 | View / Delete |
| My Trial Data | 2024-03-16 | CSV | VALID | 50 | 123 | Load / Delete |

- Status badges: VALIDATING (spinner), VALID (green), INVALID (red), LOADING (spinner), LOADED (blue), ERROR (red)
- "View" opens DatasetDetailDrawer
- "Load" triggers FHIR transformation + loading (calls `/api/upload/load`)
- "Delete" removes from FHIR server + metadata (with confirmation dialog)
- Clicking a LOADED dataset switches the entire dashboard to view that study's data

### Expected Output

- Data Management page with both tabs functional
- File upload working for CSV and Excel formats
- Validation report rendering correctly
- Dataset registry showing the pre-loaded synthetic data + any uploaded datasets
- Template download providing usable templates

---

## CHUNK 10 — AI Assistant Panel

### Context for LLM

You are building a **Claude-powered AI assistant** embedded in the dashboard sidebar. Users can ask natural language questions about the clinical trial data, and the assistant translates them into FHIR queries, fetches results, and presents answers — sometimes with inline charts or tables.

### Architecture

The AI assistant runs **client-side** using the Anthropic API (available in React artifacts via `fetch` to `api.anthropic.com`). The flow:

1. User types a question in the chat panel
2. Frontend sends the question + current study context to Claude API
3. Claude's system prompt instructs it to generate FHIR search queries
4. Claude responds with a plan + FHIR queries
5. Frontend executes those FHIR queries against the backend
6. Results are sent back to Claude for interpretation
7. Claude provides a human-readable answer

### Components

```
src/components/ai-assistant/
  AssistantPanel.jsx        # Sidebar chat panel (collapsible)
  ChatMessage.jsx           # Individual message bubble
  QueryPlan.jsx             # Shows the FHIR queries Claude generated (expandable)
  ResultTable.jsx           # Inline table for tabular results
  ResultChart.jsx           # Inline mini-chart for visual results
```

### System Prompt for Claude

```
You are a clinical trial data analyst assistant. You have access to a FHIR R4 server containing clinical trial data. When the user asks a question, you must:

1. Determine which FHIR resources and search parameters are needed
2. Return a JSON block with the FHIR queries to execute
3. After receiving results, provide a clear, concise answer

Available FHIR resources:
- ResearchStudy: Trial protocol information
- ResearchSubject: Patient enrollment (has assignedArm)
- Patient: Demographics
- AdverseEvent: Adverse events (has severity, event coding, suspectEntity)
- Observation: Labs (category=laboratory) and vitals (category=vital-signs), coded with LOINC
- MedicationAdministration: Study drug dosing
- MedicationStatement: Concomitant medications

Current study context:
- ResearchStudy ID: {studyId}
- Arms: PEMBRO (immunotherapy), CHEMO (chemotherapy)
- FHIR base URL: {fhirBaseUrl}

When you need to query data, respond with a JSON block:
{"queries": [{"description": "...", "url": "/fhir/AdverseEvent?study=ResearchStudy/xxx&severity=severe"}]}

After receiving results, analyze and answer the user's question. Use specific numbers. If comparing arms, provide both values.
```

### Example Interactions

**User:** "How many patients experienced Grade 3 or higher adverse events in each arm?"

**Claude's query plan:**
```json
{
  "queries": [
    {"description": "Get all AEs with grade 3+", "url": "/fhir/AdverseEvent?study=ResearchStudy/xxx&severity=severe&_count=500"},
    {"description": "Get patient arm assignments", "url": "/fhir/ResearchSubject?study=ResearchStudy/xxx&_count=500"}
  ]
}
```

**Claude's answer:** "In the PEMBRO arm, 23 out of 100 patients (23%) experienced at least one Grade 3+ adverse event, compared to 31 out of 100 (31%) in the CHEMO arm. The most common Grade 3+ events in PEMBRO were pneumonitis (5 patients) and colitis (4 patients), while in CHEMO they were neutropenia (12 patients) and anemia (8 patients)."

---

**User:** "Show me all patients with ALT > 3x ULN"

**Claude's query plan:**
```json
{
  "queries": [
    {"description": "Get ALT observations above reference range", "url": "/fhir/Observation?code=1742-6&_count=1000"}
  ]
}
```

**Claude's answer:** (returns a table of patients with elevated ALT, their arm, and peak values)

### Implementation Notes

- Use the Anthropic API with `claude-sonnet-4-20250514` model.
- Implement as a multi-turn conversation so users can ask follow-up questions.
- Show the FHIR queries Claude generated (expandable section) — this reinforces the interop demo.
- Cache FHIR results in React state to avoid redundant queries within a session.
- Add suggested starter questions: "Compare AE rates between arms", "Which patients discontinued due to adverse events?", "Show lab trends for hepatotoxicity markers"

### Expected Output

- Collapsible AI panel on the right side of the dashboard
- Working multi-turn conversation
- FHIR queries displayed and executed
- Results rendered as text, tables, or mini-charts depending on the answer type

---

## CHUNK 11 — Final Integration, Polish & Deploy

### Context for LLM

You are doing final integration, UI polish, and deploying all services to GCP Cloud Run.

### Tasks

#### Integration

1. **Study selector in header**: Dropdown that lists all loaded studies (from dataset registry). Changing the study reloads all dashboard views with the new study's data.
2. **Navigation**: Sidebar links to all 4 pages (Study Overview, Safety, Patient Journey, Data Management). Active page highlighted.
3. **AI Assistant**: Available on all pages (slides out from right edge). Context-aware — knows which page/study the user is viewing.
4. **Loading states**: All pages show skeleton loaders while FHIR data is fetching.
5. **Error states**: If FHIR server is unreachable, show a clear error with retry button.

#### UI Polish

1. **Landing page**: If no study is selected, show a welcome screen with instructions + "Load Sample Data" button that triggers the synthetic data load.
2. **Consistent theming**: Verify all charts use the arm color scheme consistently.
3. **Responsive**: Test at 1920px, 1440px, and 1280px widths.
4. **Page transitions**: Smooth transitions between pages (React Router with fade).
5. **Favicon + title**: Set appropriate app title and favicon.

#### Deployment

1. **Build React dashboard:**
   ```bash
   npm run build
   ```
   Create a Dockerfile serving the build with Nginx:
   ```dockerfile
   FROM nginx:alpine
   COPY dist/ /usr/share/nginx/html
   COPY nginx.conf /etc/nginx/conf.d/default.conf
   ```

2. **Deploy all 3 services to Cloud Run:**

   ```bash
   # Dashboard
   gcloud run deploy clinical-trial-dashboard \
     --image us-west1-docker.pkg.dev/ai-poc-project-483817/clinical-trial-repo/dashboard:latest \
     --region us-west1 \
     --port 80 \
     --min-instances 0 \
     --max-instances 2 \
     --allow-unauthenticated

   # FastAPI Backend
   gcloud run deploy clinical-trial-backend \
     --image us-west1-docker.pkg.dev/ai-poc-project-483817/clinical-trial-repo/backend:latest \
     --region us-west1 \
     --port 8000 \
     --memory 1Gi \
     --min-instances 0 \
     --max-instances 2 \
     --vpc-connector clinical-trial-connector \
     --set-secrets "DB_PASSWORD=clinical-trial-db-password:latest" \
     --set-env-vars "FHIR_SERVER_URL=https://hapi-fhir-server-xxx.run.app/fhir" \
     --set-env-vars "GCS_BUCKET=ai-poc-project-483817-clinical-uploads" \
     --allow-unauthenticated

   # HAPI FHIR (already deployed in Chunk 3, verify still running)
   ```

3. **Update environment variables:**
   - Dashboard's `api/client.js` needs the backend Cloud Run URL
   - Backend needs the HAPI FHIR Cloud Run URL
   - Set these as build-time env vars or Cloud Run env vars

4. **Run the data loader** against the deployed FHIR server to populate synthetic data.

5. **Smoke test all features:**
   - [ ] Study Overview loads with charts
   - [ ] Safety Dashboard shows AE butterfly plot
   - [ ] Patient Journey timeline renders
   - [ ] Upload CSV → validation → load → data appears in dashboard
   - [ ] AI Assistant answers questions
   - [ ] FHIR JSON drawer shows raw resources
   - [ ] Study selector switches between datasets

### Expected Output

- Three Cloud Run services running
- Dashboard accessible via public Cloud Run URL
- All features working end-to-end
- Synthetic data pre-loaded
- Ready for stakeholder demo

---

## Quick Reference: Chunk Sizes & Estimates

| Chunk | Description | Estimated Complexity | Key Deliverable |
|-------|------------|---------------------|-----------------|
| 0 | GCP Infrastructure | Low | Infra resources created |
| 1 | Synthetic Data Gen | Medium | 6 CSV files + metadata |
| 2 | FHIR Transform Pipeline | High | Python module + FHIR bundles |
| 3 | HAPI FHIR Server Deploy | Low-Medium | Running FHIR server on Cloud Run |
| 4 | Data Loading Script | Low | Script + loaded data |
| 5 | FastAPI + Validation | High | Backend API + validation engine |
| 6 | Dashboard: Study Overview | Medium | React app + 5 chart components |
| 7 | Dashboard: Safety | High | 7 chart components (butterfly plot!) |
| 8 | Dashboard: Patient Journey | High | SVG timeline visualization |
| 9 | Dashboard: Data Mgmt | Medium | Upload + validate + registry UI |
| 10 | AI Assistant | Medium | Claude-powered chat panel |
| 11 | Integration & Deploy | Medium | All services deployed + polished |

**Total: 12 chunks, ~3-5 days of focused LLM-assisted development.**

---

## Notes for Claude Code / LLM Prompting

When feeding these chunks to your LLM:

1. **Always include the project overview** at the top of your prompt so the LLM has full context.
2. **Include the previous chunk's output** description so it knows what already exists.
3. **One chunk per session** — each chunk is scoped to produce a testable deliverable.
4. **Test after each chunk** before moving to the next. The dependency chain means a bug in Chunk 2 will cascade.
5. **For the React chunks (6-10):** feed the component list + API shape + a screenshot/mockup description. The LLM works best when it knows the visual target.
6. **For the data chunks (1-2):** the detailed table schemas above should be included verbatim — they're the spec.
