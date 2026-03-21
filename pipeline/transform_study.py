"""Transform study metadata into FHIR ResearchStudy + Organization resources."""

import json
import uuid
from typing import Any

from .config import STUDY_METADATA, FHIR_SYSTEM_SITE, FHIR_SYSTEM_PROTOCOL


def _make_entry(resource_dict: dict) -> tuple[str, dict]:
    """Return (fullUrl, resource_dict) tuple."""
    full_url = f"urn:uuid:{uuid.uuid4()}"
    return full_url, resource_dict


def transform_organizations(metadata: dict) -> list[tuple[str, dict]]:
    """Create an Organization resource per site."""
    entries = []
    for site in metadata["sites"]:
        org = {
            "resourceType": "Organization",
            "identifier": [
                {
                    "system": FHIR_SYSTEM_SITE,
                    "value": site["site_id"],
                }
            ],
            "name": site["name"],
            "address": [
                {
                    "city": site["city"],
                    "state": site["state"],
                    "country": site["country"],
                }
            ],
        }
        entries.append(_make_entry(org))
    return entries


def transform_research_study(
    metadata: dict, org_entries: list[tuple[str, dict]]
) -> tuple[str, dict]:
    """Create a single ResearchStudy resource referencing the organizations."""
    site_refs = [
        {"reference": full_url, "display": org["name"]}
        for full_url, org in org_entries
    ]

    arms = []
    for arm in metadata["arms"]:
        arms.append(
            {
                "name": arm["code"],
                "type": {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/research-study-arm-type",
                            "code": "experimental" if arm["type"] == "Experimental" else "active-comparator",
                            "display": arm["type"],
                        }
                    ]
                },
                "description": arm["name"],
            }
        )

    study = {
        "resourceType": "ResearchStudy",
        "identifier": [
            {
                "system": FHIR_SYSTEM_PROTOCOL,
                "value": metadata["protocol_id"],
            }
        ],
        "title": metadata["title"],
        "status": "completed",
        "phase": {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/research-study-phase",
                    "code": "phase-3",
                    "display": "Phase 3",
                }
            ]
        },
        "category": [
            {
                "coding": [
                    {
                        "system": FHIR_SYSTEM_PROTOCOL,
                        "code": "interventional",
                        "display": "Interventional",
                    }
                ]
            }
        ],
        "condition": [
            {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": "254637007",
                        "display": "Non-small cell lung cancer",
                    }
                ],
                "text": metadata["indication"],
            }
        ],
        "description": metadata["title"],
        "enrollment": [
            {
                "reference": "#enrollment-group",
                "display": f"Target enrollment: {metadata['enrollment']['target']}",
            }
        ],
        "sponsor": {
            "display": metadata.get("sponsor", "Oncology Research Corp")
        },
        "arm": arms,
        "site": site_refs,
    }

    return _make_entry(study)


def build_study_entries(metadata: dict) -> tuple[list[tuple[str, dict]], str]:
    """
    Build all study-level FHIR entries.

    Returns:
        (entries, research_study_url) where entries is a list of (fullUrl, resource)
        and research_study_url is the fullUrl of the ResearchStudy.
    """
    org_entries = transform_organizations(metadata)
    study_url, study_resource = transform_research_study(metadata, org_entries)
    entries = org_entries + [(study_url, study_resource)]
    return entries, study_url
