#!/bin/bash

# Configuration
PROJECT_ID="testrail-480214"
REGION="us-central1"
SERVICE_NAME="testrail-kpi-service"

# Get Service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format 'value(status.url)')

function show_help {
    echo "Usage: ./manage.sh [command]"
    echo "Commands:"
    echo "  sync [entity]   Trigger sync for an entity (runs, projects, plans, suites, cases, tests, results, milestones, statuses)"
    echo "  status          Check the sync state from BigQuery"
    echo "  logs            Tail the Cloud Run logs"
}

function trigger_sync {
    ENTITY=$1
    if [ -z "$ENTITY" ]; then
        echo "Error: Entity required. Usage: ./manage.sh sync <entity>"
        exit 1
    fi
    echo "Triggering sync for $ENTITY..."
    curl -X POST "${SERVICE_URL}/jobs/sync?entity=${ENTITY}"
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
