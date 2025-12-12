terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  backend "local" {} # Using local backend for simplicity as requested, can be changed to GCS
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "bigquery.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudscheduler.googleapis.com",
    "iam.googleapis.com",
    "artifactregistry.googleapis.com"
  ])
  service            = each.key
  disable_on_destroy = false
}

# BigQuery Dataset
resource "google_bigquery_dataset" "testrail_data" {
  dataset_id  = var.bq_dataset_id
  location    = var.region
  description = "TestRail KPI Data Warehouse"
  
  depends_on = [google_project_service.apis]
}

# BigQuery Tables (Bronze Layer)
resource "google_bigquery_table" "raw_projects" {
  dataset_id = google_bigquery_dataset.testrail_data.dataset_id
  table_id   = "raw_projects"
  schema     = file("${path.module}/schemas/raw_projects.json")
}

resource "google_bigquery_table" "raw_runs" {
  dataset_id = google_bigquery_dataset.testrail_data.dataset_id
  table_id   = "raw_runs"
  schema     = file("${path.module}/schemas/raw_runs.json")
  
  time_partitioning {
    type  = "DAY"
    field = "created_on"
  }
}

resource "google_bigquery_table" "raw_plans" {
  dataset_id = google_bigquery_dataset.testrail_data.dataset_id
  table_id   = "raw_plans"
  schema     = file("${path.module}/schemas/raw_plans.json")
}

resource "google_bigquery_table" "raw_results" {
  dataset_id = google_bigquery_dataset.testrail_data.dataset_id
  table_id   = "raw_results"
  schema     = file("${path.module}/schemas/raw_results.json")
  
  time_partitioning {
    type  = "DAY"
    field = "created_on"
  }
}

resource "google_bigquery_table" "raw_milestones" {
  dataset_id = google_bigquery_dataset.testrail_data.dataset_id
  table_id   = "raw_milestones"
  schema     = file("${path.module}/schemas/raw_milestones.json")
}

resource "google_bigquery_table" "raw_suites" {
  dataset_id = google_bigquery_dataset.testrail_data.dataset_id
  table_id   = "raw_suites"
  schema     = file("${path.module}/schemas/raw_suites.json")
}

resource "google_bigquery_table" "raw_cases" {
  dataset_id = google_bigquery_dataset.testrail_data.dataset_id
  table_id   = "raw_cases"
  schema     = file("${path.module}/schemas/raw_cases.json")
}

resource "google_bigquery_table" "raw_tests" {
  dataset_id = google_bigquery_dataset.testrail_data.dataset_id
  table_id   = "raw_tests"
  schema     = file("${path.module}/schemas/raw_tests.json")
}

resource "google_bigquery_table" "raw_statuses" {
  dataset_id = google_bigquery_dataset.testrail_data.dataset_id
  table_id   = "raw_statuses"
  schema     = file("${path.module}/schemas/raw_statuses.json")
}

resource "google_bigquery_table" "sync_state" {
  dataset_id = google_bigquery_dataset.testrail_data.dataset_id
  table_id   = "sync_state"
  schema     = <<EOF
[
  {
    "name": "entity_type",
    "type": "STRING",
    "mode": "REQUIRED"
  },
  {
    "name": "scope_id",
    "type": "STRING",
    "mode": "NULLABLE"
  },
  {
    "name": "last_updated_at_watermark",
    "type": "INT64",
    "mode": "NULLABLE"
  },
  {
    "name": "last_sync_ts",
    "type": "TIMESTAMP",
    "mode": "NULLABLE"
  },
  {
    "name": "status",
    "type": "STRING",
    "mode": "NULLABLE"
  }
]
EOF
}

# Secret Manager
resource "google_secret_manager_secret" "testrail_api_key" {
  secret_id = "testrail_api_key"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "testrail_user" {
  secret_id = "testrail_user"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "testrail_url" {
  secret_id = "testrail_url"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

# Service Account for Cloud Run
resource "google_service_account" "service_runner" {
  account_id   = "testrail-kpi-runner"
  display_name = "TestRail KPI Service Runner"
}

# IAM Roles for Service Account
resource "google_project_iam_member" "bq_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.service_runner.email}"
}

resource "google_project_iam_member" "bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.service_runner.email}"
}

resource "google_secret_manager_secret_iam_member" "secret_accessor_key" {
  secret_id = google_secret_manager_secret.testrail_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.service_runner.email}"
}

resource "google_secret_manager_secret_iam_member" "secret_accessor_user" {
  secret_id = google_secret_manager_secret.testrail_user.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.service_runner.email}"
}

resource "google_secret_manager_secret_iam_member" "secret_accessor_url" {
  secret_id = google_secret_manager_secret.testrail_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.service_runner.email}"
}

# Cloud Run Service (Placeholder)
# Note: This requires an image. We will use a dummy hello-world for initial setup 
# or we need to build and push the image first. 
# For Terraform to succeed initially without a built image, we can use the standard hello-world image.
resource "google_cloud_run_service" "default" {
  name     = "testrail-kpi-service"
  location = var.region

  template {
    spec {
      service_account_name = google_service_account.service_runner.email
      containers {
        image = "us-docker.pkg.dev/cloudrun/container/hello"
        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }
        env {
          name  = "BQ_DATASET"
          value = google_bigquery_dataset.testrail_data.dataset_id
        }
        # Secrets will be injected as env vars in the actual deployment
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
  
  depends_on = [google_project_service.apis]
}

# Cloud Scheduler
resource "google_cloud_scheduler_job" "sync_runs" {
  name             = "sync-testrail-runs"
  description      = "Sync TestRail Runs every hour"
  schedule         = "0 * * * *"
  time_zone        = "Etc/UTC"
  attempt_deadline = "320s"

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_service.default.status[0].url}/jobs/sync?entity=runs"
    
    oidc_token {
      service_account_email = google_service_account.service_runner.email
    }
  }
}
