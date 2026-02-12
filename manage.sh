#!/bin/bash

# Configuration
PROJECT_ID="testrail-480214"
REGION="us-central1"
SERVICE_NAME="testrail-kpis-dashboard"

# Service URL (Hardcoded for reliability)
SERVICE_URL="https://testrail-kpis-dashboard-789788067290.us-central1.run.app"

function show_help {
    echo "Usage: ./manage.sh [command]"
    echo "Commands:"
    echo "  sync            Trigger full sync via Dashboard API"
    echo "  status          Check the sync state from BigQuery"
    echo "  logs            Tail the Cloud Run logs"
}

function trigger_sync {
    echo "Triggering sync via Dashboard API ($SERVICE_URL/api/sync)..."
    # The Next.js API route currently triggers the fulll local sync script
    curl -X POST "${SERVICE_URL}/api/sync?force=true"
    echo -e "\nRequest sent."
}

function check_status {
    echo "Checking sync state in BigQuery..."
    bq query --use_legacy_sql=false --project_id=$PROJECT_ID \
    "SELECT entity_type, last_sync_ts, status, last_updated_at_watermark FROM \`testrail_kpis.sync_state\` ORDER BY last_sync_ts DESC"
}

function show_logs {
    echo "Fetching recent logs..."
    gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" --project=$PROJECT_ID --limit=20 --format="table(timestamp, textPayload)"
}

case "$1" in
    sync)
        trigger_sync $2
        ;;
    status)
        check_status
        ;;
    logs)
        show_logs
        ;;
    *)
        show_help
        ;;
esac
