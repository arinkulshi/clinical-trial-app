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
PROJECT_ID="ai-poc-project-483817"
REGISTRY="us-west1-docker.pkg.dev/ai-poc-project-483817/clinical-trial-repo"
SERVICES=("hapi-fhir-server" "clinical-trial-backend" "clinical-trial-dashboard")
DASHBOARD_URL="https://clinical-trial-dashboard-jz6ndrvnja-uw.a.run.app"
CORS_ORIGINS="${DASHBOARD_URL},http://localhost:5173,http://localhost:3000"
CONNECTION_NAME="${PROJECT_ID}:${REGION}:clinical-trial-db"

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
    CLOUD_SQL_PUBLIC_IP="${CLOUD_SQL_PUBLIC_IP:-$(gcloud sql instances describe clinical-trial-db --project "${PROJECT_ID}" --format='value(ipAddresses[0].ipAddress)' 2>/dev/null || true)}"
    if [ -z "${CLOUD_SQL_PUBLIC_IP}" ]; then
      echo "ERROR: Could not determine Cloud SQL public IP for clinical-trial-db." >&2
      echo "Set CLOUD_SQL_PUBLIC_IP and rerun: CLOUD_SQL_PUBLIC_IP=x.x.x.x bash scripts/cloud-run-toggle.sh start" >&2
      exit 1
    fi
    HAPI_ENV_FILE="$(mktemp)"
    BACKEND_ENV_FILE="$(mktemp)"
    trap 'rm -f "${HAPI_ENV_FILE}" "${BACKEND_ENV_FILE}"' EXIT
    cat > "${HAPI_ENV_FILE}" <<EOF
spring.datasource.url: "jdbc:postgresql://${CLOUD_SQL_PUBLIC_IP}:5432/hapi_fhir"
spring.datasource.username: "fhir_user"
hapi.fhir.cors.allowed_origin_patterns: "*"
EOF

    echo "    Deploying hapi-fhir-server..."
    gcloud run deploy hapi-fhir-server \
      --image "${REGISTRY}/hapi-fhir:latest" \
      --region "$REGION" --platform managed --port 8080 \
      --memory 2Gi --cpu 2 --min-instances 0 --max-instances 2 \
      --cpu-boost --timeout 600 \
      --env-vars-file "${HAPI_ENV_FILE}" \
      --set-secrets "spring.datasource.password=clinical-trial-db-password:latest" \
      --add-cloudsql-instances "${CONNECTION_NAME}" \
      --allow-unauthenticated --quiet

    FHIR_URL=$(gcloud run services describe hapi-fhir-server --region "$REGION" --format='value(status.url)')
    echo "    FHIR server: ${FHIR_URL}/fhir"
    wait_for_url "${FHIR_URL}/fhir/metadata" "FHIR metadata"

    cat > "${BACKEND_ENV_FILE}" <<EOF
CT_FHIR_SERVER_URL: "${FHIR_URL}/fhir"
CT_GCS_BUCKET: "ai-poc-project-483817-clinical-uploads"
CT_CORS_ORIGINS: "${CORS_ORIGINS}"
CT_LLM_PROVIDER: "gemini"
CT_GEMINI_MODEL: "gemini-2.5-flash-lite"
CT_ASSISTANT_DEMO_MODE: "false"
EOF

    echo "    Deploying clinical-trial-backend..."
    gcloud run deploy clinical-trial-backend \
      --image "${REGISTRY}/backend:latest" \
      --region "$REGION" --platform managed --port 8000 \
      --memory 1Gi --cpu 1 --min-instances 0 --max-instances 2 \
      --env-vars-file "${BACKEND_ENV_FILE}" \
      --set-secrets "CT_GEMINI_API_KEY=gemini-api-key:latest" \
      --allow-unauthenticated --quiet

    BACKEND_URL=$(gcloud run services describe clinical-trial-backend --region "$REGION" --format='value(status.url)')
    echo "    Backend: ${BACKEND_URL}"
    wait_for_url "${BACKEND_URL}/health" "backend health"
    wait_for_url "${BACKEND_URL}/api/datasets" "datasets endpoint"
    verify_cors "${BACKEND_URL}/api/datasets" "${DASHBOARD_URL}"

    echo "    Deploying clinical-trial-dashboard..."
    gcloud run deploy clinical-trial-dashboard \
      --image "${REGISTRY}/dashboard:latest" \
      --region "$REGION" --platform managed --port 80 \
      --memory 256Mi --cpu 1 --min-instances 0 --max-instances 2 \
      --set-env-vars "BACKEND_URL=${BACKEND_URL}" \
      --set-env-vars "DASHBOARD_USER=admin" \
      --set-env-vars "DASHBOARD_PASSWORD=clinicaltrial2024" \
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
