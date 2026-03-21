"""
Chunk 1: Synthetic Clinical Trial Data Generation

Generates synthetic SDTM-like CSV data for a Phase III oncology trial:
PEMBRO (immunotherapy) vs CHEMO (chemotherapy) for advanced NSCLC.

Protocol: ONCO-2024-PD1-301
Patients: 200 (100 per arm), 8 US sites, 26-week duration

Usage: python generate_data.py
"""

import json
import random
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from faker import Faker

# ── Reproducibility ──────────────────────────────────────────────────────────
SEED = 42
np.random.seed(SEED)
random.seed(SEED)
fake = Faker("en_US")
Faker.seed(SEED)

OUTPUT_DIR = Path(__file__).parent

# ── Study-Level Constants ────────────────────────────────────────────────────
PROTOCOL_ID = "ONCO-2024-PD1-301"
ENROLLMENT_START = date(2024, 1, 15)
ENROLLMENT_WINDOW_DAYS = 84  # 12 weeks
N_PATIENTS = 200
N_PER_ARM = 100
ARMS = ["PEMBRO", "CHEMO"]

SITES = [
    {"SITEID": "SITE-01", "name": "Memorial Cancer Center", "city": "Houston", "state": "TX"},
    {"SITEID": "SITE-02", "name": "Pacific Oncology Institute", "city": "Los Angeles", "state": "CA"},
    {"SITEID": "SITE-03", "name": "Northeast Cancer Research", "city": "Boston", "state": "MA"},
    {"SITEID": "SITE-04", "name": "Midwest Clinical Trials", "city": "Chicago", "state": "IL"},
    {"SITEID": "SITE-05", "name": "Southeast Oncology Group", "city": "Atlanta", "state": "GA"},
    {"SITEID": "SITE-06", "name": "Rocky Mountain Cancer Center", "city": "Denver", "state": "CO"},
    {"SITEID": "SITE-07", "name": "Bay Area Oncology Research", "city": "San Francisco", "state": "CA"},
    {"SITEID": "SITE-08", "name": "Atlantic Cancer Institute", "city": "Philadelphia", "state": "PA"},
]

# Visit schedule: (visit_num, week_offset_from_baseline)
# Visit 1 = screening (week -1), Visit 2 = baseline (week 0), Visits 3-10 = treatment
VISIT_SCHEDULE = [
    (1, -1),  # Screening
    (2, 0),   # Baseline
    (3, 3),
    (4, 6),
    (5, 9),
    (6, 12),
    (7, 15),
    (8, 18),
    (9, 21),
    (10, 24),
]

# ── LOINC Map ────────────────────────────────────────────────────────────────
LOINC_MAP = {
    "SYSBP":  {"code": "8480-6",  "display": "Systolic blood pressure"},
    "DIABP":  {"code": "8462-4",  "display": "Diastolic blood pressure"},
    "HR":     {"code": "8867-4",  "display": "Heart rate"},
    "TEMP":   {"code": "8310-5",  "display": "Body temperature"},
    "WEIGHT": {"code": "29463-7", "display": "Body weight"},
    "HEIGHT": {"code": "8302-2",  "display": "Body height"},
    "ALT":    {"code": "1742-6",  "display": "ALT [U/L]"},
    "AST":    {"code": "1920-8",  "display": "AST [U/L]"},
    "BILI":   {"code": "1975-2",  "display": "Bilirubin total [mg/dL]"},
    "CREAT":  {"code": "2160-0",  "display": "Creatinine [mg/dL]"},
    "WBC":    {"code": "6690-2",  "display": "WBC [#/volume]"},
    "ANC":    {"code": "751-8",   "display": "Neutrophils [#/volume]"},
    "HGB":    {"code": "718-7",   "display": "Hemoglobin [g/dL]"},
    "PLT":    {"code": "777-3",   "display": "Platelets [#/volume]"},
    "ALB":    {"code": "1751-7",  "display": "Albumin [g/dL]"},
    "LDH":    {"code": "2532-0",  "display": "LDH [U/L]"},
    "TSH":    {"code": "3016-3",  "display": "TSH [mIU/L]"},
}

# ── AE Profiles ──────────────────────────────────────────────────────────────
# (AETERM, AEDECOD, AEBODSYS): weight
PEMBRO_AE_PROFILE = [
    ("Fatigue", "Fatigue", "General disorders and administration site conditions", 0.20),
    ("Rash", "Rash maculo-papular", "Skin and subcutaneous tissue disorders", 0.14),
    ("Pruritus", "Pruritus", "Skin and subcutaneous tissue disorders", 0.10),
    ("Diarrhoea", "Diarrhoea", "Gastrointestinal disorders", 0.10),
    ("Nausea", "Nausea", "Gastrointestinal disorders", 0.08),
    ("Pneumonitis", "Pneumonitis", "Respiratory, thoracic and mediastinal disorders", 0.08),
    ("Colitis", "Colitis", "Gastrointestinal disorders", 0.06),
    ("Hepatitis", "Hepatitis", "Hepatobiliary disorders", 0.06),
    ("Thyroiditis", "Thyroiditis", "Endocrine disorders", 0.05),
    ("Hypothyroidism", "Hypothyroidism", "Endocrine disorders", 0.05),
    ("Arthralgia", "Arthralgia", "Musculoskeletal and connective tissue disorders", 0.04),
    ("Pyrexia", "Pyrexia", "General disorders and administration site conditions", 0.04),
]

CHEMO_AE_PROFILE = [
    ("Nausea", "Nausea", "Gastrointestinal disorders", 0.18),
    ("Neutropenia", "Neutropenia", "Blood and lymphatic system disorders", 0.15),
    ("Fatigue", "Fatigue", "General disorders and administration site conditions", 0.14),
    ("Anaemia", "Anaemia", "Blood and lymphatic system disorders", 0.10),
    ("Alopecia", "Alopecia", "Skin and subcutaneous tissue disorders", 0.08),
    ("Peripheral neuropathy", "Peripheral sensory neuropathy", "Nervous system disorders", 0.08),
    ("Vomiting", "Vomiting", "Gastrointestinal disorders", 0.06),
    ("Thrombocytopenia", "Thrombocytopenia", "Blood and lymphatic system disorders", 0.06),
    ("Constipation", "Constipation", "Gastrointestinal disorders", 0.05),
    ("Decreased appetite", "Decreased appetite", "Metabolism and nutrition disorders", 0.04),
    ("Myalgia", "Myalgia", "Musculoskeletal and connective tissue disorders", 0.03),
    ("Stomatitis", "Stomatitis", "Gastrointestinal disorders", 0.03),
]

# ── Lab Parameters ───────────────────────────────────────────────────────────
LAB_PARAMS = {
    "ALT":   {"name": "Alanine Aminotransferase",  "unit": "U/L",      "lo": 7,    "hi": 56,   "mean": 25,   "std": 10},
    "AST":   {"name": "Aspartate Aminotransferase", "unit": "U/L",      "lo": 10,   "hi": 40,   "mean": 22,   "std": 8},
    "BILI":  {"name": "Bilirubin Total",            "unit": "mg/dL",    "lo": 0.1,  "hi": 1.2,  "mean": 0.6,  "std": 0.25},
    "CREAT": {"name": "Creatinine",                 "unit": "mg/dL",    "lo": 0.6,  "hi": 1.2,  "mean": 0.9,  "std": 0.2},
    "WBC":   {"name": "Leukocytes",                 "unit": "x10^9/L",  "lo": 4.0,  "hi": 11.0, "mean": 7.0,  "std": 2.0},
    "ANC":   {"name": "Neutrophils",                "unit": "x10^9/L",  "lo": 1.5,  "hi": 8.0,  "mean": 4.5,  "std": 1.5},
    "HGB":   {"name": "Hemoglobin",                 "unit": "g/dL",     "lo": 12.0, "hi": 17.5, "mean": 13.5, "std": 1.5},
    "PLT":   {"name": "Platelets",                  "unit": "x10^9/L",  "lo": 150,  "hi": 400,  "mean": 250,  "std": 60},
    "ALB":   {"name": "Albumin",                    "unit": "g/dL",     "lo": 3.5,  "hi": 5.5,  "mean": 4.2,  "std": 0.4},
    "LDH":   {"name": "Lactate Dehydrogenase",      "unit": "U/L",      "lo": 120,  "hi": 246,  "mean": 180,  "std": 40},
    "TSH":   {"name": "Thyroid Stimulating Hormone", "unit": "mIU/L",   "lo": 0.4,  "hi": 4.0,  "mean": 2.0,  "std": 0.8},
}

# ── Vital Sign Parameters ────────────────────────────────────────────────────
VITAL_PARAMS = {
    "SYSBP":  {"name": "Systolic Blood Pressure",  "unit": "mmHg",     "mean": 128, "std": 15},
    "DIABP":  {"name": "Diastolic Blood Pressure",  "unit": "mmHg",    "mean": 78,  "std": 10},
    "HR":     {"name": "Heart Rate",                 "unit": "beats/min","mean": 75, "std": 12},
    "TEMP":   {"name": "Body Temperature",           "unit": "C",       "mean": 36.8,"std": 0.3},
    "WEIGHT": {"name": "Body Weight",                "unit": "kg",      "mean": 78,  "std": 15},
    "HEIGHT": {"name": "Body Height",                "unit": "cm",      "mean": 170, "std": 10},
}


# ═══════════════════════════════════════════════════════════════════════════════
# GENERATORS
# ═══════════════════════════════════════════════════════════════════════════════

def generate_study_metadata():
    """Write study_metadata.json with protocol-level info."""
    metadata = {
        "protocol_id": PROTOCOL_ID,
        "title": "A Phase III, Randomized, Open-Label Study of Pembrolizumab versus "
                 "Platinum-Based Chemotherapy for First-Line Treatment of Advanced NSCLC",
        "phase": "Phase III",
        "indication": "Advanced Non-Small Cell Lung Cancer (Stage IIIB/IV)",
        "sponsor": "Oncology Research Corp",
        "arms": [
            {"code": "PEMBRO", "name": "Pembrolizumab 200mg IV Q3W", "type": "Experimental"},
            {"code": "CHEMO", "name": "Carboplatin AUC5 + Paclitaxel 175mg/m2 IV Q3W", "type": "Active Comparator"},
        ],
        "enrollment": {"target": N_PATIENTS, "start_date": str(ENROLLMENT_START)},
        "sites": [
            {
                "site_id": s["SITEID"],
                "name": s["name"],
                "city": s["city"],
                "state": s["state"],
                "country": "US",
            }
            for s in SITES
        ],
    }
    path = OUTPUT_DIR / "study_metadata.json"
    path.write_text(json.dumps(metadata, indent=2))
    print(f"  ✓ study_metadata.json")
    return metadata


def generate_loinc_map():
    """Write LOINC_MAP.json and return the map dict."""
    path = OUTPUT_DIR / "LOINC_MAP.json"
    path.write_text(json.dumps(LOINC_MAP, indent=2))
    print(f"  ✓ LOINC_MAP.json")
    return LOINC_MAP


def generate_demographics():
    """Generate demographics.csv (DM domain). Returns DataFrame."""
    arms = [ARMS[0]] * N_PER_ARM + [ARMS[1]] * N_PER_ARM
    np.random.shuffle(arms)

    site_ids = np.random.choice(
        [s["SITEID"] for s in SITES], size=N_PATIENTS,
        p=[0.15, 0.14, 0.13, 0.13, 0.12, 0.12, 0.11, 0.10],
    )

    ages = np.clip(np.random.normal(63, 10, N_PATIENTS).astype(int), 35, 85)
    sexes = np.random.choice(["M", "F"], size=N_PATIENTS, p=[0.55, 0.45])
    races = np.random.choice(
        ["WHITE", "BLACK OR AFRICAN AMERICAN", "ASIAN", "OTHER"],
        size=N_PATIENTS, p=[0.65, 0.15, 0.12, 0.08],
    )
    ethnicities = np.random.choice(
        ["NOT HISPANIC OR LATINO", "HISPANIC OR LATINO"],
        size=N_PATIENTS, p=[0.85, 0.15],
    )

    # Stagger enrollment dates over 12-week window
    enrollment_offsets = np.random.randint(0, ENROLLMENT_WINDOW_DAYS, N_PATIENTS)
    rfstdtcs = [ENROLLMENT_START + timedelta(days=int(d)) for d in enrollment_offsets]

    # Treatment duration: 14-26 weeks (will be refined after disposition)
    durations = np.random.randint(14 * 7, 26 * 7 + 1, N_PATIENTS)
    rfendtcs = [rfstdtcs[i] + timedelta(days=int(durations[i])) for i in range(N_PATIENTS)]

    rows = []
    for i in range(N_PATIENTS):
        rows.append({
            "SUBJID": f"SUBJ-{i+1:03d}",
            "SITEID": site_ids[i],
            "ARM": arms[i],
            "AGE": ages[i],
            "SEX": sexes[i],
            "RACE": races[i],
            "ETHNIC": ethnicities[i],
            "COUNTRY": "US",
            "RFSTDTC": rfstdtcs[i].isoformat(),
            "RFENDTC": rfendtcs[i].isoformat(),
            "DTHFL": "",
        })

    df = pd.DataFrame(rows)
    print(f"  ✓ demographics.csv ({len(df)} rows)")
    return df


def generate_disposition(demo_df):
    """Generate disposition.csv (DS domain). Returns DataFrame and updates demo_df."""
    # Disposition outcomes by arm
    outcome_weights = {
        "PEMBRO": {
            "outcomes": ["COMPLETED", "ADVERSE EVENT", "PROGRESSIVE DISEASE",
                         "WITHDRAWAL BY SUBJECT", "DEATH"],
            "weights": [0.63, 0.12, 0.14, 0.05, 0.06],
        },
        "CHEMO": {
            "outcomes": ["COMPLETED", "ADVERSE EVENT", "PROGRESSIVE DISEASE",
                         "WITHDRAWAL BY SUBJECT", "DEATH"],
            "weights": [0.57, 0.18, 0.16, 0.05, 0.04],
        },
    }

    rows = []
    death_indices = []

    for _, pat in demo_df.iterrows():
        subjid = pat["SUBJID"]
        arm = pat["ARM"]
        rfstdtc = date.fromisoformat(pat["RFSTDTC"])
        rfendtc = date.fromisoformat(pat["RFENDTC"])

        # Enrolled
        enrolled_date = rfstdtc - timedelta(days=np.random.randint(1, 8))
        rows.append({
            "SUBJID": subjid, "DSSCAT": "ENROLLED",
            "DSDECOD": "ENROLLED", "DSSTDTC": enrolled_date.isoformat(),
        })
        # Randomized
        rand_date = rfstdtc - timedelta(days=np.random.randint(0, 2))
        rows.append({
            "SUBJID": subjid, "DSSCAT": "RANDOMIZED",
            "DSDECOD": "RANDOMIZED", "DSSTDTC": rand_date.isoformat(),
        })

        # Final outcome
        cfg = outcome_weights[arm]
        outcome = np.random.choice(cfg["outcomes"], p=cfg["weights"])

        if outcome == "COMPLETED":
            disp_date = rfendtc
        elif outcome == "DEATH":
            # Death occurs at a random point during treatment
            days_on = (rfendtc - rfstdtc).days
            death_offset = np.random.randint(int(days_on * 0.3), max(int(days_on * 0.9), int(days_on * 0.3) + 1))
            disp_date = rfstdtc + timedelta(days=int(death_offset))
            death_indices.append(pat.name)
        else:
            # Discontinuation at random point
            days_on = (rfendtc - rfstdtc).days
            disc_offset = np.random.randint(int(days_on * 0.2), max(int(days_on * 0.85), int(days_on * 0.2) + 1))
            disp_date = rfstdtc + timedelta(days=int(disc_offset))

        rows.append({
            "SUBJID": subjid, "DSSCAT": "DISPOSITION EVENT",
            "DSDECOD": outcome, "DSSTDTC": disp_date.isoformat(),
        })

        # Update RFENDTC for non-completers
        if outcome != "COMPLETED":
            demo_df.at[pat.name, "RFENDTC"] = disp_date.isoformat()

    # Set death flags
    demo_df["DTHFL"] = ""
    for idx in death_indices:
        demo_df.at[idx, "DTHFL"] = "Y"

    df = pd.DataFrame(rows)
    print(f"  ✓ disposition.csv ({len(df)} rows)")
    return df


def generate_adverse_events(demo_df):
    """Generate adverse_events.csv (AE domain). Returns DataFrame."""
    grade5_budget = 3  # Max fatal AEs across study
    grade5_count = 0

    ae_profiles = {
        "PEMBRO": PEMBRO_AE_PROFILE,
        "CHEMO": CHEMO_AE_PROFILE,
    }
    # Grade distribution by arm: (1, 2, 3, 4, 5)
    # Per-AE probabilities calibrated so that ~15%/~25% of PATIENTS have ≥1 Grade 3+ AE
    # With ~3.5 AEs/patient: P(no G3+) = (1-p)^3.5 → p ≈ 0.047 for 15%, p ≈ 0.08 for 25%
    grade_weights = {
        "PEMBRO": [0.55, 0.40, 0.035, 0.010, 0.005],  # ~15% of patients Grade 3+
        "CHEMO":  [0.48, 0.44, 0.055, 0.020, 0.005],   # ~25% of patients Grade 3+
    }
    severity_map = {1: "MILD", 2: "MILD", 3: "MODERATE", 4: "SEVERE", 5: "SEVERE"}

    rows = []
    for _, pat in demo_df.iterrows():
        subjid = pat["SUBJID"]
        arm = pat["ARM"]
        rfstdtc = date.fromisoformat(pat["RFSTDTC"])
        rfendtc = date.fromisoformat(pat["RFENDTC"])
        treatment_days = max((rfendtc - rfstdtc).days, 7)

        # Number of AEs per patient: Poisson(3.5), some get 0
        n_aes = int(np.random.poisson(3.5))
        n_aes = min(n_aes, 12)

        profile = ae_profiles[arm]
        ae_terms = [p[:3] for p in profile]
        ae_weights_raw = [p[3] for p in profile]
        ae_weights_norm = np.array(ae_weights_raw) / sum(ae_weights_raw)

        for _ in range(n_aes):
            idx = np.random.choice(len(ae_terms), p=ae_weights_norm)
            term, decod, bodsys = ae_terms[idx]

            # Grade
            gw = grade_weights[arm]
            grade = np.random.choice([1, 2, 3, 4, 5], p=gw)

            # Cap grade 5
            if grade == 5:
                if grade5_count >= grade5_budget:
                    grade = 4
                else:
                    grade5_count += 1

            sev = severity_map[grade]

            # Serious: most Grade >=3 are serious, small chance for lower grades
            if grade >= 3:
                aeser = np.random.choice(["Y", "N"], p=[0.7, 0.3])
            else:
                aeser = np.random.choice(["Y", "N"], p=[0.03, 0.97])

            # Relationship
            aerel = np.random.choice(
                ["RELATED", "POSSIBLY RELATED", "NOT RELATED"],
                p=[0.35, 0.35, 0.30],
            )

            # Action taken
            if grade >= 4:
                aeacn = np.random.choice(
                    ["DRUG WITHDRAWN", "DOSE REDUCED", "DOSE NOT CHANGED"],
                    p=[0.50, 0.35, 0.15],
                )
            elif grade == 3:
                aeacn = np.random.choice(
                    ["DOSE REDUCED", "DOSE NOT CHANGED", "DRUG WITHDRAWN"],
                    p=[0.40, 0.40, 0.20],
                )
            else:
                aeacn = np.random.choice(
                    ["DOSE NOT CHANGED", "DOSE REDUCED"],
                    p=[0.90, 0.10],
                )

            # Outcome
            if grade == 5:
                aeout = "FATAL"
            elif grade >= 3:
                aeout = np.random.choice(
                    ["RECOVERED", "RECOVERING", "NOT RECOVERED"],
                    p=[0.50, 0.30, 0.20],
                )
            else:
                aeout = np.random.choice(
                    ["RECOVERED", "RECOVERING", "NOT RECOVERED"],
                    p=[0.75, 0.15, 0.10],
                )

            # Dates
            ae_start_offset = np.random.randint(1, treatment_days)
            aestdtc = rfstdtc + timedelta(days=int(ae_start_offset))

            # End date: some ongoing (~10%)
            if aeout == "NOT RECOVERED" or np.random.random() < 0.10:
                aeendtc = ""
            else:
                ae_dur = np.random.randint(1, max(30, treatment_days - ae_start_offset))
                aeendtc = (aestdtc + timedelta(days=int(ae_dur))).isoformat()

            rows.append({
                "SUBJID": subjid,
                "AETERM": term,
                "AEDECOD": decod,
                "AEBODSYS": bodsys,
                "AESEV": sev,
                "AETOXGR": grade,
                "AESER": aeser,
                "AEREL": aerel,
                "AEACN": aeacn,
                "AEOUT": aeout,
                "AESTDTC": aestdtc.isoformat(),
                "AEENDTC": aeendtc,
            })

    df = pd.DataFrame(rows)
    print(f"  ✓ adverse_events.csv ({len(df)} rows, Grade 5 count: {grade5_count})")
    return df


def _get_patient_visits(rfstdtc_str, rfendtc_str):
    """Return list of (visit_num, visit_date) for a patient based on their treatment window."""
    rfstdtc = date.fromisoformat(rfstdtc_str)
    rfendtc = date.fromisoformat(rfendtc_str)
    visits = []
    for vnum, week_offset in VISIT_SCHEDULE:
        vdate = rfstdtc + timedelta(weeks=week_offset)
        if vdate <= rfendtc + timedelta(days=7):  # small grace window
            visits.append((vnum, vdate))
    return visits


def generate_vital_signs(demo_df):
    """Generate vital_signs.csv (VS domain). Returns DataFrame."""
    rows = []

    for _, pat in demo_df.iterrows():
        subjid = pat["SUBJID"]
        arm = pat["ARM"]
        visits = _get_patient_visits(pat["RFSTDTC"], pat["RFENDTC"])

        # Per-patient baseline values
        baselines = {}
        for code, params in VITAL_PARAMS.items():
            baselines[code] = np.random.normal(params["mean"], params["std"])

        for vnum, vdate in visits:
            for code, params in VITAL_PARAMS.items():
                # HEIGHT only at screening
                if code == "HEIGHT" and vnum != 1:
                    continue

                # ~2% missing measurements
                if np.random.random() < 0.02:
                    continue

                visit_index = vnum - 1  # 0-based for trend calc

                # Base value with per-visit noise
                val = baselines[code] + np.random.normal(0, params["std"] * 0.15)

                # Trends
                if code == "WEIGHT" and arm == "CHEMO":
                    val -= 0.3 * visit_index  # gradual weight loss
                if code == "SYSBP":
                    val += 0.5 * visit_index  # slight increase over time

                # Occasional outlier (~1%)
                if np.random.random() < 0.01:
                    val *= np.random.choice([0.85, 1.15])

                # Round appropriately
                if code == "TEMP":
                    val = round(val, 1)
                elif code in ("WEIGHT", "HEIGHT"):
                    val = round(val, 1)
                else:
                    val = round(val)

                rows.append({
                    "SUBJID": subjid,
                    "VSTESTCD": code,
                    "VSTEST": params["name"],
                    "VSORRES": val,
                    "VSORRESU": params["unit"],
                    "VSDTC": vdate.isoformat(),
                    "VISITNUM": vnum,
                    "VSBLFL": "Y" if vnum == 2 else "",
                })

    df = pd.DataFrame(rows)
    print(f"  ✓ vital_signs.csv ({len(df)} rows)")
    return df


def generate_lab_results(demo_df, loinc_map):
    """Generate lab_results.csv (LB domain). Returns DataFrame."""
    # Pre-select patients with arm-specific abnormalities
    pembro_subjs = demo_df[demo_df["ARM"] == "PEMBRO"]["SUBJID"].tolist()
    chemo_subjs = demo_df[demo_df["ARM"] == "CHEMO"]["SUBJID"].tolist()

    # PEMBRO: ~10% hepatitis (ALT/AST elevation), ~5% thyroid (TSH)
    hepatitis_pts = set(np.random.choice(pembro_subjs, size=int(len(pembro_subjs) * 0.10), replace=False))
    thyroid_pts = set(np.random.choice(pembro_subjs, size=int(len(pembro_subjs) * 0.05), replace=False))

    # CHEMO: ~30% neutropenia (ANC), ~20% anemia (HGB), ~15% thrombocytopenia (PLT)
    neutropenia_pts = set(np.random.choice(chemo_subjs, size=int(len(chemo_subjs) * 0.30), replace=False))
    anemia_pts = set(np.random.choice(chemo_subjs, size=int(len(chemo_subjs) * 0.20), replace=False))
    thrombocytopenia_pts = set(np.random.choice(chemo_subjs, size=int(len(chemo_subjs) * 0.15), replace=False))

    rows = []
    for _, pat in demo_df.iterrows():
        subjid = pat["SUBJID"]
        visits = _get_patient_visits(pat["RFSTDTC"], pat["RFENDTC"])

        # Per-patient baselines
        baselines = {}
        for code, params in LAB_PARAMS.items():
            baselines[code] = np.random.normal(params["mean"], params["std"] * 0.5)

        for vnum, vdate in visits:
            for code, params in LAB_PARAMS.items():
                # ~2% missing
                if np.random.random() < 0.02:
                    continue

                visit_index = vnum - 1
                val = baselines[code] + np.random.normal(0, params["std"] * 0.2)

                # Apply arm-specific abnormalities (onset after visit 4)
                if visit_index >= 4:
                    if subjid in hepatitis_pts and code in ("ALT", "AST"):
                        multiplier = 1.0 + (visit_index - 3) * np.random.uniform(0.3, 0.8)
                        val *= multiplier
                    if subjid in thyroid_pts and code == "TSH":
                        # TSH goes high (hypothyroidism pattern)
                        val += (visit_index - 3) * np.random.uniform(0.5, 1.5)
                    if subjid in neutropenia_pts and code == "ANC":
                        val *= max(0.2, 1.0 - (visit_index - 3) * 0.15)
                    if subjid in anemia_pts and code == "HGB":
                        val -= (visit_index - 3) * np.random.uniform(0.2, 0.5)
                    if subjid in thrombocytopenia_pts and code == "PLT":
                        val *= max(0.3, 1.0 - (visit_index - 3) * 0.10)

                # Ensure positive
                val = max(val, 0.01)

                # Round
                if code in ("BILI", "CREAT", "ALB", "TSH"):
                    val = round(val, 2)
                elif code in ("HGB",):
                    val = round(val, 1)
                else:
                    val = round(val, 1)

                # LOINC
                loinc_code = loinc_map.get(code, {}).get("code", "")

                rows.append({
                    "SUBJID": subjid,
                    "LBTESTCD": code,
                    "LBTEST": params["name"],
                    "LBORRES": val,
                    "LBORRESU": params["unit"],
                    "LBSTNRLO": params["lo"],
                    "LBSTNRHI": params["hi"],
                    "LBDTC": vdate.isoformat(),
                    "VISITNUM": vnum,
                    "LBBLFL": "Y" if vnum == 2 else "",
                    "LBLOINC": loinc_code,
                })

    df = pd.DataFrame(rows)
    print(f"  ✓ lab_results.csv ({len(df)} rows)")
    return df


def generate_medications(demo_df):
    """Generate medications.csv (EX + CM domains). Returns DataFrame."""
    rows = []

    for _, pat in demo_df.iterrows():
        subjid = pat["SUBJID"]
        arm = pat["ARM"]
        visits = _get_patient_visits(pat["RFSTDTC"], pat["RFENDTC"])
        treatment_visits = [(v, d) for v, d in visits if v >= 3]

        # Dose modification for 10-15% of patients
        has_dose_mod = np.random.random() < 0.125
        dose_mod_start = np.random.randint(3, max(len(treatment_visits), 4)) if has_dose_mod else 999

        if arm == "PEMBRO":
            for i, (vnum, vdate) in enumerate(treatment_visits):
                dose = 200 if not (has_dose_mod and i >= dose_mod_start) else 150
                rows.append({
                    "SUBJID": subjid,
                    "CMTRT": f"Pembrolizumab {dose}mg",
                    "CMDOSE": dose,
                    "CMDOSU": "mg",
                    "CMROUTE": "INTRAVENOUS",
                    "CMSTDTC": vdate.isoformat(),
                    "CMENDTC": vdate.isoformat(),
                    "CMCAT": "STUDY DRUG",
                    "VISITNUM": vnum,
                })
        else:  # CHEMO
            n_chemo_cycles = np.random.choice([4, 5, 6])
            for i, (vnum, vdate) in enumerate(treatment_visits):
                if i < n_chemo_cycles:
                    # Carboplatin
                    carbo_dose = 5 if not (has_dose_mod and i >= dose_mod_start) else 4
                    rows.append({
                        "SUBJID": subjid,
                        "CMTRT": f"Carboplatin AUC{carbo_dose}",
                        "CMDOSE": carbo_dose,
                        "CMDOSU": "AUC",
                        "CMROUTE": "INTRAVENOUS",
                        "CMSTDTC": vdate.isoformat(),
                        "CMENDTC": vdate.isoformat(),
                        "CMCAT": "STUDY DRUG",
                        "VISITNUM": vnum,
                    })
                    # Paclitaxel
                    ptx_dose = 175 if not (has_dose_mod and i >= dose_mod_start) else 150
                    rows.append({
                        "SUBJID": subjid,
                        "CMTRT": f"Paclitaxel {ptx_dose}mg/m2",
                        "CMDOSE": ptx_dose,
                        "CMDOSU": "mg/m2",
                        "CMROUTE": "INTRAVENOUS",
                        "CMSTDTC": vdate.isoformat(),
                        "CMENDTC": vdate.isoformat(),
                        "CMCAT": "STUDY DRUG",
                        "VISITNUM": vnum,
                    })

        # Concomitant medications
        for vnum, vdate in treatment_visits:
            # Anti-nausea for chemo patients (~80%)
            if arm == "CHEMO" and np.random.random() < 0.80:
                rows.append({
                    "SUBJID": subjid,
                    "CMTRT": "Ondansetron 8mg",
                    "CMDOSE": 8,
                    "CMDOSU": "mg",
                    "CMROUTE": "INTRAVENOUS",
                    "CMSTDTC": vdate.isoformat(),
                    "CMENDTC": vdate.isoformat(),
                    "CMCAT": "CONCOMITANT",
                    "VISITNUM": vnum,
                })
            # Dexamethasone premedication for chemo (~75%)
            if arm == "CHEMO" and np.random.random() < 0.75:
                rows.append({
                    "SUBJID": subjid,
                    "CMTRT": "Dexamethasone 20mg",
                    "CMDOSE": 20,
                    "CMDOSU": "mg",
                    "CMROUTE": "INTRAVENOUS",
                    "CMSTDTC": vdate.isoformat(),
                    "CMENDTC": vdate.isoformat(),
                    "CMCAT": "CONCOMITANT",
                    "VISITNUM": vnum,
                })
            # Steroids for immune-related AEs in PEMBRO arm (~10%)
            if arm == "PEMBRO" and np.random.random() < 0.10:
                rows.append({
                    "SUBJID": subjid,
                    "CMTRT": "Prednisone 40mg",
                    "CMDOSE": 40,
                    "CMDOSU": "mg",
                    "CMROUTE": "ORAL",
                    "CMSTDTC": vdate.isoformat(),
                    "CMENDTC": (vdate + timedelta(days=14)).isoformat(),
                    "CMCAT": "CONCOMITANT",
                    "VISITNUM": vnum,
                })

        # Filgrastim for neutropenia in chemo patients (~15%)
        if arm == "CHEMO" and np.random.random() < 0.15:
            # Pick a random treatment visit after cycle 2
            eligible = [(v, d) for v, d in treatment_visits if v >= 5]
            if eligible:
                vnum, vdate = eligible[0]
                for day_offset in range(5):
                    rows.append({
                        "SUBJID": subjid,
                        "CMTRT": "Filgrastim 5mcg/kg",
                        "CMDOSE": 5,
                        "CMDOSU": "mcg/kg",
                        "CMROUTE": "SUBCUTANEOUS",
                        "CMSTDTC": (vdate + timedelta(days=day_offset + 1)).isoformat(),
                        "CMENDTC": (vdate + timedelta(days=day_offset + 1)).isoformat(),
                        "CMCAT": "CONCOMITANT",
                        "VISITNUM": vnum,
                    })

    df = pd.DataFrame(rows)
    print(f"  ✓ medications.csv ({len(df)} rows)")
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def print_summary(demo_df, ae_df, vs_df, lab_df, med_df, disp_df):
    """Print validation summary stats."""
    print("\n── Summary Statistics ──────────────────────────────────────")
    print(f"  Demographics:    {len(demo_df):>6} rows")
    print(f"  Adverse Events:  {len(ae_df):>6} rows")
    print(f"  Vital Signs:     {len(vs_df):>6} rows")
    print(f"  Lab Results:     {len(lab_df):>6} rows")
    print(f"  Medications:     {len(med_df):>6} rows")
    print(f"  Disposition:     {len(disp_df):>6} rows")

    # Arm distribution
    arm_counts = demo_df["ARM"].value_counts()
    print(f"\n  Arm distribution: {dict(arm_counts)}")

    # AE Grade 3+ rates by arm
    ae_merged = ae_df.merge(demo_df[["SUBJID", "ARM"]], on="SUBJID")
    for arm in ARMS:
        arm_aes = ae_merged[ae_merged["ARM"] == arm]
        g3plus = arm_aes[arm_aes["AETOXGR"] >= 3]
        pts_with_g3 = g3plus["SUBJID"].nunique()
        total_pts = arm_counts[arm]
        print(f"  {arm} Grade 3+ AE patients: {pts_with_g3}/{total_pts} ({pts_with_g3/total_pts*100:.1f}%)")

    # Deaths
    deaths = demo_df[demo_df["DTHFL"] == "Y"]
    print(f"\n  Deaths: {len(deaths)}")

    # Disposition
    final_disp = disp_df[disp_df["DSSCAT"] == "DISPOSITION EVENT"]
    print(f"  Disposition outcomes:")
    for outcome, count in final_disp["DSDECOD"].value_counts().items():
        print(f"    {outcome}: {count}")

    # Data integrity: all child SUBJIDs exist in demographics
    demo_subjids = set(demo_df["SUBJID"])
    for name, child_df in [("AE", ae_df), ("VS", vs_df), ("LB", lab_df), ("MED", med_df), ("DS", disp_df)]:
        orphans = set(child_df["SUBJID"]) - demo_subjids
        if orphans:
            print(f"  WARNING: {name} has {len(orphans)} orphan SUBJIDs!")
    print("  ✓ All SUBJIDs valid across datasets")
    print("────────────────────────────────────────────────────────────")


def main():
    print("Generating synthetic clinical trial data...")
    print(f"Output directory: {OUTPUT_DIR}\n")

    # 1. Study metadata & LOINC map
    generate_study_metadata()
    loinc_map = generate_loinc_map()

    # 2. Demographics (foundation for everything)
    demo_df = generate_demographics()

    # 3. Disposition (needed to update demo_df RFENDTC/DTHFL)
    disp_df = generate_disposition(demo_df)

    # 4. Rewrite demographics with updated RFENDTC/DTHFL
    demo_df.to_csv(OUTPUT_DIR / "demographics.csv", index=False)

    # 5. Clinical data (all depend on updated demo_df)
    ae_df = generate_adverse_events(demo_df)
    vs_df = generate_vital_signs(demo_df)
    lab_df = generate_lab_results(demo_df, loinc_map)
    med_df = generate_medications(demo_df)

    # 6. Write all CSVs
    ae_df.to_csv(OUTPUT_DIR / "adverse_events.csv", index=False)
    vs_df.to_csv(OUTPUT_DIR / "vital_signs.csv", index=False)
    lab_df.to_csv(OUTPUT_DIR / "lab_results.csv", index=False)
    med_df.to_csv(OUTPUT_DIR / "medications.csv", index=False)
    disp_df.to_csv(OUTPUT_DIR / "disposition.csv", index=False)

    # 7. Summary
    print_summary(demo_df, ae_df, vs_df, lab_df, med_df, disp_df)
    print("\nDone!")


if __name__ == "__main__":
    main()
