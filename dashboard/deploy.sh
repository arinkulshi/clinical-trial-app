#!/usr/bin/env bash
# =============================================================================
# Deploy React dashboard to GCP Cloud Run
# Run from the dashboard/ directory.
# =============================================================================
set -euo pipefail

PROJECT_ID="ai-poc-project-483817"
REGION="us-west1"
REPO="clinical-trial-repo"
IMAGE="us-west1-docker.pkg.dev/${PROJECT_ID}/${REPO}/dashboard:latest"
SERVICE_NAME="clinical-trial-dashboard"

# Backend URL — set by the master deploy script or manually
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"

echo "==> Building dashboard Docker image..."
docker build -t "${IMAGE}" .

echo "==> Pushing to Artifact Registry..."
docker push "${IMAGE}"

echo "==> Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
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

echo "==> Fetching service URL..."
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)')
echo "Dashboard URL: ${SERVICE_URL}"

echo "==> Done. Dashboard deployed successfully."
