#!/usr/bin/env bash
# =============================================================================
# Chunk 3: Build, push, and deploy HAPI FHIR to GCP Cloud Run
# Connects to Cloud SQL via public IP (authorized network).
# Run from the hapi-fhir/ directory.
# =============================================================================

set -euo pipefail

PROJECT_ID="ai-poc-project-483817"
REGION="us-west1"
REPO="clinical-trial-repo"
IMAGE="us-west1-docker.pkg.dev/${PROJECT_ID}/${REPO}/hapi-fhir:latest"
SERVICE_NAME="hapi-fhir-server"
CLOUD_SQL_PUBLIC_IP="${CLOUD_SQL_PUBLIC_IP:?Set CLOUD_SQL_PUBLIC_IP env var}"
CONNECTION_NAME="${PROJECT_ID}:${REGION}:clinical-trial-db"

echo "==> Building Docker image..."
docker build -t "${IMAGE}" .

echo "==> Pushing to Artifact Registry..."
docker push "${IMAGE}"

echo "==> Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --cpu-boost \
  --min-instances 0 \
  --max-instances 2 \
  --timeout 600 \
  --set-env-vars "spring.datasource.url=jdbc:postgresql://${CLOUD_SQL_PUBLIC_IP}:5432/hapi_fhir,spring.datasource.username=fhir_user" \
  --set-secrets "spring.datasource.password=clinical-trial-db-password:latest" \
  --add-cloudsql-instances "${CONNECTION_NAME}" \
  --allow-unauthenticated

echo "==> Fetching service URL..."
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)')
echo "FHIR Base URL: ${SERVICE_URL}/fhir"

echo "==> Verifying with /metadata..."
curl -sf "${SERVICE_URL}/fhir/metadata" | head -c 200
echo
echo "==> Done. HAPI FHIR server deployed successfully."
