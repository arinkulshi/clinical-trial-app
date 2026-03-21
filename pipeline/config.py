"""Pipeline configuration: paths and constants."""

from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
SYNTHETIC_DIR = DATA_DIR / "synthetic"
BUNDLE_DIR = DATA_DIR / "fhir_bundles"

STUDY_METADATA = SYNTHETIC_DIR / "study_metadata.json"
LOINC_MAP_FILE = SYNTHETIC_DIR / "LOINC_MAP.json"

DEMOGRAPHICS_CSV = SYNTHETIC_DIR / "demographics.csv"
ADVERSE_EVENTS_CSV = SYNTHETIC_DIR / "adverse_events.csv"
VITAL_SIGNS_CSV = SYNTHETIC_DIR / "vital_signs.csv"
LAB_RESULTS_CSV = SYNTHETIC_DIR / "lab_results.csv"
MEDICATIONS_CSV = SYNTHETIC_DIR / "medications.csv"
DISPOSITION_CSV = SYNTHETIC_DIR / "disposition.csv"

# ── FHIR Constants ────────────────────────────────────────────────────
FHIR_SYSTEM_IDENTIFIER = "http://example.org/fhir/clinical-trial"
FHIR_SYSTEM_SITE = "http://example.org/fhir/site"
FHIR_SYSTEM_SUBJECT = "http://example.org/fhir/subject"
FHIR_SYSTEM_PROTOCOL = "http://example.org/fhir/protocol"
LOINC_SYSTEM = "http://loinc.org"
SNOMED_SYSTEM = "http://snomed.info/sct"
MEDDRA_SYSTEM = "http://terminology.hl7.org/CodeSystem/mdr"

# US Core race/ethnicity extension URLs
US_CORE_RACE_URL = "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race"
US_CORE_ETHNICITY_URL = "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity"

# Race code mapping (SDTM -> OMB codes)
RACE_CODE_MAP = {
    "WHITE": {"code": "2106-3", "display": "White"},
    "BLACK OR AFRICAN AMERICAN": {"code": "2054-5", "display": "Black or African American"},
    "ASIAN": {"code": "2028-9", "display": "Asian"},
    "OTHER": {"code": "2131-1", "display": "Other Race"},
}

# Ethnicity code mapping
ETHNICITY_CODE_MAP = {
    "HISPANIC OR LATINO": {"code": "2135-2", "display": "Hispanic or Latino"},
    "NOT HISPANIC OR LATINO": {"code": "2186-5", "display": "Not Hispanic or Latino"},
}

# Gender mapping (SDTM -> FHIR)
GENDER_MAP = {"M": "male", "F": "female"}

# AE severity mapping
SEVERITY_MAP = {
    "MILD": {"code": "mild", "display": "Mild"},
    "MODERATE": {"code": "moderate", "display": "Moderate"},
    "SEVERE": {"code": "severe", "display": "Severe"},
}

# AE outcome mapping
OUTCOME_MAP = {
    "RECOVERED": {"code": "resolved", "display": "Resolved"},
    "RECOVERING": {"code": "recovering", "display": "Recovering"},
    "NOT RECOVERED": {"code": "ongoing", "display": "Ongoing"},
    "FATAL": {"code": "fatal", "display": "Fatal"},
}

# AE causality mapping
CAUSALITY_MAP = {
    "RELATED": "causality1",
    "POSSIBLY RELATED": "causality2",
    "NOT RELATED": "causality3",
}

# Max resources per patient bundle
MAX_BUNDLE_RESOURCES = 500
