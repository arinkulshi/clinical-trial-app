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

gcloud run deploy hapi-fhir-server \
  --image "${HAPI_IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2 \
  --set-env-vars "spring.datasource.url=jdbc:postgresql://localhost:5432/hapi_fhir" \
  --set-env-vars "hapi.fhir.cors.allowed_origin_patterns=*" \
  --allow-unauthenticated

FHIR_URL=$(gcloud run services describe hapi-fhir-server --region "${REGION}" --format 'value(status.url)')
echo "FHIR Server URL: ${FHIR_URL}/fhir"

# -------------------------------------------------------
# 2. Deploy FastAPI Backend
# -------------------------------------------------------
echo
echo "=== STEP 2/4: Deploying FastAPI Backend ==="
BACKEND_IMAGE="${REGISTRY}/backend:latest"

docker build -t "${BACKEND_IMAGE}" ./backend/

docker push "${BACKEND_IMAGE}"

gcloud run deploy clinical-trial-backend \
  --image "${BACKEND_IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --port 8000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2 \
  --set-env-vars "CT_FHIR_SERVER_URL=${FHIR_URL}/fhir" \
  --set-env-vars "CT_GCS_BUCKET=ai-poc-project-483817-clinical-uploads" \
  --set-env-vars 'CT_CORS_ORIGINS=["*"]' \
  --set-env-vars "CT_LLM_PROVIDER=gemini" \
  --set-env-vars "CT_GEMINI_MODEL=gemini-2.5-flash-lite" \
  --set-env-vars "CT_ASSISTANT_DEMO_MODE=false" \
  --set-secrets "CT_GEMINI_API_KEY=gemini-api-key:latest" \
  --allow-unauthenticated

BACKEND_URL=$(gcloud run services describe clinical-trial-backend --region "${REGION}" --format 'value(status.url)')
echo "Backend URL: ${BACKEND_URL}"

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
