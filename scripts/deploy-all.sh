#!/usr/bin/env bash
# =============================================================================
# Master deployment script — deploys all 3 services to GCP Cloud Run
# Run from the project root: bash scripts/deploy-all.sh
# =============================================================================
set -euo pipefail

PROJECT_ID="ai-poc-project-483817"
REGION="us-west1"
REPO="clinical-trial-repo"
REGISTRY="us-west1-docker.pkg.dev/${PROJECT_ID}/${REPO}"
CONNECTION_NAME="${PROJECT_ID}:${REGION}:clinical-trial-db"
DASHBOARD_URL="https://clinical-trial-dashboard-jz6ndrvnja-uw.a.run.app"
CORS_ORIGINS="${DASHBOARD_URL},http://localhost:5173,http://localhost:3000"
CLOUD_SQL_PUBLIC_IP="${CLOUD_SQL_PUBLIC_IP:-$(gcloud sql instances describe clinical-trial-db --project "${PROJECT_ID}" --format='value(ipAddresses[0].ipAddress)' 2>/dev/null || true)}"

if [ -z "${CLOUD_SQL_PUBLIC_IP}" ]; then
  echo "ERROR: Could not determine Cloud SQL public IP for clinical-trial-db." >&2
  echo "Set CLOUD_SQL_PUBLIC_IP and rerun: CLOUD_SQL_PUBLIC_IP=x.x.x.x bash scripts/deploy-all.sh" >&2
  exit 1
fi

BACKEND_ENV_FILE="$(mktemp)"
HAPI_ENV_FILE="$(mktemp)"
trap 'rm -f "${BACKEND_ENV_FILE}" "${HAPI_ENV_FILE}"' EXIT

wait_for_url() {
  local url="$1"
  local label="$2"
  for _ in $(seq 1 60); do
    if curl -sf "${url}" >/dev/null; then
      return 0
    fi
    sleep 5
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

echo "=============================================="
echo "  Clinical Trial FHIR Dashboard — Full Deploy"
echo "=============================================="
echo

# -------------------------------------------------------
# 0. Authenticate Docker with Artifact Registry
# -------------------------------------------------------
echo "==> Configuring Docker auth for Artifact Registry..."
gcloud auth configure-docker us-west1-docker.pkg.dev --quiet

# -------------------------------------------------------
# 1. Deploy HAPI FHIR Server
# -------------------------------------------------------
echo
echo "=== STEP 1/4: Deploying HAPI FHIR Server ==="
HAPI_IMAGE="${REGISTRY}/hapi-fhir:latest"

docker build -t "${HAPI_IMAGE}" ./hapi-fhir/

docker push "${HAPI_IMAGE}"

cat > "${HAPI_ENV_FILE}" <<EOF
spring.datasource.url: "jdbc:postgresql://${CLOUD_SQL_PUBLIC_IP}:5432/hapi_fhir"
spring.datasource.username: "fhir_user"
hapi.fhir.cors.allowed_origin_patterns: "*"
EOF

gcloud run deploy hapi-fhir-server \
  --image "${HAPI_IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --cpu-boost \
  --min-instances 0 \
  --max-instances 2 \
  --timeout 600 \
  --env-vars-file "${HAPI_ENV_FILE}" \
  --set-secrets "spring.datasource.password=clinical-trial-db-password:latest" \
  --add-cloudsql-instances "${CONNECTION_NAME}" \
  --allow-unauthenticated

FHIR_URL=$(gcloud run services describe hapi-fhir-server --region "${REGION}" --format 'value(status.url)')
echo "FHIR Server URL: ${FHIR_URL}/fhir"
wait_for_url "${FHIR_URL}/fhir/metadata" "FHIR metadata"

# -------------------------------------------------------
# 2. Deploy FastAPI Backend
# -------------------------------------------------------
echo
echo "=== STEP 2/4: Deploying FastAPI Backend ==="
BACKEND_IMAGE="${REGISTRY}/backend:latest"

docker build -t "${BACKEND_IMAGE}" -f ./backend/Dockerfile .

docker push "${BACKEND_IMAGE}"

cat > "${BACKEND_ENV_FILE}" <<EOF
CT_FHIR_SERVER_URL: "${FHIR_URL}/fhir"
CT_GCS_BUCKET: "ai-poc-project-483817-clinical-uploads"
CT_CORS_ORIGINS: "${CORS_ORIGINS}"
CT_LLM_PROVIDER: "gemini"
CT_GEMINI_MODEL: "gemini-2.5-flash-lite"
CT_ASSISTANT_DEMO_MODE: "false"
EOF

gcloud run deploy clinical-trial-backend \
  --image "${BACKEND_IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --port 8000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2 \
  --env-vars-file "${BACKEND_ENV_FILE}" \
  --set-secrets "CT_GEMINI_API_KEY=gemini-api-key:latest" \
  --allow-unauthenticated

BACKEND_URL=$(gcloud run services describe clinical-trial-backend --region "${REGION}" --format 'value(status.url)')
echo "Backend URL: ${BACKEND_URL}"
wait_for_url "${BACKEND_URL}/health" "backend health"
wait_for_url "${BACKEND_URL}/api/datasets" "datasets endpoint"
verify_cors "${BACKEND_URL}/api/datasets" "${DASHBOARD_URL}"

# -------------------------------------------------------
# 3. Deploy React Dashboard
# -------------------------------------------------------
echo
echo "=== STEP 3/4: Deploying React Dashboard ==="
DASHBOARD_IMAGE="${REGISTRY}/dashboard:latest"

docker build -t "${DASHBOARD_IMAGE}" ./dashboard/

docker push "${DASHBOARD_IMAGE}"

gcloud run deploy clinical-trial-dashboard \
  --image "${DASHBOARD_IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --port 80 \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2 \
  --set-env-vars "BACKEND_URL=${BACKEND_URL}" \
  --set-env-vars "DASHBOARD_USER=admin" \
  --set-env-vars "DASHBOARD_PASSWORD=clinicaltrial2024" \
  --allow-unauthenticated

DASHBOARD_URL=$(gcloud run services describe clinical-trial-dashboard --region "${REGION}" --format 'value(status.url)')
echo "Dashboard URL: ${DASHBOARD_URL}"

# -------------------------------------------------------
# 4. Load Synthetic Data
# -------------------------------------------------------
echo
echo "=== STEP 4/4: Loading Synthetic Data ==="
if [ -d "data/fhir_bundles" ] && [ "$(ls data/fhir_bundles/*.json 2>/dev/null | wc -l)" -gt 0 ]; then
  echo "Loading FHIR bundles into ${FHIR_URL}/fhir ..."
  python -m pipeline.load_to_fhir --server-url "${FHIR_URL}/fhir" --bundle-dir data/fhir_bundles/
else
  echo "WARNING: No FHIR bundles found in data/fhir_bundles/. Skipping data load."
  echo "Run 'python pipeline/run_transform.py' first to generate bundles, then load manually:"
  echo "  python -m pipeline.load_to_fhir --server-url ${FHIR_URL}/fhir --bundle-dir data/fhir_bundles/"
fi

# -------------------------------------------------------
# Summary
# -------------------------------------------------------
echo
echo "=============================================="
echo "  Deployment Complete!"
echo "=============================================="
echo
echo "  HAPI FHIR Server:  ${FHIR_URL}/fhir"
echo "  FastAPI Backend:   ${BACKEND_URL}"
echo "  Dashboard:         ${DASHBOARD_URL}"
echo
echo "  Open the Dashboard URL in your browser to test."
echo "=============================================="
