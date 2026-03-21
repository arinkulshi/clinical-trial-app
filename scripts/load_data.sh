#!/bin/bash
# Load FHIR bundles into the HAPI FHIR server.
# Usage: ./scripts/load_data.sh [FHIR_SERVER_URL]

set -e

FHIR_SERVER_URL=${1:-"http://localhost:8080/fhir"}

echo "Loading data into FHIR server at: $FHIR_SERVER_URL"
python -m pipeline.load_to_fhir --server-url "$FHIR_SERVER_URL" --bundle-dir data/fhir_bundles/
