"""Transform adverse_events.csv into FHIR AdverseEvent resources."""

import uuid

import pandas as pd

from .config import MEDDRA_SYSTEM, SEVERITY_MAP, OUTCOME_MAP


def transform_adverse_event(
    row: pd.Series, patient_url: str, study_url: str
) -> tuple[str, dict]:
    """Create a FHIR AdverseEvent resource from an AE row."""
    ae_url = f"urn:uuid:{uuid.uuid4()}"

    # Event coding
    event = {
        "coding": [
            {
                "system": MEDDRA_SYSTEM,
                "code": row["AEDECOD"].replace(" ", "_").upper(),
                "display": row["AEDECOD"],
            }
        ],
        "text": row["AETERM"],
    }

    # Seriousness
    seriousness = None
    if row.get("AESER") == "Y":
        seriousness = {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/adverse-event-seriousness",
                    "code": "serious",
                    "display": "Serious",
                }
            ]
        }
    else:
        seriousness = {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/adverse-event-seriousness",
                    "code": "non-serious",
                    "display": "Non-serious",
                }
            ]
        }

    # Severity
    severity = None
    sev_info = SEVERITY_MAP.get(row.get("AESEV"))
    if sev_info:
        severity = {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/adverse-event-severity",
                    "code": sev_info["code"],
                    "display": sev_info["display"],
                }
            ]
        }

    # Outcome
    outcome = None
    out_info = OUTCOME_MAP.get(row.get("AEOUT"))
    if out_info:
        outcome = {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/adverse-event-outcome",
                    "code": out_info["code"],
                    "display": out_info["display"],
                }
            ]
        }

    # Causality / suspect entity
    suspect_entity = []
    if pd.notna(row.get("AEREL")) and row["AEREL"]:
        causality_assessment = "certain"
        if row["AEREL"] == "POSSIBLY RELATED":
            causality_assessment = "possible"
        elif row["AEREL"] == "NOT RELATED":
            causality_assessment = "unlikely"

        suspect_entity.append(
            {
                "instance": {"reference": study_url, "display": "Study Drug"},
                "causality": [
                    {
                        "assessment": {
                            "coding": [
                                {
                                    "system": "http://terminology.hl7.org/CodeSystem/adverse-event-causality-assess",
                                    "code": causality_assessment,
                                    "display": causality_assessment.capitalize(),
                                }
                            ]
                        }
                    }
                ],
            }
        )

    ae = {
        "resourceType": "AdverseEvent",
        "actuality": "actual",
        "subject": {"reference": patient_url},
        "event": event,
        "date": row["AESTDTC"],
        "seriousness": seriousness,
    }

    if severity:
        ae["severity"] = severity
    if outcome:
        ae["outcome"] = outcome
    if suspect_entity:
        ae["suspectEntity"] = suspect_entity

    # CTCAE grade as extension
    if pd.notna(row.get("AETOXGR")):
        ae["extension"] = [
            {
                "url": "http://example.org/fhir/StructureDefinition/ctcae-grade",
                "valueInteger": int(row["AETOXGR"]),
            }
        ]

    return ae_url, ae


def build_ae_entries(
    ae_df: pd.DataFrame, patient_url: str, study_url: str
) -> list[tuple[str, dict]]:
    """Build AdverseEvent entries for one patient."""
    entries = []
    for _, row in ae_df.iterrows():
        entries.append(transform_adverse_event(row, patient_url, study_url))
    return entries
