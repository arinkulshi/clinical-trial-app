"""Transform medications.csv into FHIR MedicationAdministration / MedicationStatement."""

import uuid

import pandas as pd


def transform_medication(
    row: pd.Series, patient_url: str, study_url: str
) -> tuple[str, dict]:
    """
    Create a MedicationAdministration (STUDY DRUG) or MedicationStatement (CONCOMITANT).
    """
    med_url = f"urn:uuid:{uuid.uuid4()}"
    is_study_drug = row.get("CMCAT") == "STUDY DRUG"

    medication_concept = {
        "coding": [
            {
                "system": "http://example.org/fhir/medication",
                "code": row["CMTRT"].replace(" ", "_").upper(),
                "display": row["CMTRT"],
            }
        ],
        "text": row["CMTRT"],
    }

    dosage_dose = {
        "value": float(row["CMDOSE"]),
        "unit": row["CMDOSU"],
        "system": "http://unitsofmeasure.org",
        "code": row["CMDOSU"],
    }

    effective_period = {"start": row["CMSTDTC"]}
    if pd.notna(row.get("CMENDTC")) and row["CMENDTC"]:
        effective_period["end"] = row["CMENDTC"]

    route = {
        "coding": [
            {
                "system": "http://snomed.info/sct",
                "code": "47625008",
                "display": "Intravenous route",
            }
        ],
        "text": row["CMROUTE"],
    }

    if is_study_drug:
        resource = {
            "resourceType": "MedicationAdministration",
            "status": "completed",
            "medicationCodeableConcept": medication_concept,
            "subject": {"reference": patient_url},
            "context": {"reference": study_url, "display": "Study Drug Administration"},
            "effectivePeriod": effective_period,
            "dosage": {
                "dose": dosage_dose,
                "route": route,
            },
        }
    else:
        resource = {
            "resourceType": "MedicationStatement",
            "status": "completed",
            "medicationCodeableConcept": medication_concept,
            "subject": {"reference": patient_url},
            "effectivePeriod": effective_period,
            "dosage": [
                {
                    "route": route,
                    "doseAndRate": [
                        {"doseQuantity": dosage_dose}
                    ],
                }
            ],
        }

    return med_url, resource


def build_med_entries(
    meds_df: pd.DataFrame, patient_url: str, study_url: str
) -> list[tuple[str, dict]]:
    """Build medication entries for one patient."""
    entries = []
    for _, row in meds_df.iterrows():
        entries.append(transform_medication(row, patient_url, study_url))
    return entries
