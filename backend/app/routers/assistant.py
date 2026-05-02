"""Guided AI assistant routes for clinical trial FHIR analysis."""

from __future__ import annotations

import json
import logging
import re
from collections import Counter, defaultdict
from typing import Any, Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import get_settings
from .fhir_proxy import _fhir_url

router = APIRouter(prefix="/api/assistant", tags=["assistant"])
log = logging.getLogger(__name__)

ARMS = ("PEMBRO", "CHEMO")
ALT_CODE = "1742-6"
ANC_CODE = "751-8"
IRAE_TERMS = {
    "pneumonitis",
    "colitis",
    "hepatitis",
    "thyroiditis",
    "rash",
}


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AssistantChatRequest(BaseModel):
    study_id: str
    page: str | None = None
    question: str = Field(..., min_length=1, max_length=1000)
    conversation: list[ChatTurn] = Field(default_factory=list)


class ToolCall(BaseModel):
    tool: str
    description: str
    args: dict[str, Any] = Field(default_factory=dict)


class AssistantChatResponse(BaseModel):
    answer: str
    query_plan: list[ToolCall]
    display: dict[str, Any] | None = None
    sources: list[str] = Field(default_factory=list)
    mode: str = "deterministic_fallback"


async def _fhir_search_all(
    path: str,
    params: dict[str, str],
    *,
    max_pages: int = 5,
) -> dict[str, Any]:
    """Fetch a FHIR search bundle and follow a few next links."""
    settings = get_settings()
    entries: list[dict[str, Any]] = []
    first_url = f"{_fhir_url()}/{path.lstrip('/')}"
    next_url: str | None = first_url
    next_params: dict[str, str] | None = params

    async with httpx.AsyncClient(timeout=settings.assistant_timeout_seconds) as client:
        for _ in range(max_pages):
            if not next_url:
                break
            resp = await client.get(next_url, params=next_params)
            if resp.status_code >= 400:
                log.error("FHIR %s returned %s: %s", next_url, resp.status_code, resp.text[:500])
                raise HTTPException(status_code=resp.status_code, detail=resp.text[:500])

            bundle = resp.json()
            entries.extend(bundle.get("entry", []))
            next_url = None
            next_params = None
            for link in bundle.get("link", []):
                if link.get("relation") == "next":
                    next_url = link.get("url")
                    break

    return {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": len(entries),
        "entry": entries,
    }


def _resources(bundle: dict[str, Any], resource_type: str | None = None) -> list[dict[str, Any]]:
    resources = [
        entry.get("resource", {})
        for entry in bundle.get("entry", [])
        if entry.get("resource")
    ]
    if resource_type:
        return [r for r in resources if r.get("resourceType") == resource_type]
    return resources


async def _study_subjects(study_id: str) -> tuple[list[dict[str, Any]], dict[str, str], dict[str, int]]:
    bundle = await _fhir_search_all(
        "ResearchSubject",
        {
            "study": f"ResearchStudy/{study_id}",
            "_include": "ResearchSubject:individual",
            "_count": "500",
        },
    )
    subjects = _resources(bundle, "ResearchSubject")
    arm_by_patient: dict[str, str] = {}
    totals = {arm: 0 for arm in ARMS}

    for subject in subjects:
        patient_ref = subject.get("individual", {}).get("reference") or subject.get("subject", {}).get("reference")
        arm = subject.get("assignedArm") or subject.get("actualArm") or "Unknown"
        if patient_ref:
            arm_by_patient[patient_ref] = arm
        if arm in totals:
            totals[arm] += 1

    return subjects, arm_by_patient, totals


async def _study_patient_refs(study_id: str) -> list[str]:
    _, arm_by_patient, _ = await _study_subjects(study_id)
    return list(arm_by_patient.keys())


async def _study_adverse_events(study_id: str) -> list[dict[str, Any]]:
    patient_refs = await _study_patient_refs(study_id)
    if not patient_refs:
        return []
    bundle = await _fhir_search_all(
        "AdverseEvent",
        {"subject": ",".join(patient_refs), "_count": "1000"},
    )
    return _resources(bundle, "AdverseEvent")


async def _study_observations(
    study_id: str,
    *,
    category: str | None = None,
    code: str | None = None,
) -> list[dict[str, Any]]:
    patient_refs = await _study_patient_refs(study_id)
    if not patient_refs:
        return []
    params = {"subject": ",".join(patient_refs), "_count": "1000"}
    if category:
        params["category"] = category
    if code:
        params["code"] = code
    bundle = await _fhir_search_all("Observation", params)
    return _resources(bundle, "Observation")


def _ae_grade(ae: dict[str, Any]) -> int | None:
    for ext in ae.get("extension", []):
        if "ctcae-grade" in ext.get("url", ""):
            return ext.get("valueInteger")
    code = ae.get("severity", {}).get("coding", [{}])[0].get("code", "")
    display = ae.get("severity", {}).get("coding", [{}])[0].get("display", "")
    text = f"{code} {display}".lower()
    if "severe" in text:
        return 3
    if "moderate" in text:
        return 2
    if "mild" in text:
        return 1
    return None


def _ae_term(ae: dict[str, Any]) -> str:
    coding = ae.get("event", {}).get("coding", [])
    if coding:
        return coding[0].get("display") or coding[0].get("code") or "Unknown"
    return ae.get("event", {}).get("text") or "Unknown"


def _obs_value(obs: dict[str, Any]) -> float | None:
    value = obs.get("valueQuantity", {}).get("value")
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _obs_ref_high(obs: dict[str, Any]) -> float | None:
    value = (obs.get("referenceRange") or [{}])[0].get("high", {}).get("value")
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _obs_ref_low(obs: dict[str, Any]) -> float | None:
    value = (obs.get("referenceRange") or [{}])[0].get("low", {}).get("value")
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _pct(num: int, denom: int) -> str:
    if not denom:
        return "0%"
    return f"{round((num / denom) * 100, 1)}%"


async def compare_grade3_ae_by_arm(study_id: str) -> dict[str, Any]:
    _, arm_by_patient, totals = await _study_subjects(study_id)
    aes = await _study_adverse_events(study_id)
    affected: dict[str, set[str]] = {arm: set() for arm in ARMS}
    events_by_arm: dict[str, Counter[str]] = {arm: Counter() for arm in ARMS}

    for ae in aes:
        if (_ae_grade(ae) or 0) < 3:
            continue
        patient_ref = ae.get("subject", {}).get("reference")
        arm = arm_by_patient.get(patient_ref, "Unknown")
        if arm not in affected:
            continue
        affected[arm].add(patient_ref)
        events_by_arm[arm][_ae_term(ae)] += 1

    rows = []
    for arm in ARMS:
        count = len(affected[arm])
        rows.append(
            {
                "arm": arm,
                "total_patients": totals.get(arm, 0),
                "affected_patients": count,
                "rate": _pct(count, totals.get(arm, 0)),
                "top_events": [
                    {"term": term, "count": event_count}
                    for term, event_count in events_by_arm[arm].most_common(5)
                ],
            }
        )

    return {
        "metric": "grade3_or_higher_ae_by_arm",
        "rows": rows,
        "sources": ["ResearchSubject", "AdverseEvent"],
    }


async def top_adverse_events_by_arm(study_id: str) -> dict[str, Any]:
    _, arm_by_patient, _ = await _study_subjects(study_id)
    aes = await _study_adverse_events(study_id)
    counters: dict[str, Counter[str]] = {arm: Counter() for arm in ARMS}

    for ae in aes:
        patient_ref = ae.get("subject", {}).get("reference")
        arm = arm_by_patient.get(patient_ref, "Unknown")
        if arm in counters:
            counters[arm][_ae_term(ae)] += 1

    return {
        "metric": "top_adverse_events_by_arm",
        "rows": [
            {
                "arm": arm,
                "events": [
                    {"term": term, "count": count}
                    for term, count in counters[arm].most_common(8)
                ],
            }
            for arm in ARMS
        ],
        "sources": ["ResearchSubject", "AdverseEvent"],
    }


async def find_alt_gt_3x_uln(study_id: str) -> dict[str, Any]:
    _, arm_by_patient, _ = await _study_subjects(study_id)
    observations = await _study_observations(study_id, category="laboratory", code=ALT_CODE)
    peak_by_patient: dict[str, dict[str, Any]] = {}

    for obs in observations:
        value = _obs_value(obs)
        high = _obs_ref_high(obs)
        patient_ref = obs.get("subject", {}).get("reference")
        if value is None or high is None or not patient_ref or value <= high * 3:
            continue
        current = peak_by_patient.get(patient_ref)
        if not current or value > current["alt"]:
            peak_by_patient[patient_ref] = {
                "patient": patient_ref,
                "arm": arm_by_patient.get(patient_ref, "Unknown"),
                "alt": value,
                "uln": high,
                "multiple_of_uln": round(value / high, 1) if high else None,
                "date": obs.get("effectiveDateTime") or obs.get("issued"),
            }

    rows = sorted(peak_by_patient.values(), key=lambda row: row["alt"], reverse=True)
    return {
        "metric": "alt_gt_3x_uln",
        "count": len(rows),
        "rows": rows[:50],
        "sources": ["ResearchSubject", "Observation"],
    }


async def compare_neutropenia_by_arm(study_id: str) -> dict[str, Any]:
    _, arm_by_patient, totals = await _study_subjects(study_id)
    observations = await _study_observations(study_id, category="laboratory", code=ANC_CODE)
    affected: dict[str, set[str]] = {arm: set() for arm in ARMS}
    worst_by_arm = {arm: None for arm in ARMS}

    for obs in observations:
        value = _obs_value(obs)
        low = _obs_ref_low(obs)
        patient_ref = obs.get("subject", {}).get("reference")
        arm = arm_by_patient.get(patient_ref, "Unknown")
        if value is None or low is None or arm not in affected:
            continue
        if value < low:
            affected[arm].add(patient_ref)
            worst = worst_by_arm[arm]
            worst_by_arm[arm] = value if worst is None else min(worst, value)

    return {
        "metric": "neutropenia_by_arm",
        "rows": [
            {
                "arm": arm,
                "total_patients": totals.get(arm, 0),
                "affected_patients": len(affected[arm]),
                "rate": _pct(len(affected[arm]), totals.get(arm, 0)),
                "worst_anc": worst_by_arm[arm],
            }
            for arm in ARMS
        ],
        "sources": ["ResearchSubject", "Observation"],
    }


async def find_patient_with_irae(study_id: str) -> dict[str, Any]:
    _, arm_by_patient, _ = await _study_subjects(study_id)
    aes = await _study_adverse_events(study_id)

    for ae in sorted(aes, key=lambda item: _ae_grade(item) or 0, reverse=True):
        term = _ae_term(ae)
        if not any(keyword in term.lower() for keyword in IRAE_TERMS):
            continue
        patient_ref = ae.get("subject", {}).get("reference")
        return {
            "metric": "patient_with_immune_related_ae",
            "patient": patient_ref,
            "patient_id": patient_ref.split("/")[-1] if patient_ref else None,
            "arm": arm_by_patient.get(patient_ref, "Unknown"),
            "event": term,
            "grade": _ae_grade(ae),
            "date": ae.get("date"),
            "sources": ["ResearchSubject", "AdverseEvent"],
        }

    return {
        "metric": "patient_with_immune_related_ae",
        "patient": None,
        "sources": ["ResearchSubject", "AdverseEvent"],
    }


async def summarize_safety_by_arm(study_id: str) -> dict[str, Any]:
    grade3, top_events, alt, anc = await _run_tools(
        study_id,
        [
            ToolCall(tool="compare_grade3_ae_by_arm", description="", args={}),
            ToolCall(tool="top_adverse_events_by_arm", description="", args={}),
            ToolCall(tool="find_alt_gt_3x_uln", description="", args={}),
            ToolCall(tool="compare_neutropenia_by_arm", description="", args={}),
        ],
    )
    return {
        "metric": "safety_summary_by_arm",
        "grade3_ae": grade3,
        "top_adverse_events": top_events,
        "alt_gt_3x_uln": alt,
        "neutropenia": anc,
        "sources": ["ResearchSubject", "AdverseEvent", "Observation"],
    }


async def search_fhir_resources(
    study_id: str, resource_type: str, search_params: dict[str, Any] | None = None
) -> dict[str, Any]:
    """General FHIR search scoped to study patients where applicable."""
    search_params = search_params or {}
    patient_refs = await _study_patient_refs(study_id)
    # Auto-scope patient-related resources to study patients
    if resource_type in ("AdverseEvent", "Observation", "MedicationAdministration", "Condition") and "subject" not in search_params:
        search_params["subject"] = ",".join(patient_refs)
    # Limit results for safety
    search_params.setdefault("_count", "100")
    bundle = await _fhir_search_all(resource_type, search_params)
    return {
        "metric": "fhir_search",
        "resource_type": resource_type,
        "total": bundle.get("total", 0),
        "resources": _resources(bundle, resource_type)[:50],  # Cap at 50 for response size
        "sources": [resource_type],
    }


async def get_study_patients(study_id: str) -> dict[str, Any]:
    subjects, _, totals = await _study_subjects(study_id)
    return {
        "metric": "study_patients",
        "total": len(subjects),
        "arms": [{"arm": arm, "patients": totals.get(arm, 0)} for arm in ARMS],
        "sources": ["ResearchSubject", "Patient"],
    }


async def get_adverse_events(study_id: str) -> dict[str, Any]:
    aes = await _study_adverse_events(study_id)
    return {
        "metric": "adverse_events",
        "total": len(aes),
        "sample": [
            {
                "patient": ae.get("subject", {}).get("reference"),
                "term": _ae_term(ae),
                "grade": _ae_grade(ae),
                "date": ae.get("date"),
            }
            for ae in aes[:25]
        ],
        "sources": ["AdverseEvent"],
    }


TOOL_REGISTRY = {
    "compare_grade3_ae_by_arm": compare_grade3_ae_by_arm,
    "top_adverse_events_by_arm": top_adverse_events_by_arm,
    "find_alt_gt_3x_uln": find_alt_gt_3x_uln,
    "compare_neutropenia_by_arm": compare_neutropenia_by_arm,
    "summarize_safety_by_arm": summarize_safety_by_arm,
    "find_patient_with_irAE": find_patient_with_irae,
    "get_study_patients": get_study_patients,
    "get_adverse_events": get_adverse_events,
    "search_fhir_resources": search_fhir_resources,
}


def _heuristic_plan(question: str) -> list[ToolCall]:
    q = question.lower()
    if "alt" in q or "hepatotoxic" in q or "liver" in q:
        return [
            ToolCall(
                tool="find_alt_gt_3x_uln",
                description="Find patients with ALT laboratory values greater than 3x ULN.",
            )
        ]
    if "neutropenia" in q or "anc" in q or "neutrophil" in q:
        return [
            ToolCall(
                tool="compare_neutropenia_by_arm",
                description="Compare low ANC/neutropenia signals by treatment arm.",
            )
        ]
    if "top" in q or "most common" in q or "common" in q:
        return [
            ToolCall(
                tool="top_adverse_events_by_arm",
                description="Rank the most common adverse events by treatment arm.",
            )
        ]
    if "immune" in q or "irae" in q or "patient with" in q:
        return [
            ToolCall(
                tool="find_patient_with_irAE",
                description="Find a patient with an immune-related adverse event suitable for patient journey drilldown.",
            )
        ]
    if "summar" in q or "safety" in q or "difference" in q:
        return [
            ToolCall(
                tool="summarize_safety_by_arm",
                description="Summarize key safety differences between PEMBRO and CHEMO.",
            )
        ]
    return [
        ToolCall(
            tool="compare_grade3_ae_by_arm",
            description="Compare Grade 3 or higher adverse event rates by treatment arm.",
        )
    ]


def _extract_json(text: str) -> dict[str, Any] | None:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None


async def _gemini_generate(prompt: str) -> str | None:
    settings = get_settings()
    if settings.assistant_demo_mode or not settings.gemini_api_key:
        return None

    url = (
        "https://generativelanguage.googleapis.com/v1beta/"
        f"models/{settings.gemini_model}:generateContent"
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1200},
    }
    try:
        async with httpx.AsyncClient(timeout=settings.assistant_timeout_seconds) as client:
            resp = await client.post(url, params={"key": settings.gemini_api_key}, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:  # noqa: BLE001 - API failure should degrade gracefully.
        log.warning("Gemini request failed; using deterministic fallback: %s", exc)
        return None

    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        return None


async def _llm_plan(req: AssistantChatRequest) -> tuple[list[ToolCall], str]:
    tools = "\n".join(f"- {name}" for name in TOOL_REGISTRY)
    prompt = f"""
You are planning clinical trial FHIR analysis for a guided dashboard assistant.
Return only JSON. Use only these approved tools:
{tools}

Current selected study_id: {req.study_id}
Current page: {req.page or "unknown"}
Question: {req.question}

JSON shape:
{{"queries": [{{"tool": "tool_name", "description": "...", "args": {{"study_id": "CURRENT_STUDY"}}}}], "display_hint": "text|table|chart"}}
"""
    text = await _gemini_generate(prompt)
    if text:
        parsed = _extract_json(text)
        calls = []
        for item in (parsed or {}).get("queries", []):
            tool = item.get("tool")
            if tool in TOOL_REGISTRY:
                calls.append(
                    ToolCall(
                        tool=tool,
                        description=item.get("description") or f"Run {tool}.",
                        args={"study_id": req.study_id},
                    )
                )
        if calls:
            return calls, "gemini"
    return _heuristic_plan(req.question), "deterministic_fallback"


async def _run_tools(study_id: str, calls: list[ToolCall]) -> list[dict[str, Any]]:
    results = []
    for call in calls:
        tool = TOOL_REGISTRY.get(call.tool)
        if not tool:
            raise HTTPException(status_code=400, detail=f"Unsupported assistant tool: {call.tool}")
        results.append(await tool(study_id))
    return results


def _table_display(title: str, columns: list[str], rows: list[list[Any]]) -> dict[str, Any]:
    return {"type": "table", "title": title, "columns": columns, "rows": rows}


def _chart_display(title: str, rows: list[dict[str, Any]], value_key: str) -> dict[str, Any]:
    return {
        "type": "bar",
        "title": title,
        "data": [{"label": row["arm"], "value": row.get(value_key, 0)} for row in rows],
    }


def _deterministic_answer(question: str, results: list[dict[str, Any]]) -> tuple[str, dict[str, Any] | None]:
    result = results[0] if results else {}
    metric = result.get("metric")

    if metric == "grade3_or_higher_ae_by_arm":
        rows = result["rows"]
        answer_parts = [
            f"{row['arm']}: {row['affected_patients']} of {row['total_patients']} patients ({row['rate']})"
            for row in rows
        ]
        answer = "Grade 3 or higher adverse events by arm: " + "; ".join(answer_parts) + "."
        display = _table_display(
            "Grade 3+ adverse events by arm",
            ["Arm", "Patients", "Patients with Grade 3+ AE", "Rate"],
            [[row["arm"], row["total_patients"], row["affected_patients"], row["rate"]] for row in rows],
        )
        return answer, display

    if metric == "top_adverse_events_by_arm":
        lines = []
        table_rows = []
        for arm_row in result["rows"]:
            top = arm_row["events"][:5]
            lines.append(
                f"{arm_row['arm']}: "
                + ", ".join(f"{event['term']} ({event['count']})" for event in top)
            )
            table_rows.extend([[arm_row["arm"], event["term"], event["count"]] for event in top])
        return "Most common adverse events by arm: " + "; ".join(lines) + ".", _table_display(
            "Top adverse events by arm",
            ["Arm", "Event", "Count"],
            table_rows,
        )

    if metric == "alt_gt_3x_uln":
        rows = result.get("rows", [])
        if not rows:
            return "No patients had ALT values greater than 3x ULN in the returned study data.", None
        return (
            f"{result['count']} patients had ALT greater than 3x ULN. "
            f"The highest returned value was {rows[0]['alt']} ({rows[0]['multiple_of_uln']}x ULN) "
            f"in {rows[0]['patient']} on the {rows[0]['arm']} arm.",
            _table_display(
                "Patients with ALT > 3x ULN",
                ["Patient", "Arm", "Peak ALT", "ULN", "x ULN", "Date"],
                [
                    [row["patient"], row["arm"], row["alt"], row["uln"], row["multiple_of_uln"], row["date"]]
                    for row in rows[:15]
                ],
            ),
        )

    if metric == "neutropenia_by_arm":
        rows = result["rows"]
        answer = "Low ANC/neutropenia signal by arm: " + "; ".join(
            f"{row['arm']}: {row['affected_patients']} of {row['total_patients']} patients ({row['rate']})"
            for row in rows
        ) + "."
        return answer, _chart_display("Patients with low ANC by arm", rows, "affected_patients")

    if metric == "patient_with_immune_related_ae":
        if not result.get("patient"):
            return "I did not find an immune-related adverse event in the returned study data.", None
        return (
            f"A useful patient journey example is {result['patient']} on the {result['arm']} arm, "
            f"with {result['event']} Grade {result['grade']} on {result['date']}.",
            _table_display(
                "Patient with immune-related AE",
                ["Patient", "Arm", "Event", "Grade", "Date"],
                [[result["patient"], result["arm"], result["event"], result["grade"], result["date"]]],
            ),
        )

    if metric == "safety_summary_by_arm":
        grade_rows = result["grade3_ae"]["rows"]
        anc_rows = result["neutropenia"]["rows"]
        alt_count = result["alt_gt_3x_uln"]["count"]
        answer = (
            "Safety summary: Grade 3+ AE rates were "
            + "; ".join(f"{row['arm']} {row['rate']}" for row in grade_rows)
            + ". Low ANC rates were "
            + "; ".join(f"{row['arm']} {row['rate']}" for row in anc_rows)
            + f". ALT >3x ULN was observed in {alt_count} patients."
        )
        return answer, _table_display(
            "Safety summary by arm",
            ["Metric", "PEMBRO", "CHEMO"],
            [
                ["Grade 3+ AE rate", grade_rows[0]["rate"], grade_rows[1]["rate"]],
                ["Low ANC rate", anc_rows[0]["rate"], anc_rows[1]["rate"]],
                ["ALT >3x ULN patients", alt_count, alt_count],
            ],
        )

    return "I found data for the selected study, but I could not format a specific clinical summary for that question yet.", None


async def _llm_answer(
    req: AssistantChatRequest,
    calls: list[ToolCall],
    results: list[dict[str, Any]],
    mode: str,
) -> tuple[str, dict[str, Any] | None, str]:
    fallback_answer, fallback_display = _deterministic_answer(req.question, results)
    if mode != "gemini":
        return fallback_answer, fallback_display, mode

    prompt = f"""
You are a clinical trial data analyst assistant. Answer using only the provided compact tool results.
Do not invent values. Do not provide medical advice. Mention both PEMBRO and CHEMO when comparing arms.
Return only JSON with keys: answer, display.

Question: {req.question}
Query plan: {json.dumps([call.model_dump() for call in calls])}
Tool results: {json.dumps(results)[:12000]}
Fallback display object you may reuse if appropriate: {json.dumps(fallback_display)}
"""
    text = await _gemini_generate(prompt)
    parsed = _extract_json(text or "")
    if parsed and parsed.get("answer"):
        return parsed["answer"], parsed.get("display") or fallback_display, "gemini"
    return fallback_answer, fallback_display, "deterministic_fallback"


@router.post("/chat", response_model=AssistantChatResponse)
async def chat(req: AssistantChatRequest):
    """Answer a clinical trial question with constrained backend tools and optional Gemini wording."""
    calls, planning_mode = await _llm_plan(req)
    for call in calls:
        call.args = {"study_id": req.study_id}

    results = await _run_tools(req.study_id, calls)
    answer, display, answer_mode = await _llm_answer(req, calls, results, planning_mode)

    sources = sorted(
        {
            source
            for result in results
            for source in result.get("sources", [])
        }
    )
    return AssistantChatResponse(
        answer=answer,
        query_plan=calls,
        display=display,
        sources=sources,
        mode=answer_mode,
    )

