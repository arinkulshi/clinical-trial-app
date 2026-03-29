"""Load FHIR Transaction Bundles into a HAPI FHIR server."""

import argparse
import json
import logging
import sys
from pathlib import Path

import requests
from tqdm import tqdm

from pipeline.config import BUNDLE_DIR

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


def post_bundle(session: requests.Session, server_url: str, bundle_path: Path,
                 ref_map: dict | None = None) -> tuple[int, dict]:
    """POST a FHIR Transaction Bundle and return (resource_count, id_map).

    If ref_map is provided, rewrite any matching references in the bundle
    before posting. The returned id_map maps old fullUrl -> new server ID
    for ResearchStudy and Organization resources.
    """
    with open(bundle_path, "r", encoding="utf-8") as f:
        bundle = json.load(f)

    # Rewrite stale references (e.g. ResearchStudy/27 -> ResearchStudy/9)
    if ref_map:
        raw = json.dumps(bundle)
        for old_ref, new_ref in ref_map.items():
            raw = raw.replace(old_ref, new_ref)
        bundle = json.loads(raw)

    resp = session.post(
        f"{server_url}/",
        json=bundle,
        headers={"Content-Type": "application/fhir+json"},
        timeout=120,
    )
    resp.raise_for_status()

    response_bundle = resp.json()

    # Check individual entry statuses for silent failures
    entry_errors = 0
    for i, resp_entry in enumerate(response_bundle.get("entry", [])):
        status = resp_entry.get("response", {}).get("status", "")
        if status and not status.startswith(("200", "201")):
            entry_errors += 1
            resource_type = bundle.get("entry", [{}])[i].get("resource", {}).get("resourceType", "unknown")
            outcome = resp_entry.get("response", {}).get("outcome", {})
            diag = ""
            for issue in outcome.get("issue", []):
                diag = issue.get("diagnostics", "")
                break
            log.warning("Entry %d (%s) failed with status %s: %s", i, resource_type, status, diag)
    if entry_errors:
        log.warning("%d/%d entries failed in %s", entry_errors, len(response_bundle.get("entry", [])), bundle_path.name if hasattr(bundle_path, 'name') else bundle_path)

    # Build map of created resource references (for study bundle)
    id_map = {}
    for req_entry, resp_entry in zip(bundle.get("entry", []),
                                      response_bundle.get("entry", [])):
        resource_type = req_entry.get("resource", {}).get("resourceType", "")
        old_url = req_entry.get("fullUrl", "")
        new_id = resp_entry.get("response", {}).get("location", "")
        if new_id and resource_type in ("ResearchStudy", "Organization"):
            # location is like "ResearchStudy/9/_history/1"
            parts = new_id.split("/")
            if len(parts) >= 2:
                id_map[old_url] = f"{parts[0]}/{parts[1]}"

    return len(response_bundle.get("entry", [])) - entry_errors, id_map


def verify(session: requests.Session, server_url: str) -> None:
    """Run verification queries and print results."""
    log.info("── Verification ──")

    # Patient count
    resp = session.get(f"{server_url}/Patient", params={"_summary": "count"}, timeout=30)
    resp.raise_for_status()
    patient_count = resp.json().get("total", "?")
    log.info("Patients:        %s", patient_count)

    # ResearchStudy
    resp = session.get(f"{server_url}/ResearchStudy", timeout=30)
    resp.raise_for_status()
    studies = resp.json().get("entry", [])
    log.info("ResearchStudies: %s", len(studies))

    # Organization count
    resp = session.get(f"{server_url}/Organization", params={"_summary": "count"}, timeout=30)
    resp.raise_for_status()
    org_count = resp.json().get("total", "?")
    log.info("Organizations:   %s", org_count)

    # Observation count
    resp = session.get(f"{server_url}/Observation", params={"_summary": "count"}, timeout=30)
    resp.raise_for_status()
    obs_count = resp.json().get("total", "?")
    log.info("Observations:    %s", obs_count)

    # MedicationAdministration count
    resp = session.get(f"{server_url}/MedicationAdministration", params={"_summary": "count"}, timeout=30)
    resp.raise_for_status()
    med_count = resp.json().get("total", "?")
    log.info("MedAdmins:       %s", med_count)

    # AdverseEvent count
    resp = session.get(f"{server_url}/AdverseEvent", params={"_summary": "count"}, timeout=30)
    resp.raise_for_status()
    ae_count = resp.json().get("total", "?")
    log.info("AdverseEvents:   %s", ae_count)


def main() -> None:
    parser = argparse.ArgumentParser(description="Load FHIR bundles into HAPI FHIR server")
    parser.add_argument(
        "--server-url",
        default="http://localhost:8080/fhir",
        help="FHIR server base URL (default: http://localhost:8080/fhir)",
    )
    parser.add_argument(
        "--bundle-dir",
        type=Path,
        default=BUNDLE_DIR,
        help=f"Directory containing bundle JSON files (default: {BUNDLE_DIR})",
    )
    args = parser.parse_args()

    server_url = args.server_url.rstrip("/")
    bundle_dir = args.bundle_dir

    if not bundle_dir.is_dir():
        log.error("Bundle directory not found: %s", bundle_dir)
        sys.exit(1)

    study_bundle = bundle_dir / "study_bundle.json"
    patient_bundles = sorted(bundle_dir.glob("patient_bundle_*.json"))

    if not study_bundle.exists():
        log.error("study_bundle.json not found in %s", bundle_dir)
        sys.exit(1)

    log.info("FHIR server:  %s", server_url)
    log.info("Bundle dir:   %s", bundle_dir)
    log.info("Bundles found: 1 study + %d patient", len(patient_bundles))

    session = requests.Session()
    total_resources = 0
    errors = 0

    # 1) Load study bundle first
    log.info("Loading study bundle...")
    try:
        count, id_map = post_bundle(session, server_url, study_bundle)
        total_resources += count
        log.info("Study bundle loaded (%d resources)", count)
    except requests.RequestException as exc:
        log.error("Failed to load study bundle: %s", exc)
        sys.exit(1)

    # Build reference map: detect old hardcoded IDs in patient bundles
    # and map them to the freshly-created server IDs
    ref_map = {}
    if patient_bundles:
        import re
        with open(patient_bundles[0], "r", encoding="utf-8") as f:
            sample = f.read()
        old_study_refs = set(re.findall(r"ResearchStudy/\d+", sample))
        old_org_refs = set(re.findall(r"Organization/\d+", sample))

        # Get new server IDs
        resp = session.get(f"{server_url}/ResearchStudy?_count=10", timeout=30)
        if resp.ok:
            for entry in resp.json().get("entry", []):
                new_ref = f"ResearchStudy/{entry['resource']['id']}"
                for old_ref in old_study_refs:
                    if old_ref != new_ref:
                        ref_map[old_ref] = new_ref
                        log.info("Reference remap: %s -> %s", old_ref, new_ref)

        resp = session.get(f"{server_url}/Organization?_count=50", timeout=30)
        if resp.ok:
            for entry in resp.json().get("entry", []):
                new_ref = f"Organization/{entry['resource']['id']}"
                for old_ref in old_org_refs:
                    if old_ref != new_ref:
                        ref_map[old_ref] = new_ref

    if ref_map:
        log.info("Will remap %d stale references in patient bundles", len(ref_map))

    # 2) Load patient bundles
    for path in tqdm(patient_bundles, desc="Loading patient bundles", unit="bundle"):
        try:
            count, _ = post_bundle(session, server_url, path, ref_map=ref_map)
            total_resources += count
        except requests.RequestException as exc:
            errors += 1
            log.error("Failed %s: %s", path.name, exc)

    # Summary
    loaded = len(patient_bundles) - errors
    log.info("── Summary ──")
    log.info("Patients loaded: %d / %d", loaded, len(patient_bundles))
    log.info("Total resources:  %d", total_resources)
    log.info("Errors:           %d", errors)

    # 3) Verify
    try:
        verify(session, server_url)
    except requests.RequestException as exc:
        log.warning("Verification failed: %s", exc)

    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
