#!/bin/bash

# Configuration
PROJECT_ID="testrail-480214"
SERVICE_NAME="testrail-kpis-dashboard"
REGION="us-central1"
IMAGE_TAG="gcr.io/$PROJECT_ID/$SERVICE_NAME:latest"

echo "========================================================"
echo "DEPLOYING TO GOOGLE CLOUD RUN"
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region:  $REGION"
echo "========================================================"

# 1. Build Container (from root to include service/)
echo "[1/3] Building Container Image..."
# 1. Build Container (from root to include service/)
echo "[1/3] Building Container Image..."
# Ensure we are in the project root (parent of web/)
cd "$(dirname "$0")/.."

# Temporary move Dockerfile to root because gcloud builds submit expects it there for context
cp web/Dockerfile .
gcloud builds submit --tag $IMAGE_TAG --project $PROJECT_ID .
rm Dockerfile

# 2. Deploy
echo "[2/3] Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_TAG \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --set-env-vars GCP_PROJECT_ID=$PROJECT_ID \
  --set-env-vars PYTHONUNBUFFERED=1

echo "========================================================"
echo "DEPLOYMENT COMPLETE"
echo "========================================================"
