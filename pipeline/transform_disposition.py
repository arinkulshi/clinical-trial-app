"""Transform disposition.csv into FHIR Encounter resources for milestones."""

import uuid

import pandas as pd

from .config import FHIR_SYSTEM_SUBJECT


# Map disposition terms to Encounter status + class
DISPOSITION_CLASS_MAP = {
    "ENROLLED": {
        "status": "finished",
        "class_code": "AMB",
        "class_display": "ambulatory",
        "type_code": "enrollment",
        "type_display": "Enrollment",
    },
    "RANDOMIZED": {
        "status": "finished",
        "class_code": "AMB",
        "class_display": "ambulatory",
        "type_code": "randomization",
        "type_display": "Randomization",
    },
    "COMPLETED": {
        "status": "finished",
        "class_code": "AMB",
        "class_display": "ambulatory",
        "type_code": "study-completion",
        "type_display": "Study Completion",
    },
    "ADVERSE EVENT": {
        "status": "finished",
        "class_code": "AMB",
        "class_display": "ambulatory",
        "type_code": "discontinuation-ae",
        "type_display": "Discontinuation due to Adverse Event",
    },
    "PROGRESSIVE DISEASE": {
        "status": "finished",
        "class_code": "AMB",
        "class_display": "ambulatory",
        "type_code": "discontinuation-pd",
        "type_display": "Discontinuation due to Progressive Disease",
    },
    "DEATH": {
        "status": "finished",
        "class_code": "AMB",
        "class_display": "ambulatory",
        "type_code": "death",
        "type_display": "Death",
    },
    "WITHDRAWAL BY SUBJECT": {
        "status": "finished",
        "class_code": "AMB",
        "class_display": "ambulatory",
        "type_code": "withdrawal",
        "type_display": "Withdrawal by Subject",
    },
    "PHYSICIAN DECISION": {
        "status": "finished",
        "class_code": "AMB",
        "class_display": "ambulatory",
        "type_code": "discontinuation-pi",
        "type_display": "Discontinuation by Physician Decision",
    },
}


def transform_disposition(
    row: pd.Series, patient_url: str
) -> tuple[str, dict]:
    """Create a FHIR Encounter resource for a disposition milestone."""
    enc_url = f"urn:uuid:{uuid.uuid4()}"

    dsdecod = row["DSDECOD"]
    mapping = DISPOSITION_CLASS_MAP.get(
        dsdecod,
        {
            "status": "finished",
            "class_code": "AMB",
            "class_display": "ambulatory",
            "type_code": dsdecod.lower().replace(" ", "-"),
            "type_display": dsdecod.title(),
        },
    )

    encounter = {
        "resourceType": "Encounter",
        "identifier": [
            {
                "system": FHIR_SYSTEM_SUBJECT,
                "value": f"{row['SUBJID']}-{mapping['type_code']}",
            }
        ],
        "status": mapping["status"],
        "class": {
            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            "code": mapping["class_code"],
            "display": mapping["class_display"],
        },
        "type": [
            {
                "coding": [
                    {
                        "system": "http://example.org/fhir/encounter-type",
                        "code": mapping["type_code"],
                        "display": mapping["type_display"],
                    }
                ],
                "text": mapping["type_display"],
            }
        ],
        "subject": {"reference": patient_url},
        "period": {"start": row["DSSTDTC"]},
    }

    return enc_url, encounter


def build_disposition_entries(
    disp_df: pd.DataFrame, patient_url: str
) -> list[tuple[str, dict]]:
    """Build Encounter entries for one patient's disposition events."""
    entries = []
    for _, row in disp_df.iterrows():
        entries.append(transform_disposition(row, patient_url))
    return entries
