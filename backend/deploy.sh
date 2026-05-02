#!/usr/bin/env bash
# =============================================================================
# Deploy FastAPI backend to GCP Cloud Run
# Run from the backend/ directory.
# =============================================================================
set -euo pipefail

PROJECT_ID="ai-poc-project-483817"
REGION="us-west1"
REPO="clinical-trial-repo"
IMAGE="us-west1-docker.pkg.dev/${PROJECT_ID}/${REPO}/backend:latest"
SERVICE_NAME="clinical-trial-backend"

# FHIR server URL — set by the master deploy script or manually
FHIR_SERVER_URL="${FHIR_SERVER_URL:-}"

echo "==> Building backend Docker image..."
docker build -t "${IMAGE}" .

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
  --set-env-vars "CT_FHIR_SERVER_URL=${FHIR_SERVER_URL}" \
  --set-env-vars "CT_GCS_BUCKET=ai-poc-project-483817-clinical-uploads" \
  --set-env-vars 'CT_CORS_ORIGINS=["*"]' \
  --set-env-vars "CT_LLM_PROVIDER=gemini" \
  --set-env-vars "CT_GEMINI_MODEL=gemini-2.5-flash-lite" \
  --set-env-vars "CT_ASSISTANT_DEMO_MODE=false" \
  --set-secrets "CT_GEMINI_API_KEY=gemini-api-key:latest" \
  --allow-unauthenticated

echo "==> Fetching service URL..."
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)')
echo "Backend URL: ${SERVICE_URL}"

echo "==> Verifying health endpoint..."
curl -sf "${SERVICE_URL}/health" || echo "WARNING: health check failed (service may still be starting)"
echo
echo "==> Done. Backend deployed successfully."
