"""Transform demographics.csv into FHIR Patient + ResearchSubject resources."""

import uuid
from datetime import date

import pandas as pd

from .config import (
    FHIR_SYSTEM_SUBJECT,
    GENDER_MAP,
    RACE_CODE_MAP,
    ETHNICITY_CODE_MAP,
    US_CORE_RACE_URL,
    US_CORE_ETHNICITY_URL,
)


def _estimate_birth_date(age: int, ref_date_str: str) -> str:
    """Estimate birth year from age and enrollment date."""
    ref = date.fromisoformat(ref_date_str)
    birth_year = ref.year - age
    return f"{birth_year}-01-01"


def transform_patient(row: pd.Series) -> tuple[str, dict]:
    """Create a FHIR Patient resource from a demographics row."""
    patient_url = f"urn:uuid:{uuid.uuid4()}"

    extensions = []

    # US Core Race extension
    race_info = RACE_CODE_MAP.get(row["RACE"])
    if race_info:
        extensions.append(
            {
                "url": US_CORE_RACE_URL,
                "extension": [
                    {
                        "url": "ombCategory",
                        "valueCoding": {
                            "system": "urn:oid:2.16.840.1.113883.6.238",
                            "code": race_info["code"],
                            "display": race_info["display"],
                        },
                    },
                    {"url": "text", "valueString": race_info["display"]},
                ],
            }
        )

    # US Core Ethnicity extension
    eth_info = ETHNICITY_CODE_MAP.get(row["ETHNIC"])
    if eth_info:
        extensions.append(
            {
                "url": US_CORE_ETHNICITY_URL,
                "extension": [
                    {
                        "url": "ombCategory",
                        "valueCoding": {
                            "system": "urn:oid:2.16.840.1.113883.6.238",
                            "code": eth_info["code"],
                            "display": eth_info["display"],
                        },
                    },
                    {"url": "text", "valueString": eth_info["display"]},
                ],
            }
        )

    patient = {
        "resourceType": "Patient",
        "identifier": [
            {"system": FHIR_SYSTEM_SUBJECT, "value": row["SUBJID"]}
        ],
        "gender": GENDER_MAP.get(row["SEX"], "unknown"),
        "birthDate": _estimate_birth_date(int(row["AGE"]), row["RFSTDTC"]),
    }
    if extensions:
        patient["extension"] = extensions

    # Add deceased flag if applicable
    if row.get("DTHFL") == "Y":
        patient["deceasedBoolean"] = True

    return patient_url, patient


def transform_research_subject(
    row: pd.Series,
    patient_url: str,
    study_url: str,
) -> tuple[str, dict]:
    """Create a FHIR ResearchSubject linking Patient to ResearchStudy."""
    rs_url = f"urn:uuid:{uuid.uuid4()}"

    period = {"start": row["RFSTDTC"]}
    if pd.notna(row.get("RFENDTC")) and row["RFENDTC"]:
        period["end"] = row["RFENDTC"]

    research_subject = {
        "resourceType": "ResearchSubject",
        "identifier": [
            {"system": FHIR_SYSTEM_SUBJECT, "value": f"RS-{row['SUBJID']}"}
        ],
        "status": "on-study",
        "study": {"reference": study_url},
        "individual": {"reference": patient_url},
        "period": period,
        "assignedArm": row["ARM"],
    }

    return rs_url, research_subject


def build_patient_entries(
    row: pd.Series, study_url: str
) -> tuple[list[tuple[str, dict]], str]:
    """
    Build Patient + ResearchSubject entries for one subject.

    Returns:
        (entries, patient_url)
    """
    patient_url, patient = transform_patient(row)
    rs_url, research_subject = transform_research_subject(
        row, patient_url, study_url
    )
    return [(patient_url, patient), (rs_url, research_subject)], patient_url
