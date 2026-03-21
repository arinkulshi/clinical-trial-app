"""Main entry point: read CSVs, transform to FHIR, write Transaction Bundles."""

import json
import sys

import pandas as pd

from .config import (
    STUDY_METADATA,
    LOINC_MAP_FILE,
    DEMOGRAPHICS_CSV,
    ADVERSE_EVENTS_CSV,
    VITAL_SIGNS_CSV,
    LAB_RESULTS_CSV,
    MEDICATIONS_CSV,
    DISPOSITION_CSV,
    BUNDLE_DIR,
)
from .transform_study import build_study_entries
from .transform_patient import build_patient_entries
from .transform_ae import build_ae_entries
from .transform_obs import build_vitals_entries, build_lab_entries
from .transform_meds import build_med_entries
from .transform_disposition import build_disposition_entries
from .bundle_builder import build_transaction_bundle, save_bundle


def run():
    """Execute the full FHIR transformation pipeline."""
    print("=== FHIR R4 Transformation Pipeline ===\n")

    # ── Load source data ──────────────────────────────────────────────
    print("Loading source data...")
    with open(STUDY_METADATA, "r") as f:
        metadata = json.load(f)
    with open(LOINC_MAP_FILE, "r") as f:
        loinc_map = json.load(f)

    demo_df = pd.read_csv(DEMOGRAPHICS_CSV, dtype=str)
    ae_df = pd.read_csv(ADVERSE_EVENTS_CSV, dtype=str)
    vs_df = pd.read_csv(VITAL_SIGNS_CSV, dtype=str)
    lab_df = pd.read_csv(LAB_RESULTS_CSV, dtype=str)
    med_df = pd.read_csv(MEDICATIONS_CSV, dtype=str)
    disp_df = pd.read_csv(DISPOSITION_CSV, dtype=str)

    print(
        f"  Demographics: {len(demo_df)} subjects\n"
        f"  Adverse Events: {len(ae_df)} rows\n"
        f"  Vital Signs: {len(vs_df)} rows\n"
        f"  Lab Results: {len(lab_df)} rows\n"
        f"  Medications: {len(med_df)} rows\n"
        f"  Disposition: {len(disp_df)} rows\n"
    )

    # ── Study-level bundle ────────────────────────────────────────────
    print("Building study-level bundle...")
    study_entries, study_url = build_study_entries(metadata)
    study_bundle = build_transaction_bundle(study_entries)
    study_bundle_path = BUNDLE_DIR / "study_bundle.json"
    save_bundle(study_bundle, study_bundle_path)
    print(f"  Saved {len(study_entries)} resources -> {study_bundle_path.name}")

    # ── Patient bundles ───────────────────────────────────────────────
    print("\nBuilding patient bundles...")
    total_resources = len(study_entries)

    for _, row in demo_df.iterrows():
        subj_id = row["SUBJID"]
        subj_num = subj_id.replace("SUBJ-", "")

        # Patient + ResearchSubject
        patient_entries, patient_url = build_patient_entries(row, study_url)

        # Adverse events for this patient
        subj_ae = ae_df[ae_df["SUBJID"] == subj_id]
        ae_entries = build_ae_entries(subj_ae, patient_url, study_url)

        # Vital signs for this patient
        subj_vs = vs_df[vs_df["SUBJID"] == subj_id]
        vs_entries = build_vitals_entries(subj_vs, patient_url, loinc_map)

        # Lab results for this patient
        subj_lab = lab_df[lab_df["SUBJID"] == subj_id]
        lab_entries = build_lab_entries(subj_lab, patient_url, loinc_map)

        # Medications for this patient
        subj_med = med_df[med_df["SUBJID"] == subj_id]
        med_entries = build_med_entries(subj_med, patient_url, study_url)

        # Disposition for this patient
        subj_disp = disp_df[disp_df["SUBJID"] == subj_id]
        disp_entries = build_disposition_entries(subj_disp, patient_url)

        # Combine all entries for this patient
        all_entries = (
            patient_entries + ae_entries + vs_entries
            + lab_entries + med_entries + disp_entries
        )

        resource_count = len(all_entries)
        total_resources += resource_count

        # Build and save the patient bundle
        patient_bundle = build_transaction_bundle(all_entries)
        bundle_path = BUNDLE_DIR / f"patient_bundle_{subj_num}.json"
        save_bundle(patient_bundle, bundle_path)

        print(f"  {subj_id}: {resource_count} resources -> {bundle_path.name}")

    print(f"\n=== Done! Total resources: {total_resources} ===")
    print(f"Bundles written to: {BUNDLE_DIR}")


if __name__ == "__main__":
    run()
