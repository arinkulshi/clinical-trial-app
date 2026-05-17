#!/usr/bin/env bash
# =============================================================================
# Deploy FastAPI backend to GCP Cloud Run.
# Can be run from any directory.
# =============================================================================
set -euo pipefail

PROJECT_ID="ai-poc-project-483817"
REGION="us-west1"
REPO="clinical-trial-repo"
IMAGE="us-west1-docker.pkg.dev/${PROJECT_ID}/${REPO}/backend:latest"
SERVICE_NAME="clinical-trial-backend"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DASHBOARD_URL="${DASHBOARD_URL:-https://clinical-trial-dashboard-jz6ndrvnja-uw.a.run.app}"
CORS_ORIGINS="${CORS_ORIGINS:-${DASHBOARD_URL},http://localhost:5173,http://localhost:3000}"

# FHIR server URL — set by the master deploy script, manually, or discovered.
FHIR_SERVER_URL="${FHIR_SERVER_URL:-}"
if [ -z "${FHIR_SERVER_URL}" ]; then
  FHIR_SERVICE_URL="$(gcloud run services describe hapi-fhir-server --region "${REGION}" --format 'value(status.url)' 2>/dev/null || true)"
  if [ -z "${FHIR_SERVICE_URL}" ]; then
    echo "ERROR: FHIR_SERVER_URL is not set and hapi-fhir-server was not found in Cloud Run." >&2
    exit 1
  fi
  FHIR_SERVER_URL="${FHIR_SERVICE_URL}/fhir"
fi

ENV_FILE="$(mktemp)"
trap 'rm -f "${ENV_FILE}"' EXIT
cat > "${ENV_FILE}" <<EOF
CT_FHIR_SERVER_URL: "${FHIR_SERVER_URL}"
CT_GCS_BUCKET: "ai-poc-project-483817-clinical-uploads"
CT_CORS_ORIGINS: "${CORS_ORIGINS}"
CT_LLM_PROVIDER: "gemini"
CT_GEMINI_MODEL: "gemini-2.5-flash-lite"
CT_ASSISTANT_DEMO_MODE: "false"
EOF

wait_for_url() {
  local url="$1"
  local label="$2"
  for _ in $(seq 1 30); do
    if curl -sf "${url}" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  echo "ERROR: ${label} did not become ready: ${url}" >&2
  return 1
}

verify_cors() {
  local url="$1"
  local origin="$2"
  for _ in $(seq 1 15); do
    if curl -sS -D - -o /dev/null -H "Origin: ${origin}" "${url}" \
      | tr -d '\r' \
      | grep -Fq "access-control-allow-origin: ${origin}"; then
      return 0
    fi
    sleep 2
  done
  echo "ERROR: CORS header for ${origin} was not returned by ${url}" >&2
  return 1
}

echo "==> Building backend Docker image..."
docker build -t "${IMAGE}" -f "${PROJECT_ROOT}/backend/Dockerfile" "${PROJECT_ROOT}"

echo "==> Pushing to Artifact Registry..."
docker push "${IMAGE}"

echo "==> Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --port 8000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2 \
  --env-vars-file "${ENV_FILE}" \
  --set-secrets "CT_GEMINI_API_KEY=gemini-api-key:latest" \
  --allow-unauthenticated

echo "==> Fetching service URL..."
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)')
echo "Backend URL: ${SERVICE_URL}"

echo "==> Verifying health endpoint..."
wait_for_url "${SERVICE_URL}/health" "backend health"
echo
echo "==> Verifying datasets endpoint and CORS..."
wait_for_url "${SERVICE_URL}/api/datasets" "datasets endpoint"
verify_cors "${SERVICE_URL}/api/datasets" "${DASHBOARD_URL}"
echo
echo "==> Done. Backend deployed successfully."
