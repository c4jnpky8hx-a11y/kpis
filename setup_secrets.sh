#!/bin/bash

# Configuration
PROJECT_ID="testrail-480214"

# Secrets
TR_URL="https://segurossurapa.testrail.io"
TR_USER="gestioncalidad01@sura.com.pa"
TR_KEY="Z3t4eAIotXwa/wwDUzQV-K5XVg5LenwmnveAYMNFy"

echo "Setting up secrets in project $PROJECT_ID..."

# Function to create or update secret
create_secret() {
    local name=$1
    local value=$2
    
    echo "Processing $name..."
    
    # Create secret if not exists (ignore error if exists)
    gcloud secrets create $name --project=$PROJECT_ID --replication-policy="automatic" 2>/dev/null || true
    
    # Add version
    echo -n "$value" | gcloud secrets versions add $name --project=$PROJECT_ID --data-file=-
}

create_secret "testrail_url" "$TR_URL"
read -p "Enter Jira Email: " JIRA_EMAIL
read -s -p "Enter Jira API Token: " JIRA_TOKEN
echo ""

echo "Creating secrets file..."
cat > secrets.env <<EOF
TESTRAIL_URL=$TESTRAIL_URL
TESTRAIL_USER=$TESTRAIL_USER
TESTRAIL_TOKEN=$TESTRAIL_TOKEN
JIRA_EMAIL=$JIRA_EMAIL
JIRA_TOKEN=$JIRA_TOKEN
EOF

echo "Secrets updated successfully."
