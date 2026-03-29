"""FHIR proxy routes — simplify FHIR queries for the dashboard."""

import logging

import httpx
from fastapi import APIRouter, HTTPException, Query

from ..config import get_settings

router = APIRouter(prefix="/api/fhir", tags=["fhir"])
log = logging.getLogger(__name__)


def _fhir_url() -> str:
    return get_settings().fhir_server_url.rstrip("/")


async def _fhir_get(path: str, params: dict | None = None) -> dict:
    """Forward a GET request to the FHIR server."""
    url = f"{_fhir_url()}/{path.lstrip('/')}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, params=params)
        if resp.status_code >= 400:
            log.error("FHIR %s returned %s: %s", url, resp.status_code, resp.text[:500])
            raise HTTPException(status_code=resp.status_code, detail=resp.text[:500])
        return resp.json()


async def _get_study_patient_ids(study_id: str) -> list[str]:
    """Get all Patient IDs enrolled in a study via ResearchSubject."""
    bundle = await _fhir_get(
        "ResearchSubject",
        {"study": f"ResearchStudy/{study_id}", "_count": "500"},
    )
    patient_ids = []
    for entry in bundle.get("entry", []):
        ref = entry.get("resource", {}).get("individual", {}).get("reference", "")
        if ref:
            patient_ids.append(ref)
    return patient_ids



# ── Studies ─────────────────────────────────────────────────────────────


@router.get("/studies")
async def list_studies():
    """List all ResearchStudy resources."""
    return await _fhir_get("ResearchStudy", {"_count": "100", "_sort": "-_lastUpdated"})


@router.get("/studies/{study_id}")
async def get_study(study_id: str):
    """Get a single ResearchStudy with included references."""
    return await _fhir_get(f"ResearchStudy/{study_id}", {"_include": "*"})


@router.get("/studies/{study_id}/patients")
async def get_study_patients(
    study_id: str,
    _count: int = Query(200, alias="count"),
):
    """Get patients enrolled in a study via ResearchSubject."""
    return await _fhir_get(
        "ResearchSubject",
        {
            "study": f"ResearchStudy/{study_id}",
            "_include": "ResearchSubject:individual",
            "_count": str(_count),
        },
    )


@router.get("/studies/{study_id}/adverse-events")
async def get_study_adverse_events(
    study_id: str,
    _count: int = Query(1000, alias="count"),
):
    """Get all adverse events for patients in a study."""
    patient_ids = await _get_study_patient_ids(study_id)
    if not patient_ids:
        return {"resourceType": "Bundle", "type": "searchset", "total": 0, "entry": []}
    # HAPI FHIR supports comma-separated subject references
    subject_param = ",".join(patient_ids)
    return await _fhir_get(
        "AdverseEvent",
        {"subject": subject_param, "_count": str(_count)},
    )


@router.get("/studies/{study_id}/observations")
async def get_study_observations(
    study_id: str,
    category: str | None = Query(None),
    _count: int = Query(1000, alias="count"),
):
    """Get observations (vitals/labs) for patients in a study."""
    patient_ids = await _get_study_patient_ids(study_id)
    if not patient_ids:
        return {"resourceType": "Bundle", "type": "searchset", "total": 0, "entry": []}
    params: dict[str, str] = {"_count": str(_count)}
    if category:
        params["category"] = category
    # Query by patient references from the study
    params["subject"] = ",".join(patient_ids)
    return await _fhir_get("Observation", params)


# ── Patient Timeline ───────────────────────────────────────────────────


@router.get("/patients/{patient_id}/timeline")
async def get_patient_timeline(patient_id: str):
    """
    Aggregate timeline for a single patient:
    AEs, Observations, and MedicationAdministrations.
    """
    patient_ref = f"Patient/{patient_id}"

    async with httpx.AsyncClient(timeout=30) as client:
        base = _fhir_url()

        ae_resp, obs_resp, med_resp = await _parallel_gets(
            client,
            [
                (f"{base}/AdverseEvent", {"subject": patient_ref, "_count": "200"}),
                (f"{base}/Observation", {"subject": patient_ref, "_count": "500", "_sort": "date"}),
                (
                    f"{base}/MedicationAdministration",
                    {"subject": patient_ref, "_count": "200", "_sort": "effective"},
                ),
            ],
        )

    return {
        "patient_id": patient_id,
        "adverse_events": ae_resp.get("entry", []),
        "observations": obs_resp.get("entry", []),
        "medications": med_resp.get("entry", []),
    }


async def _parallel_gets(
    client: httpx.AsyncClient,
    requests_list: list[tuple[str, dict]],
) -> list[dict]:
    """Execute multiple FHIR GET requests concurrently."""
    import asyncio

    async def _get(url: str, params: dict) -> dict:
        resp = await client.get(url, params=params)
        if resp.status_code >= 400:
            return {"entry": []}
        return resp.json()

    results = await asyncio.gather(
        *[_get(url, params) for url, params in requests_list]
    )
    return list(results)
