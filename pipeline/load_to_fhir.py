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


def post_bundle(session: requests.Session, server_url: str, bundle_path: Path) -> int:
    """POST a FHIR Transaction Bundle and return the number of resources created."""
    with open(bundle_path, "r", encoding="utf-8") as f:
        bundle = json.load(f)

    resp = session.post(
        f"{server_url}/",
        json=bundle,
        headers={"Content-Type": "application/fhir+json"},
        timeout=120,
    )
    resp.raise_for_status()

    response_bundle = resp.json()
    return len(response_bundle.get("entry", []))


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
        count = post_bundle(session, server_url, study_bundle)
        total_resources += count
        log.info("Study bundle loaded (%d resources)", count)
    except requests.RequestException as exc:
        log.error("Failed to load study bundle: %s", exc)
        sys.exit(1)

    # 2) Load patient bundles
    for path in tqdm(patient_bundles, desc="Loading patient bundles", unit="bundle"):
        try:
            count = post_bundle(session, server_url, path)
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
