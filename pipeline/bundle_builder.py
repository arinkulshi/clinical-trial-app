"""Assemble FHIR Transaction Bundles from resource entries."""

import json
from pathlib import Path


def build_transaction_bundle(
    entries: list[tuple[str, dict]],
) -> dict:
    """
    Build a FHIR Transaction Bundle from a list of (fullUrl, resource) tuples.

    Each entry becomes a Bundle.entry with request method POST.
    """
    bundle_entries = []
    for full_url, resource in entries:
        resource_type = resource["resourceType"]
        bundle_entries.append(
            {
                "fullUrl": full_url,
                "resource": resource,
                "request": {
                    "method": "POST",
                    "url": resource_type,
                },
            }
        )

    return {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": bundle_entries,
    }


def save_bundle(bundle: dict, output_path: Path) -> None:
    """Write a bundle to a JSON file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(bundle, f, indent=2, ensure_ascii=False)
