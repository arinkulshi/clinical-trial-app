#!/usr/bin/env bash
# =============================================================================
# Chunk 3: Build, push, and deploy HAPI FHIR to GCP Cloud Run
# Run from the hapi-fhir/ directory.
# =============================================================================

set -euo pipefail

PROJECT_ID="ai-poc-project-483817"
REGION="us-west1"
REPO="clinical-trial-repo"
IMAGE="us-west1-docker.pkg.dev/${PROJECT_ID}/${REPO}/hapi-fhir:latest"
SERVICE_NAME="hapi-fhir-server"
CLOUD_SQL_PRIVATE_IP="${CLOUD_SQL_PRIVATE_IP:?Set CLOUD_SQL_PRIVATE_IP before running}"

echo "==> Building Docker image..."
docker build \
  --build-arg "DATASOURCE_URL=jdbc:postgresql://${CLOUD_SQL_PRIVATE_IP}:5432/hapi_fhir" \
  -t "${IMAGE}" .

echo "==> Pushing to Artifact Registry..."
docker push "${IMAGE}"

echo "==> Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2 \
  --vpc-connector clinical-trial-connector \
  --set-env-vars "spring.datasource.url=jdbc:postgresql://${CLOUD_SQL_PRIVATE_IP}:5432/hapi_fhir" \
  --set-secrets "spring.datasource.password=clinical-trial-db-password:latest" \
  --allow-unauthenticated

echo "==> Fetching service URL..."
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)')
echo "FHIR Base URL: ${SERVICE_URL}/fhir"

echo "==> Verifying with /metadata..."
curl -sf "${SERVICE_URL}/fhir/metadata" | head -c 200
echo
echo "==> Done. HAPI FHIR server deployed successfully."
