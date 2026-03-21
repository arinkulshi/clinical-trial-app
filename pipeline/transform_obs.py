"""Transform vital_signs.csv and lab_results.csv into FHIR Observation resources."""

import uuid

import pandas as pd

from .config import LOINC_SYSTEM


def transform_vital_sign(
    row: pd.Series, patient_url: str, loinc_map: dict
) -> tuple[str, dict]:
    """Create a FHIR Observation (vital-signs) from a vitals row."""
    obs_url = f"urn:uuid:{uuid.uuid4()}"

    loinc_info = loinc_map.get(row["VSTESTCD"], {})
    code_value = loinc_info.get("code", row["VSTESTCD"])
    display = loinc_info.get("display", row["VSTEST"])

    obs = {
        "resourceType": "Observation",
        "status": "final",
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "vital-signs",
                        "display": "Vital Signs",
                    }
                ]
            }
        ],
        "code": {
            "coding": [
                {
                    "system": LOINC_SYSTEM,
                    "code": code_value,
                    "display": display,
                }
            ],
            "text": row["VSTEST"],
        },
        "subject": {"reference": patient_url},
        "effectiveDateTime": row["VSDTC"],
        "valueQuantity": {
            "value": float(row["VSORRES"]),
            "unit": row["VSORRESU"],
            "system": "http://unitsofmeasure.org",
            "code": _ucum_code(row["VSORRESU"]),
        },
    }

    return obs_url, obs


def transform_lab_result(
    row: pd.Series, patient_url: str, loinc_map: dict
) -> tuple[str, dict]:
    """Create a FHIR Observation (laboratory) from a lab row."""
    obs_url = f"urn:uuid:{uuid.uuid4()}"

    loinc_info = loinc_map.get(row["LBTESTCD"], {})
    code_value = loinc_info.get("code", str(row.get("LBLOINC", row["LBTESTCD"])))
    display = loinc_info.get("display", row["LBTEST"])

    value = float(row["LBORRES"])

    obs = {
        "resourceType": "Observation",
        "status": "final",
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "laboratory",
                        "display": "Laboratory",
                    }
                ]
            }
        ],
        "code": {
            "coding": [
                {
                    "system": LOINC_SYSTEM,
                    "code": code_value,
                    "display": display,
                }
            ],
            "text": row["LBTEST"],
        },
        "subject": {"reference": patient_url},
        "effectiveDateTime": row["LBDTC"],
        "valueQuantity": {
            "value": value,
            "unit": row["LBORRESU"],
            "system": "http://unitsofmeasure.org",
            "code": _ucum_code(row["LBORRESU"]),
        },
    }

    # Reference range
    if pd.notna(row.get("LBSTNRLO")) and pd.notna(row.get("LBSTNRHI")):
        obs["referenceRange"] = [
            {
                "low": {
                    "value": float(row["LBSTNRLO"]),
                    "unit": row["LBORRESU"],
                    "system": "http://unitsofmeasure.org",
                },
                "high": {
                    "value": float(row["LBSTNRHI"]),
                    "unit": row["LBORRESU"],
                    "system": "http://unitsofmeasure.org",
                },
            }
        ]

        # Interpretation (high / low / normal)
        lo = float(row["LBSTNRLO"])
        hi = float(row["LBSTNRHI"])
        if value < lo:
            interp_code, interp_display = "L", "Low"
        elif value > hi:
            interp_code, interp_display = "H", "High"
        else:
            interp_code, interp_display = "N", "Normal"

        obs["interpretation"] = [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                        "code": interp_code,
                        "display": interp_display,
                    }
                ]
            }
        ]

    return obs_url, obs


def _ucum_code(unit: str) -> str:
    """Map common unit strings to UCUM codes."""
    mapping = {
        "mmHg": "mm[Hg]",
        "beats/min": "/min",
        "C": "Cel",
        "kg": "kg",
        "cm": "cm",
        "U/L": "U/L",
        "mg/dL": "mg/dL",
        "x10^9/L": "10*9/L",
        "g/dL": "g/dL",
        "mIU/L": "m[IU]/L",
    }
    return mapping.get(unit, unit)


def build_vitals_entries(
    vitals_df: pd.DataFrame, patient_url: str, loinc_map: dict
) -> list[tuple[str, dict]]:
    """Build Observation entries for one patient's vital signs."""
    entries = []
    for _, row in vitals_df.iterrows():
        entries.append(transform_vital_sign(row, patient_url, loinc_map))
    return entries


def build_lab_entries(
    labs_df: pd.DataFrame, patient_url: str, loinc_map: dict
) -> list[tuple[str, dict]]:
    """Build Observation entries for one patient's lab results."""
    entries = []
    for _, row in labs_df.iterrows():
        entries.append(transform_lab_result(row, patient_url, loinc_map))
    return entries
