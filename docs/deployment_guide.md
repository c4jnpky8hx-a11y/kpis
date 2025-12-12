# Deployment Guide - TestRail KPI Centralization

## 1. Prerequisites
- Google Cloud Project created (`testrail-480214`).
- Billing enabled.
- `gcloud` CLI installed and authenticated.
- `terraform` installed.

### Terraform on Apple Silicon (macOS)
Option A (recommended): Homebrew
```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
terraform -version
```

Option B: use the bundled binary (`bin/terraform`)
```bash
# from the repo root
chmod +x bin/terraform
./bin/terraform -version

# when you are inside infra/
cd infra
../bin/terraform -version
```
Common path issue: running `./bin/terraform` from `infra/` fails because `bin/` lives at the repo root.

## 2. Infrastructure Setup (Terraform)
Initialize and apply the Terraform configuration to create BigQuery datasets, tables, Secret Manager secrets, and the Cloud Scheduler job.

```bash
cd infra
terraform init
terraform apply -var-file="terraform.tfvars"
```
*Review the plan and type `yes` to confirm.*

## 3. Secrets Configuration
Populate the secrets in Secret Manager using the provided script.

```bash
cd ..
chmod +x setup_secrets.sh
./setup_secrets.sh
```

## 4. Service Deployment (Cloud Run)
Build and deploy the Python service.

### Option A: Using Cloud Build (Recommended)
```bash
gcloud builds submit --tag gcr.io/testrail-480214/testrail-kpi-service service/
gcloud run deploy testrail-kpi-service \
  --image gcr.io/testrail-480214/testrail-kpi-service \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GCP_PROJECT_ID=testrail-480214,BQ_DATASET=testrail_kpis
```

### Option B: Direct Source Deploy
```bash
gcloud run deploy testrail-kpi-service \
  --source ./service \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GCP_PROJECT_ID=testrail-480214,BQ_DATASET=testrail_kpis
```

## 5. Initial Data Sync
Manually trigger the sync jobs to populate historical data.

```bash
# Get the Service URL
SERVICE_URL=$(gcloud run services describe testrail-kpi-service --region us-central1 --format 'value(status.url)')

# Trigger Project Sync
curl -X POST "${SERVICE_URL}/jobs/sync?entity=projects"

# Trigger Runs Sync (This may take time for initial load)
curl -X POST "${SERVICE_URL}/jobs/sync?entity=runs"
```

## 6. Data Transformation (SQL)
Run the SQL scripts in BigQuery to generate Silver and Gold layers.

1.  **Bronze to Silver**: Run content of `sql/bronze_to_silver.sql`.
2.  **Silver to Gold**: Run content of `sql/silver_to_gold.sql`.

*Note: In production, these SQLs can be scheduled as BigQuery Scheduled Queries.*

## 7. Verification
Run the Data Quality Checks.
```bash
bq query --use_legacy_sql=false < sql/data_quality_checks.sql
```

## 8. Dashboard Setup (Looker Studio)
1.  Open Looker Studio.
2.  Create Data Source -> BigQuery -> `testrail_kpis` -> `kpi_monthly_performance`.
3.  Create Visualizations:
    - Scorecard: On-Time Start %
    - Time Series: Total Cycles by Month
4.  Repeat for `kpi_uat_certification`.
