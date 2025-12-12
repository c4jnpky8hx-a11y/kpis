output "cloud_run_url" {
  value = google_cloud_run_service.default.status[0].url
}

output "bq_dataset" {
  value = google_bigquery_dataset.testrail_data.dataset_id
}
