#!/usr/bin/env bash
# =============================================================================
# Toggle Clinical Trial FHIR Dashboard services on/off in Cloud Run
# Usage:
#   bash scripts/cloud-run-toggle.sh stop    # Delete services (no billing)
#   bash scripts/cloud-run-toggle.sh start   # Redeploy from existing images
#   bash scripts/cloud-run-toggle.sh status  # Check current state
# =============================================================================
set -euo pipefail

REGION="us-west1"
REGISTRY="us-west1-docker.pkg.dev/ai-poc-project-483817/clinical-trial-repo"
SERVICES=("hapi-fhir-server" "clinical-trial-backend" "clinical-trial-dashboard")

ACTION="${1:-status}"

case "$ACTION" in
  stop)
    echo "==> Deleting all Cloud Run services to stop billing..."
    for svc in "${SERVICES[@]}"; do
      echo "    Deleting ${svc}..."
      gcloud run services delete "$svc" --region "$REGION" --quiet 2>/dev/null || echo "    (already deleted)"
    done
    echo
    echo "All services deleted. No charges will accrue."
    echo "Run 'bash scripts/cloud-run-toggle.sh start' to redeploy."
    ;;

  start)
    echo "==> Deploying all Cloud Run services from existing images..."

    echo "    Deploying hapi-fhir-server..."
    gcloud run deploy hapi-fhir-server \
      --image "${REGISTRY}/hapi-fhir:latest" \
      --region "$REGION" --platform managed --port 8080 \
      --memory 2Gi --cpu 2 --min-instances 0 --max-instances 2 \
      --cpu-boost --timeout 600 --allow-unauthenticated --quiet

    FHIR_URL=$(gcloud run services describe hapi-fhir-server --region "$REGION" --format='value(status.url)')
    echo "    FHIR server: ${FHIR_URL}/fhir"

    echo "    Deploying clinical-trial-backend..."
    gcloud run deploy clinical-trial-backend \
      --image "${REGISTRY}/backend:latest" \
      --region "$REGION" --platform managed --port 8000 \
      --memory 1Gi --cpu 1 --min-instances 0 --max-instances 2 \
      --set-env-vars "CT_FHIR_SERVER_URL=${FHIR_URL}/fhir" \
      --set-env-vars "CT_GCS_BUCKET=ai-poc-project-483817-clinical-uploads" \
      --set-env-vars 'CT_CORS_ORIGINS=["*"]' \
      --allow-unauthenticated --quiet

    BACKEND_URL=$(gcloud run services describe clinical-trial-backend --region "$REGION" --format='value(status.url)')
    echo "    Backend: ${BACKEND_URL}"

    echo "    Deploying clinical-trial-dashboard..."
    gcloud run deploy clinical-trial-dashboard \
      --image "${REGISTRY}/dashboard:latest" \
      --region "$REGION" --platform managed --port 80 \
      --memory 256Mi --cpu 1 --min-instances 0 --max-instances 2 \
      --set-env-vars "BACKEND_URL=${BACKEND_URL}" \
      --allow-unauthenticated --quiet

    DASHBOARD_URL=$(gcloud run services describe clinical-trial-dashboard --region "$REGION" --format='value(status.url)')

    echo
    echo "============================================="
    echo "  All services are running!"
    echo "============================================="
    echo
    echo "  Dashboard:  ${DASHBOARD_URL}"
    echo "  Backend:    ${BACKEND_URL}"
    echo "  FHIR:       ${FHIR_URL}/fhir"
    echo
    echo "  NOTE: FHIR data must be reloaded after restart:"
    echo "  python -m pipeline.load_to_fhir --server-url ${FHIR_URL}/fhir --bundle-dir data/fhir_bundles/"
    ;;

  status)
    echo "==> Cloud Run service status:"
    echo
    for svc in "${SERVICES[@]}"; do
      URL=$(gcloud run services describe "$svc" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)
      if [ -n "$URL" ]; then
        printf "    %-30s RUNNING  %s\n" "$svc" "$URL"
      else
        printf "    %-30s NOT DEPLOYED\n" "$svc"
      fi
    done
    ;;

  *)
    echo "Usage: bash scripts/cloud-run-toggle.sh [stop|start|status]"
    exit 1
    ;;
esac
