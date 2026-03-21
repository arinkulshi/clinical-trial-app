"""5-stage validation engine for clinical trial data uploads."""

import io
import logging
from datetime import date
from typing import Any

import pandas as pd
from pydantic import ValidationError as PydanticValidationError

from ..models.schemas import (
    DOMAIN_MODELS,
    SHEET_NAME_MAP,
    DomainReport,
    ValidationError,
    ValidationReport,
)

log = logging.getLogger(__name__)

# Filename patterns to detect domain from CSV filename
FILENAME_DOMAIN_MAP = {
    "demographic": "demographics",
    "adverse_event": "adverse_events",
    "adverse": "adverse_events",
    "ae": "adverse_events",
    "vital_sign": "vital_signs",
    "vital": "vital_signs",
    "vs": "vital_signs",
    "lab_result": "lab_results",
    "lab": "lab_results",
    "lb": "lab_results",
    "medication": "medications",
    "med": "medications",
    "cm": "medications",
    "disposition": "disposition",
    "ds": "disposition",
}

# Physiological bounds for Stage 5 plausibility checks
VITAL_BOUNDS = {
    "SYSBP": (60, 250),
    "DIABP": (30, 150),
    "HR": (30, 200),
    "TEMP": (34.0, 42.0),
    "WEIGHT": (20, 300),
    "HEIGHT": (100, 220),
}

LAB_UPPER_BOUNDS = {
    "ALT": 10000,
    "AST": 10000,
    "BILI": 100,
    "CREAT": 50,
    "WBC": 200,
    "ANC": 100,
    "HGB": 30,
    "PLT": 2000,
    "ALB": 10,
    "LDH": 10000,
    "TSH": 200,
}


def detect_domain_from_filename(filename: str) -> str | None:
    """Infer domain key from a filename."""
    name = filename.lower().rsplit(".", 1)[0]  # strip extension
    # Exact match first
    if name in DOMAIN_MODELS:
        return name
    # Fuzzy match on known prefixes
    for prefix, domain in FILENAME_DOMAIN_MAP.items():
        if prefix in name:
            return domain
    return None


def _read_file(
    filename: str, content: bytes
) -> dict[str, pd.DataFrame]:
    """
    Read uploaded file content into DataFrames keyed by domain.

    Supports CSV, XLSX, and FHIR JSON bundles.
    Returns {domain_key: dataframe}.
    """
    lower = filename.lower()

    if lower.endswith(".csv"):
        domain = detect_domain_from_filename(filename)
        if not domain:
            raise ValueError(
                f"Cannot determine domain from filename '{filename}'. "
                "Expected names like demographics.csv, adverse_events.csv, etc."
            )
        df = pd.read_csv(io.BytesIO(content), dtype=str)
        return {domain: df}

    elif lower.endswith(".xlsx") or lower.endswith(".xls"):
        xls = pd.ExcelFile(io.BytesIO(content))
        result = {}
        for sheet in xls.sheet_names:
            domain = SHEET_NAME_MAP.get(sheet)
            if domain:
                result[domain] = pd.read_excel(xls, sheet_name=sheet, dtype=str)
        if not result:
            raise ValueError(
                f"No recognized sheet names found. Expected: {list(SHEET_NAME_MAP.keys())}"
            )
        return result

    elif lower.endswith(".json"):
        # FHIR Bundle JSON — return empty dict; validated differently
        return {}

    else:
        raise ValueError(f"Unsupported file type: {filename}")


def validate_dataset(
    dataset_id: str,
    files: dict[str, bytes],
) -> tuple[ValidationReport, dict[str, int]]:
    """
    Run the full 5-stage validation pipeline.

    Args:
        dataset_id: Unique ID for this dataset.
        files: Mapping of filename -> file content bytes.

    Returns:
        (ValidationReport, row_counts dict)
    """
    # Stage 1: File format check — read all files into DataFrames
    all_domains: dict[str, pd.DataFrame] = {}
    stage1_errors: list[ValidationError] = []

    for filename, content in files.items():
        try:
            domains = _read_file(filename, content)
            all_domains.update(domains)
        except ValueError as exc:
            stage1_errors.append(
                ValidationError(
                    row=0, column="", value=filename, message=str(exc), severity="ERROR"
                )
            )

    # If FHIR JSON was uploaded, do a simplified FHIR validation
    json_files = [f for f in files if f.lower().endswith(".json")]
    if json_files and not all_domains:
        return _validate_fhir_json(dataset_id, files, json_files)

    if stage1_errors:
        report = ValidationReport(
            dataset_id=dataset_id,
            status="INVALID",
            domains={
                "_files": DomainReport(
                    domain="_files",
                    row_count=0,
                    status="INVALID",
                    errors=stage1_errors,
                )
            },
        )
        return report, {}

    # Stages 2-5 per domain
    domain_reports: dict[str, DomainReport] = {}
    row_counts: dict[str, int] = {}
    demographics_df = all_domains.get("demographics")

    for domain_key, df in all_domains.items():
        errors: list[ValidationError] = []
        warnings: list[ValidationError] = []
        row_counts[domain_key] = len(df)

        # Stage 2: Schema validation
        model_cls = DOMAIN_MODELS.get(domain_key)
        if model_cls:
            errors.extend(_stage2_schema(df, model_cls))

        # Stage 3: Controlled terminology (mostly covered by Pydantic Literals)
        # Additional custom checks could go here

        # Stage 4: Cross-domain referential integrity
        if demographics_df is not None and domain_key != "demographics":
            errors.extend(_stage4_referential(df, demographics_df, domain_key))

        # Stage 5: Clinical plausibility (warnings only)
        warnings.extend(_stage5_plausibility(df, domain_key, demographics_df))

        status = "VALID"
        if errors:
            status = "INVALID"
        elif warnings:
            status = "VALID_WITH_WARNINGS"

        domain_reports[domain_key] = DomainReport(
            domain=domain_key,
            row_count=len(df),
            status=status,
            errors=errors,
            warnings=warnings,
        )

    # Overall status
    has_errors = any(r.status == "INVALID" for r in domain_reports.values())
    has_warnings = any(r.status == "VALID_WITH_WARNINGS" for r in domain_reports.values())
    overall = "INVALID" if has_errors else ("VALID_WITH_WARNINGS" if has_warnings else "VALID")

    report = ValidationReport(
        dataset_id=dataset_id, status=overall, domains=domain_reports
    )
    return report, row_counts


def _stage2_schema(
    df: pd.DataFrame, model_cls: type
) -> list[ValidationError]:
    """Validate each row against its Pydantic model."""
    errors: list[ValidationError] = []

    for idx, row_data in df.iterrows():
        row_dict = {}
        for col in row_data.index:
            val = row_data[col]
            if pd.isna(val) or val == "":
                row_dict[col] = None
            else:
                row_dict[col] = val

        try:
            model_cls.model_validate(row_dict)
        except PydanticValidationError as exc:
            for err in exc.errors():
                field = err["loc"][0] if err["loc"] else "unknown"
                errors.append(
                    ValidationError(
                        row=int(idx) + 2,  # 1-indexed + header row
                        column=str(field),
                        value=str(row_dict.get(field, "")),
                        message=err["msg"],
                        severity="ERROR",
                    )
                )
    return errors


def _stage4_referential(
    df: pd.DataFrame, demographics_df: pd.DataFrame, domain_key: str
) -> list[ValidationError]:
    """Check cross-domain referential integrity."""
    errors: list[ValidationError] = []

    if "SUBJID" not in df.columns:
        return errors

    valid_subjects = set(demographics_df["SUBJID"].dropna().unique())
    for idx, row in df.iterrows():
        subj = row.get("SUBJID")
        if pd.notna(subj) and subj not in valid_subjects:
            errors.append(
                ValidationError(
                    row=int(idx) + 2,
                    column="SUBJID",
                    value=str(subj),
                    message=f"SUBJID '{subj}' not found in demographics",
                    severity="ERROR",
                )
            )

    # Date checks: AE onset must be on or after enrollment
    if domain_key == "adverse_events" and "AESTDTC" in df.columns:
        rfst_map = {}
        for _, drow in demographics_df.iterrows():
            if pd.notna(drow.get("RFSTDTC")):
                rfst_map[drow["SUBJID"]] = drow["RFSTDTC"]

        for idx, row in df.iterrows():
            subj = row.get("SUBJID")
            ae_start = row.get("AESTDTC")
            if pd.notna(subj) and pd.notna(ae_start) and subj in rfst_map:
                try:
                    if str(ae_start) < str(rfst_map[subj]):
                        errors.append(
                            ValidationError(
                                row=int(idx) + 2,
                                column="AESTDTC",
                                value=str(ae_start),
                                message=f"AE start date before enrollment date ({rfst_map[subj]})",
                                severity="ERROR",
                            )
                        )
                except (TypeError, ValueError):
                    pass

    return errors


def _stage5_plausibility(
    df: pd.DataFrame, domain_key: str, demographics_df: pd.DataFrame | None
) -> list[ValidationError]:
    """Clinical plausibility checks — warnings only."""
    warnings: list[ValidationError] = []

    if domain_key == "vital_signs" and "VSTESTCD" in df.columns and "VSORRES" in df.columns:
        for idx, row in df.iterrows():
            test = row.get("VSTESTCD")
            val_str = row.get("VSORRES")
            if pd.isna(test) or pd.isna(val_str):
                continue
            try:
                val = float(val_str)
            except (TypeError, ValueError):
                continue
            bounds = VITAL_BOUNDS.get(str(test))
            if bounds and (val < bounds[0] or val > bounds[1]):
                warnings.append(
                    ValidationError(
                        row=int(idx) + 2,
                        column="VSORRES",
                        value=str(val_str),
                        message=f"{test} value {val} outside physiological bounds {bounds}",
                        severity="WARNING",
                    )
                )

    if domain_key == "lab_results" and "LBTESTCD" in df.columns and "LBORRES" in df.columns:
        for idx, row in df.iterrows():
            test = row.get("LBTESTCD")
            val_str = row.get("LBORRES")
            if pd.isna(test) or pd.isna(val_str):
                continue
            try:
                val = float(val_str)
            except (TypeError, ValueError):
                continue
            upper = LAB_UPPER_BOUNDS.get(str(test))
            if upper and val > upper:
                warnings.append(
                    ValidationError(
                        row=int(idx) + 2,
                        column="LBORRES",
                        value=str(val_str),
                        message=f"{test} value {val} exceeds plausibility bound ({upper}), possible unit error",
                        severity="WARNING",
                    )
                )

    if domain_key == "adverse_events":
        for idx, row in df.iterrows():
            # Grade 5 without FATAL outcome
            toxgr = row.get("AETOXGR")
            outcome = row.get("AEOUT")
            if pd.notna(toxgr) and pd.notna(outcome):
                try:
                    grade = int(toxgr)
                except (TypeError, ValueError):
                    continue
                if grade == 5 and outcome != "FATAL":
                    warnings.append(
                        ValidationError(
                            row=int(idx) + 2,
                            column="AEOUT",
                            value=str(outcome),
                            message="Grade 5 AE should have FATAL outcome",
                            severity="WARNING",
                        )
                    )
                elif outcome == "FATAL" and grade != 5:
                    warnings.append(
                        ValidationError(
                            row=int(idx) + 2,
                            column="AETOXGR",
                            value=str(toxgr),
                            message="FATAL outcome should be Grade 5",
                            severity="WARNING",
                        )
                    )

            # AE end before start
            ae_start = row.get("AESTDTC")
            ae_end = row.get("AEENDTC")
            if pd.notna(ae_start) and pd.notna(ae_end):
                if str(ae_end) < str(ae_start):
                    warnings.append(
                        ValidationError(
                            row=int(idx) + 2,
                            column="AEENDTC",
                            value=str(ae_end),
                            message="AE end date before start date",
                            severity="WARNING",
                        )
                    )

    return warnings


def _validate_fhir_json(
    dataset_id: str,
    files: dict[str, bytes],
    json_files: list[str],
) -> tuple[ValidationReport, dict[str, int]]:
    """Validate a direct FHIR Bundle JSON upload."""
    import json

    errors: list[ValidationError] = []
    row_counts: dict[str, int] = {}

    for filename in json_files:
        try:
            bundle = json.loads(files[filename])
        except json.JSONDecodeError as exc:
            errors.append(
                ValidationError(
                    row=0,
                    column="",
                    value=filename,
                    message=f"Invalid JSON: {exc}",
                    severity="ERROR",
                )
            )
            continue

        if bundle.get("resourceType") != "Bundle":
            errors.append(
                ValidationError(
                    row=0,
                    column="resourceType",
                    value=str(bundle.get("resourceType", "")),
                    message="Expected resourceType 'Bundle'",
                    severity="ERROR",
                )
            )
            continue

        entries = bundle.get("entry", [])
        row_counts[filename] = len(entries)

        for i, entry in enumerate(entries):
            resource = entry.get("resource", {})
            if "resourceType" not in resource:
                errors.append(
                    ValidationError(
                        row=i + 1,
                        column="resourceType",
                        value="",
                        message=f"Entry {i} missing resourceType",
                        severity="ERROR",
                    )
                )

    status = "INVALID" if errors else "VALID"
    report = ValidationReport(
        dataset_id=dataset_id,
        status=status,
        domains={
            "fhir_bundle": DomainReport(
                domain="fhir_bundle",
                row_count=sum(row_counts.values()),
                status=status,
                errors=errors,
            )
        },
    )
    return report, row_counts
