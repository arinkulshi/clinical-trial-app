"""FHIR transformation and loading service.

Reuses the pipeline/ transform modules to convert validated CSVs
into FHIR Transaction Bundles, then POSTs them to the HAPI FHIR server.
"""

import io
import json
import logging
import sys
from pathlib import Path

import pandas as pd
import requests

log = logging.getLogger(__name__)

# Add project root to path so we can import the pipeline package
_project_root = Path(__file__).resolve().parent.parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))


def transform_and_load(
    domain_dataframes: dict[str, pd.DataFrame],
    fhir_server_url: str,
    study_name: str = "Uploaded Study",
) -> tuple[str | None, int, list[str]]:
    """
    Transform domain DataFrames to FHIR and load into the server.

    Args:
        domain_dataframes: {domain_key: DataFrame} from the validator.
        fhir_server_url: Base URL of the HAPI FHIR server.
        study_name: Name for the ResearchStudy resource.

    Returns:
        (fhir_research_study_id, total_resources_loaded, errors)
    """
    from pipeline.bundle_builder import build_transaction_bundle
    from pipeline.transform_ae import build_ae_entries
    from pipeline.transform_disposition import build_disposition_entries
    from pipeline.transform_meds import build_med_entries
    from pipeline.transform_obs import build_lab_entries, build_vitals_entries
    from pipeline.transform_patient import build_patient_entries
    from pipeline.transform_study import build_study_entries

    errors: list[str] = []
    total_resources = 0
    research_study_id = None

    # Load LOINC map if available
    loinc_map = _load_loinc_map()

    # Build study metadata dict
    metadata = {
        "protocol_id": study_name,
        "title": study_name,
        "phase": "phase-3",
        "status": "active",
        "description": f"Uploaded study: {study_name}",
        "sponsor": "Unknown",
        "sites": [],
    }

    # Extract unique sites from demographics
    demo_df = domain_dataframes.get("demographics")
    if demo_df is not None and "SITEID" in demo_df.columns:
        site_ids = demo_df["SITEID"].dropna().unique()
        metadata["sites"] = [
            {"id": sid, "name": f"Site {sid}", "city": "Unknown", "state": "Unknown"}
            for sid in site_ids
        ]

    session = requests.Session()
    server_url = fhir_server_url.rstrip("/")

    # 1) Study bundle
    try:
        study_entries, study_url = build_study_entries(metadata)
        study_bundle = build_transaction_bundle(study_entries)
        count = _post_bundle(session, server_url, study_bundle)
        total_resources += count

        # Try to extract ResearchStudy ID from response
        research_study_id = _extract_study_id(session, server_url, study_name)
    except Exception as exc:
        errors.append(f"Study bundle failed: {exc}")
        log.error("Study bundle failed: %s", exc)
        return None, 0, errors

    # 2) Patient bundles
    if demo_df is None:
        errors.append("No demographics data found")
        return research_study_id, total_resources, errors

    ae_df = domain_dataframes.get("adverse_events", pd.DataFrame())
    vs_df = domain_dataframes.get("vital_signs", pd.DataFrame())
    lab_df = domain_dataframes.get("lab_results", pd.DataFrame())
    med_df = domain_dataframes.get("medications", pd.DataFrame())
    disp_df = domain_dataframes.get("disposition", pd.DataFrame())

    for _, row in demo_df.iterrows():
        subj_id = row.get("SUBJID", "")
        try:
            patient_entries, patient_url = build_patient_entries(row, study_url)

            subj_ae = ae_df[ae_df["SUBJID"] == subj_id] if "SUBJID" in ae_df.columns else pd.DataFrame()
            ae_entries = build_ae_entries(subj_ae, patient_url, study_url)

            subj_vs = vs_df[vs_df["SUBJID"] == subj_id] if "SUBJID" in vs_df.columns else pd.DataFrame()
            vs_entries = build_vitals_entries(subj_vs, patient_url, loinc_map)

            subj_lab = lab_df[lab_df["SUBJID"] == subj_id] if "SUBJID" in lab_df.columns else pd.DataFrame()
            lab_entries = build_lab_entries(subj_lab, patient_url, loinc_map)

            subj_med = med_df[med_df["SUBJID"] == subj_id] if "SUBJID" in med_df.columns else pd.DataFrame()
            med_entries = build_med_entries(subj_med, patient_url, study_url)

            subj_disp = disp_df[disp_df["SUBJID"] == subj_id] if "SUBJID" in disp_df.columns else pd.DataFrame()
            disp_entries = build_disposition_entries(subj_disp, patient_url)

            all_entries = (
                patient_entries + ae_entries + vs_entries
                + lab_entries + med_entries + disp_entries
            )
            patient_bundle = build_transaction_bundle(all_entries)
            count = _post_bundle(session, server_url, patient_bundle)
            total_resources += count
        except Exception as exc:
            errors.append(f"Patient {subj_id} failed: {exc}")
            log.error("Patient %s bundle failed: %s", subj_id, exc)

    return research_study_id, total_resources, errors


def _post_bundle(session: requests.Session, server_url: str, bundle: dict) -> int:
    """POST a FHIR Transaction Bundle and return resource count."""
    resp = session.post(
        f"{server_url}/",
        json=bundle,
        headers={"Content-Type": "application/fhir+json"},
        timeout=120,
    )
    resp.raise_for_status()
    response_bundle = resp.json()
    return len(response_bundle.get("entry", []))


def _extract_study_id(
    session: requests.Session, server_url: str, study_name: str
) -> str | None:
    """Try to find the ResearchStudy ID we just created."""
    try:
        resp = session.get(
            f"{server_url}/ResearchStudy",
            params={"title": study_name, "_count": "1", "_sort": "-_lastUpdated"},
            timeout=30,
        )
        resp.raise_for_status()
        entries = resp.json().get("entry", [])
        if entries:
            return entries[0]["resource"]["id"]
    except Exception:
        pass
    return None


def _load_loinc_map() -> dict:
    """Load the LOINC mapping file if available."""
    loinc_path = _project_root / "data" / "synthetic" / "LOINC_MAP.json"
    if loinc_path.exists():
        with open(loinc_path, "r") as f:
            return json.load(f)
    return {}


def load_fhir_bundle_json(
    fhir_server_url: str, bundle_json: dict
) -> tuple[int, list[str]]:
    """Load a pre-built FHIR Bundle JSON directly into the server."""
    errors: list[str] = []
    session = requests.Session()
    server_url = fhir_server_url.rstrip("/")
    try:
        count = _post_bundle(session, server_url, bundle_json)
        return count, errors
    except Exception as exc:
        errors.append(str(exc))
        return 0, errors
