"""File upload + validation endpoints."""

import io
import json
import logging
import uuid
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models.database import Dataset, get_db
from ..models.schemas import UploadResponse, ValidationReport
from ..services.gcs import upload_to_gcs
from ..services.validator import validate_dataset

router = APIRouter(prefix="/api/upload", tags=["upload"])
log = logging.getLogger(__name__)

# CSV templates for each domain
TEMPLATES = {
    "demographics": [
        "SUBJID", "SITEID", "ARM", "AGE", "SEX", "RACE", "ETHNIC",
        "COUNTRY", "RFSTDTC", "RFENDTC", "DTHFL",
    ],
    "adverse_events": [
        "SUBJID", "AETERM", "AEDECOD", "AEBODSYS", "AESEV", "AETOXGR",
        "AESER", "AEREL", "AEACN", "AEOUT", "AESTDTC", "AEENDTC",
    ],
    "vital_signs": [
        "SUBJID", "VSTESTCD", "VSTEST", "VSORRES", "VSORRESU",
        "VSDTC", "VISITNUM", "VSBLFL",
    ],
    "lab_results": [
        "SUBJID", "LBTESTCD", "LBTEST", "LBORRES", "LBORRESU",
        "LBSTNRLO", "LBSTNRHI", "LBDTC", "VISITNUM", "LBBLFL", "LBLOINC",
    ],
    "medications": [
        "SUBJID", "CMTRT", "CMDOSE", "CMDOSU", "CMROUTE",
        "CMSTDTC", "CMENDTC", "CMCAT", "VISITNUM",
    ],
    "disposition": [
        "SUBJID", "DSSCAT", "DSDECOD", "DSSTDTC",
    ],
}


@router.post("/validate", response_model=UploadResponse)
async def validate_upload(
    files: list[UploadFile] = File(...),
    study_name: str = Form("Uploaded Study"),
    description: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    """Upload file(s), run validation only, return report."""
    dataset_id = str(uuid.uuid4())

    # Read all uploaded files
    file_contents: dict[str, bytes] = {}
    for f in files:
        content = await f.read()
        file_contents[f.filename] = content

    # Determine file type
    file_type = _detect_file_type(list(file_contents.keys()))

    # Run validation
    report, row_counts = validate_dataset(dataset_id, file_contents)

    # Save dataset record
    dataset = Dataset(
        id=dataset_id,
        study_name=study_name,
        description=description or None,
        status=report.status,
        file_type=file_type,
        validation_report=report.model_dump(),
        row_counts=row_counts,
    )
    db.add(dataset)
    await db.commit()

    return UploadResponse(
        dataset_id=dataset_id,
        status=report.status,
        validation_report=report,
        message=f"Validation complete: {report.status}",
    )


@router.post("/load", response_model=UploadResponse)
async def validate_and_load(
    files: list[UploadFile] = File(...),
    study_name: str = Form("Uploaded Study"),
    description: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    """Upload file(s), validate, transform to FHIR, and load into server."""
    dataset_id = str(uuid.uuid4())
    settings = get_settings()

    # Read all uploaded files
    file_contents: dict[str, bytes] = {}
    for f in files:
        content = await f.read()
        file_contents[f.filename] = content

    file_type = _detect_file_type(list(file_contents.keys()))

    # Run validation
    report, row_counts = validate_dataset(dataset_id, file_contents)

    # Create dataset record
    dataset = Dataset(
        id=dataset_id,
        study_name=study_name,
        description=description or None,
        status="VALIDATING",
        file_type=file_type,
        validation_report=report.model_dump(),
        row_counts=row_counts,
    )
    db.add(dataset)
    await db.commit()

    if report.status == "INVALID":
        dataset.status = "INVALID"
        await db.commit()
        return UploadResponse(
            dataset_id=dataset_id,
            status="INVALID",
            validation_report=report,
            message="Validation failed. Data not loaded.",
        )

    # Upload raw files to GCS
    gcs_paths = []
    for filename, content in file_contents.items():
        gcs_path = f"datasets/{dataset_id}/{filename}"
        uri = await upload_to_gcs(settings.gcs_bucket, gcs_path, content)
        gcs_paths.append(uri)

    dataset.gcs_path = "; ".join(gcs_paths)
    dataset.status = "LOADING"
    await db.commit()

    # Transform and load into FHIR
    try:
        if file_type == "fhir_json":
            # Direct FHIR bundle load
            from ..services.fhir_loader import load_fhir_bundle_json

            total = 0
            load_errors = []
            for filename, content in file_contents.items():
                if filename.lower().endswith(".json"):
                    bundle = json.loads(content)
                    count, errs = load_fhir_bundle_json(settings.fhir_server_url, bundle)
                    total += count
                    load_errors.extend(errs)
        else:
            # CSV/XLSX -> FHIR transform -> load
            from ..services.fhir_loader import transform_and_load
            from ..services.validator import _read_file

            domain_dfs: dict[str, pd.DataFrame] = {}
            for filename, content in file_contents.items():
                domain_dfs.update(_read_file(filename, content))

            study_id, total, load_errors = transform_and_load(
                domain_dfs, settings.fhir_server_url, study_name
            )
            dataset.fhir_research_study_id = study_id

        if load_errors:
            dataset.status = "ERROR"
            log.error("Load errors: %s", load_errors)
        else:
            dataset.status = "LOADED"

    except Exception as exc:
        dataset.status = "ERROR"
        log.error("FHIR load failed: %s", exc)

    await db.commit()

    return UploadResponse(
        dataset_id=dataset_id,
        status=dataset.status,
        validation_report=report,
        message=f"Upload complete: {dataset.status}",
    )


@router.get("/templates")
async def list_templates():
    """List available CSV templates."""
    return {
        "templates": [
            {"domain": domain, "columns": cols}
            for domain, cols in TEMPLATES.items()
        ]
    }


@router.get("/templates/{domain}")
async def download_template(domain: str):
    """Download a CSV template for a specific domain."""
    columns = TEMPLATES.get(domain)
    if not columns:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown domain '{domain}'. Available: {list(TEMPLATES.keys())}",
        )
    # Create empty CSV with just headers
    df = pd.DataFrame(columns=columns)
    buf = io.StringIO()
    df.to_csv(buf, index=False)

    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={domain}_template.csv"},
    )


def _detect_file_type(filenames: list[str]) -> str:
    """Detect the upload file type from filenames."""
    extensions = {f.rsplit(".", 1)[-1].lower() for f in filenames if "." in f}
    if extensions == {"json"}:
        return "fhir_json"
    if "xlsx" in extensions or "xls" in extensions:
        return "xlsx"
    return "csv_bundle"
