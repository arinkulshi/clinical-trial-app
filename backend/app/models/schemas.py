"""Pydantic request/response schemas for the API."""

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── Validation row models (strict) ──────────────────────────────────────


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
        "UNKNOWN",
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
    AEACN: Literal[
        "DOSE NOT CHANGED",
        "DOSE REDUCED",
        "DRUG WITHDRAWN",
        "DRUG INTERRUPTED",
        "NOT APPLICABLE",
    ]
    AEOUT: Literal[
        "RECOVERED",
        "RECOVERING",
        "NOT RECOVERED",
        "RECOVERED WITH SEQUELAE",
        "FATAL",
    ]
    AESTDTC: date
    AEENDTC: Optional[date] = None


class VitalSignRow(BaseModel):
    SUBJID: str
    VSTESTCD: Literal["SYSBP", "DIABP", "HR", "TEMP", "WEIGHT", "HEIGHT"]
    VSTEST: str = Field(..., min_length=1)
    VSORRES: float
    VSORRESU: str = Field(..., min_length=1)
    VSDTC: date
    VISITNUM: int = Field(..., ge=1)
    VSBLFL: Optional[Literal["Y"]] = None


class LabResultRow(BaseModel):
    SUBJID: str
    LBTESTCD: str = Field(..., min_length=1)
    LBTEST: str = Field(..., min_length=1)
    LBORRES: float
    LBORRESU: str = Field(..., min_length=1)
    LBSTNRLO: Optional[float] = None
    LBSTNRHI: Optional[float] = None
    LBDTC: date
    VISITNUM: int = Field(..., ge=1)
    LBBLFL: Optional[Literal["Y"]] = None
    LBLOINC: Optional[str] = None


class MedicationRow(BaseModel):
    SUBJID: str
    CMTRT: str = Field(..., min_length=1)
    CMDOSE: float
    CMDOSU: str = Field(..., min_length=1)
    CMROUTE: str = Field(..., min_length=1)
    CMSTDTC: date
    CMENDTC: Optional[date] = None
    CMCAT: Literal["STUDY DRUG", "CONCOMITANT"]
    VISITNUM: int = Field(..., ge=1)


class DispositionRow(BaseModel):
    SUBJID: str
    DSSCAT: Literal["ENROLLED", "RANDOMIZED", "COMPLETED", "DISCONTINUED"]
    DSDECOD: Literal[
        "COMPLETED",
        "ADVERSE EVENT",
        "PROGRESSIVE DISEASE",
        "DEATH",
        "WITHDRAWAL BY SUBJECT",
        "PHYSICIAN DECISION",
    ]
    DSSTDTC: date


# ── Domain-to-model mapping ────────────────────────────────────────────

DOMAIN_MODELS = {
    "demographics": DemographicsRow,
    "adverse_events": AdverseEventRow,
    "vital_signs": VitalSignRow,
    "lab_results": LabResultRow,
    "medications": MedicationRow,
    "disposition": DispositionRow,
}

# Excel sheet name -> domain key mapping
SHEET_NAME_MAP = {
    "Demographics": "demographics",
    "Adverse Events": "adverse_events",
    "Vital Signs": "vital_signs",
    "Labs": "lab_results",
    "Medications": "medications",
    "Disposition": "disposition",
}


# ── Validation report schemas ──────────────────────────────────────────


class ValidationError(BaseModel):
    row: int
    column: str
    value: str
    message: str
    severity: Literal["ERROR", "WARNING"]


class DomainReport(BaseModel):
    domain: str
    row_count: int
    status: Literal["VALID", "INVALID", "VALID_WITH_WARNINGS"]
    errors: list[ValidationError] = []
    warnings: list[ValidationError] = []


class ValidationReport(BaseModel):
    dataset_id: str
    status: Literal["VALID", "INVALID", "VALID_WITH_WARNINGS"]
    domains: dict[str, DomainReport] = {}


# ── API response schemas ───────────────────────────────────────────────


class DatasetResponse(BaseModel):
    id: str
    study_name: str
    description: Optional[str] = None
    upload_timestamp: Optional[datetime] = None
    status: str
    file_type: Optional[str] = None
    gcs_path: Optional[str] = None
    fhir_research_study_id: Optional[str] = None
    validation_report: Optional[dict] = None
    row_counts: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DatasetListResponse(BaseModel):
    datasets: list[DatasetResponse]
    total: int


class UploadResponse(BaseModel):
    dataset_id: str
    status: str
    validation_report: ValidationReport
    message: str
