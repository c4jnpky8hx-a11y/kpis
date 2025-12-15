variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "bq_dataset_id" {
  description = "BigQuery Dataset ID"
  type        = string
  default     = "testrail_kpis"
}

variable "sync_token" {
  description = "Token to secure public sync endpoint"
  type        = string
}
